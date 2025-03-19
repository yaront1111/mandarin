

// ChatContext.js
import { createContext, useState, useContext, useEffect, useCallback, useRef } from "react"
import { toast } from "react-toastify"
import apiService from "@services/apiService.jsx"
import socketService from "@services/socketService.jsx"
import { useAuth } from "./AuthContext"

const ChatContext = createContext()

export const useChat = () => useContext(ChatContext)

export const ChatProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth()
  const [messages, setMessages] = useState([])
  const [conversations, setConversations] = useState([])
  const [unreadCounts, setUnreadCounts] = useState({})
  const [typingUsers, setTypingUsers] = useState({})
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [socketConnected, setSocketConnected] = useState(false)
  const [activeConversation, setActiveConversation] = useState(null)

  // Refs to store event handlers for cleanup
  const eventHandlersRef = useRef({
    newMessage: null,
    userTyping: null,
    userOnline: null,
    userOffline: null,
    messagesRead: null,
  })

  // Clear any error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Initialize socket connection when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user && user._id) {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      if (token) {
        socketService.init(user._id, token)
        setSocketConnected(socketService.isConnected())
      }
    }
  }, [isAuthenticated, user])

  // Setup socket event listeners
  useEffect(() => {
    if (!isAuthenticated || !user) return

    // Handler for new messages
    const handleNewMessage = (message) => {
      if (!message || !message.sender || !message.recipient) {
        console.error("Received invalid message object:", message)
        return
      }
      setMessages((prevMessages) => {
        const exists = prevMessages.some((m) => m._id === message._id)
        if (exists) return prevMessages
        const updatedMessages = [...prevMessages, message]
        return updatedMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      })

      if (message.sender !== user._id) {
        setUnreadCounts((prev) => ({
          ...prev,
          [message.sender]: (prev[message.sender] || 0) + 1,
        }))
        updateConversationsList(message)
      }
    }

    // Handler for typing indicators
    const handleUserTyping = (data) => {
      if (!data || !data.sender) {
        console.error("Received invalid typing data:", data)
        return
      }
      setTypingUsers((prev) => ({
        ...prev,
        [data.sender]: Date.now(),
      }))
    }

    // Handler for online status changes
    const handleUserOnline = (data) => {
      if (!data || !data.userId) {
        console.error("Received invalid online status data:", data)
        return
      }
      setConversations((prev) =>
        prev.map((conv) =>
          conv.user._id === data.userId ? { ...conv, user: { ...conv.user, isOnline: true } } : conv,
        ),
      )
    }

    // Handler for offline status changes
    const handleUserOffline = (data) => {
      if (!data || !data.userId) {
        console.error("Received invalid offline status data:", data)
        return
      }
      setConversations((prev) =>
        prev.map((conv) =>
          conv.user._id === data.userId ? { ...conv, user: { ...conv.user, isOnline: false } } : conv,
        ),
      )
    }

    // Handler for read receipts
    const handleMessagesRead = (data) => {
      if (!data || !data.reader || !data.messageIds || !Array.isArray(data.messageIds)) {
        console.error("Received invalid read receipt data:", data)
        return
      }
      if (data.reader !== user._id) {
        setMessages((prev) =>
          prev.map((msg) =>
            data.messageIds.includes(msg._id) && msg.sender === user._id ? { ...msg, read: true } : msg,
          ),
        )
      }
    }

    // Register event handlers
    eventHandlersRef.current.newMessage = socketService.on("newMessage", handleNewMessage)
    eventHandlersRef.current.userTyping = socketService.on("userTyping", handleUserTyping)
    eventHandlersRef.current.userOnline = socketService.on("userOnline", handleUserOnline)
    eventHandlersRef.current.userOffline = socketService.on("userOffline", handleUserOffline)
    eventHandlersRef.current.messagesRead = socketService.on("messagesRead", handleMessagesRead)

    // Cleanup function
    return () => {
      if (eventHandlersRef.current.newMessage) socketService.off("newMessage", eventHandlersRef.current.newMessage)
      if (eventHandlersRef.current.userTyping) socketService.off("userTyping", eventHandlersRef.current.userTyping)
      if (eventHandlersRef.current.userOnline) socketService.off("userOnline", eventHandlersRef.current.userOnline)
      if (eventHandlersRef.current.userOffline) socketService.off("userOffline", eventHandlersRef.current.userOffline)
      if (eventHandlersRef.current.messagesRead)
        socketService.off("messagesRead", eventHandlersRef.current.messagesRead)
    }
  }, [isAuthenticated, user])

  // Update conversations list when a new message is received
  const updateConversationsList = useCallback(
    (message) => {
      if (!message || !message.sender || !message.recipient || !user || !user._id) {
        console.error("Invalid data for updateConversationsList:", { message, user })
        return
      }

      const otherUserId = message.sender === user._id ? message.recipient : message.sender

      if (!otherUserId || !/^[0-9a-fA-F]{24}$/.test(otherUserId)) {
        console.error(`Invalid otherUserId: ${otherUserId}`)
        return
      }

      setConversations((prev) => {
        const existingIndex = prev.findIndex((conv) => conv.user && conv.user._id === otherUserId)
        if (existingIndex >= 0) {
          const updatedConversations = [...prev]
          updatedConversations[existingIndex] = {
            ...updatedConversations[existingIndex],
            lastMessage: message,
            updatedAt: message.createdAt,
          }
          return updatedConversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        } else {
          // Fetch user info for new conversation
          apiService
            .get(`/users/${otherUserId}`)
            .then((response) => {
              if (response.success && response.data && response.data.user) {
                setConversations((current) => {
                  if (current.some((conv) => conv.user && conv.user._id === otherUserId)) {
                    return current
                  }
                  const newConversation = {
                    user: response.data.user,
                    lastMessage: message,
                    updatedAt: message.createdAt,
                  }
                  return [...current, newConversation].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
                })
              } else {
                console.error("Invalid user data in response:", response)
              }
            })
            .catch((err) => {
              console.error("Error fetching user for conversation:", err)
            })

          return prev
        }
      })
    },
    [user],
  )

  // Get messages for a specific recipient
  const getMessages = useCallback(
    async (recipientId) => {
      if (!user || !recipientId) return []

      if (!/^[0-9a-fA-F]{24}$/.test(recipientId)) {
        console.error(`Invalid recipient ID format: ${recipientId}`)
        setError(`Invalid recipient ID format: ${recipientId}`)
        return []
      }

      setLoading(true)
      setError(null)
      try {
        const response = await apiService.get(`/messages/${recipientId}`)
        if (response.success) {
          setMessages(response.data.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)))
          const unreadMessages = response.data.filter((msg) => msg.recipient === user._id && !msg.read)
          if (unreadMessages.length > 0) {
            const messageIds = unreadMessages.map((msg) => msg._id)
            markMessagesAsRead(messageIds, recipientId)
            setUnreadCounts((prev) => ({
              ...prev,
              [recipientId]: 0,
            }))
          }
          setActiveConversation(recipientId)
          return response.data
        } else {
          throw new Error(response.error || "Failed to get messages")
        }
      } catch (err) {
        const errorMessage = err.error || err.message || "Failed to get messages"
        setError(errorMessage)
        toast.error(errorMessage)
        return []
      } finally {
        setLoading(false)
      }
    },
    [user],
  )

  // Get all conversations
  const getConversations = useCallback(async () => {
    if (!user) return []

    setLoading(true)
    setError(null)
    try {
      const response = await apiService.get("/messages/conversations")
      if (response.success) {
        const validConversations = response.data.filter(
          (conv) => conv && conv.user && conv.user._id && /^[0-9a-fA-F]{24}$/.test(conv.user._id),
        )
        if (validConversations.length !== response.data.length) {
          console.warn(`Filtered out ${response.data.length - validConversations.length} invalid conversations`)
        }
        setConversations(validConversations)
        const counts = {}
        validConversations.forEach((conv) => {
          counts[conv.user._id] = conv.unreadCount || 0
        })
        setUnreadCounts(counts)
        return validConversations
      } else {
        throw new Error(response.error || "Failed to get conversations")
      }
    } catch (err) {
      const errorMessage = err.error || err.message || "Failed to get conversations"
      setError(errorMessage)
      console.error(errorMessage)
      return []
    } finally {
      setLoading(false)
    }
  }, [user])

  // Upload a file and get its URL
  const uploadFile = useCallback(
    async (file, recipientId) => {
      if (!user || !file) {
        setError("Cannot upload file: Missing user or file")
        return null
      }
      const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
      if (file.size > MAX_FILE_SIZE) {
        const errorMessage = `File is too large (max 5MB allowed)`
        setError(errorMessage)
        toast.error(errorMessage)
        return null
      }
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "audio/mpeg",
        "audio/wav",
        "video/mp4",
        "video/quicktime",
      ]
      if (!allowedTypes.includes(file.type)) {
        const errorMessage = `Invalid file type. Only images, documents, audio, and videos are allowed.`
        setError(errorMessage)
        toast.error(errorMessage)
        return null
      }
      if (recipientId && !/^[0-9a-fA-F]{24}$/.test(recipientId)) {
        const errorMessage = `Invalid recipient ID format: ${recipientId}`
        setError(errorMessage)
        toast.error(errorMessage)
        return null
      }
      setUploading(true)
      setError(null)
      try {
        const formData = new FormData()
        formData.append("file", file)
        if (recipientId) {
          formData.append("recipient", recipientId)
        }
        const response = await apiService.postFormData("/messages/attachments", formData)
        if (response.success) {
          return response.data
        } else {
          throw new Error(response.error || "Failed to upload file")
        }
      } catch (err) {
        const errorMessage = err.error || err.message || "Failed to upload file"
        setError(errorMessage)
        toast.error(errorMessage)
        console.error("File upload error:", err)
        return null
      } finally {
        setUploading(false)
      }
    },
    [user]
  )

  // Updated sendMessage with duplicate handling using a unique client-generated ID
  const sendMessage = useCallback(
    async (recipientId, type, content, metadata = {}) => {
      if (!user || !recipientId) {
        setError("Cannot send message: Missing user or recipient")
        return null
      }
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(recipientId)
      if (!isValidObjectId) {
        const errorMessage = `Invalid recipient ID format: ${recipientId}`
        setError(errorMessage)
        toast.error(errorMessage)
        return null
      }
      setSending(true)
      setError(null)

      // Generate a unique client message ID and add it to the metadata for deduplication
      const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const enhancedMetadata = { ...metadata, clientMessageId }

      try {
        console.log("Sending message:", {
          sender: user._id,
          recipient: recipientId,
          type,
          contentLength: content ? content.length : 0,
          metadata: enhancedMetadata,
        })

        const validTypes = ["text", "wink", "video", "file"]
        if (!type || !validTypes.includes(type)) {
          throw new Error(`Invalid message type. Must be one of: ${validTypes.join(", ")}`)
        }
        if (type === "text" && (!content || content.trim().length === 0)) {
          throw new Error("Message content is required for text messages")
        }
        if (type === "file" && (!enhancedMetadata || !enhancedMetadata.fileUrl)) {
          throw new Error("File URL is required for file messages")
        }

        // Try to send via socket first using the enhanced metadata
        let socketResponse = null
        try {
          socketResponse = await socketService.sendMessage(recipientId, type, content, enhancedMetadata)
        } catch (socketError) {
          console.warn("Socket message failed, falling back to API:", socketError)
        }

        if (socketResponse && !socketResponse.pending) {
          setMessages((prev) => {
            const exists = prev.some(
              (m) => m.metadata?.clientMessageId === clientMessageId || m._id === socketResponse._id
            )
            if (exists) return prev
            return [...prev, socketResponse].sort(
              (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            )
          })
          updateConversationsList(socketResponse)
          setSending(false)
          return socketResponse
        }

        // API fallback with the same enhanced metadata
        const apiResponse = await apiService.post("/messages", {
          recipient: recipientId,
          type,
          content,
          metadata: enhancedMetadata,
        })

        if (apiResponse.success) {
          const newMessage = apiResponse.data
          setMessages((prev) => {
            const exists = prev.some(
              (m) => m.metadata?.clientMessageId === clientMessageId || m._id === newMessage._id
            )
            if (exists) return prev
            return [...prev, newMessage].sort(
              (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            )
          })
          updateConversationsList(newMessage)
          setSending(false)
          return newMessage
        } else {
          throw new Error(apiResponse.error || "Failed to send message")
        }
      } catch (err) {
        const errorMessage = err.error || err.message || "Failed to send message"
        setError(errorMessage)
        toast.error(errorMessage)
        console.error("Send message error:", err)
        return null
      } finally {
        setSending(false)
      }
    },
    [user, updateConversationsList]
  )

  // Send a file message – combines file upload and sendMessage
  const sendFileMessage = useCallback(
    async (recipientId, file) => {
      if (!user || !recipientId || !file) {
        setError("Cannot send file: Missing user, recipient, or file")
        return null
      }
      try {
        const fileData = await uploadFile(file, recipientId)
        if (!fileData) {
          throw new Error("Failed to upload file")
        }
        const metadata = {
          fileUrl: fileData.url,
          fileName: fileData.fileName || file.name,
          fileSize: fileData.fileSize || file.size,
          mimeType: fileData.mimeType || file.type,
          ...fileData.metadata,
        }
        return await sendMessage(
          recipientId,
          "file",
          fileData.fileName || file.name,
          metadata
        )
      } catch (err) {
        const errorMessage = err.error || err.message || "Failed to send file message"
        setError(errorMessage)
        toast.error(errorMessage)
        console.error("Send file message error:", err)
        return null
      }
    },
    [user, uploadFile, sendMessage]
  )

  // Send typing indicator
  const sendTyping = useCallback(
    (recipientId) => {
      if (!user || !recipientId) return
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(recipientId)
      if (!isValidObjectId) {
        console.error(`Invalid recipient ID format for typing indicator: ${recipientId}`)
        return
      }
      socketService.sendTyping(recipientId)
    },
    [user]
  )

  // Mark messages as read
  const markMessagesAsRead = useCallback(
    (messageIds, senderId) => {
      if (!user || !messageIds.length) return
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(senderId)
      if (!isValidObjectId) {
        console.error(`Invalid sender ID format: ${senderId}`)
        return
      }
      setMessages((prev) =>
        prev.map((msg) => (messageIds.includes(msg._id) ? { ...msg, read: true } : msg))
      )
      socketService.socket?.emit("messageRead", {
        reader: user._id,
        sender: senderId,
        messageIds,
      })
      apiService
        .post("/messages/read", { messageIds })
        .catch((err) => {
          console.error("Error marking messages as read:", err)
        })
      setUnreadCounts((prev) => ({
        ...prev,
        [senderId]: 0,
      }))
    },
    [user]
  )

  // Initiate a video call
  const initiateVideoCall = useCallback(
    (recipientId) => {
      if (!user || !recipientId) {
        setError("Cannot initiate call: Missing user or recipient")
        return null
      }
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(recipientId)
      if (!isValidObjectId) {
        const errorMessage = `Invalid recipient ID format for video call: ${recipientId}`
        setError(errorMessage)
        toast.error(errorMessage)
        return null
      }
      return socketService.initiateVideoCall(recipientId)
    },
    [user]
  )

  // Answer a video call
  const answerVideoCall = useCallback(
    (callerId, answer) => {
      if (!user || !callerId) {
        setError("Cannot answer call: Missing user or caller")
        return null
      }
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(callerId)
      if (!isValidObjectId) {
        const errorMessage = `Invalid caller ID format: ${callerId}`
        setError(errorMessage)
        toast.error(errorMessage)
        return null
      }
      return socketService.answerVideoCall(callerId, answer)
    },
    [user]
  )

  // Get total unread message count
  const getTotalUnreadCount = useCallback(() => {
    return Object.values(unreadCounts).reduce((total, count) => total + count, 0)
  }, [unreadCounts])

  const value = {
    messages,
    conversations,
    unreadCounts,
    typingUsers,
    loading,
    sending,
    uploading,
    error,
    socketConnected,
    activeConversation,
    getMessages,
    getConversations,
    sendMessage,
    sendFileMessage,
    uploadFile,
    sendTyping,
    markMessagesAsRead,
    initiateVideoCall,
    answerVideoCall,
    getTotalUnreadCount,
    clearError,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export default ChatContext
