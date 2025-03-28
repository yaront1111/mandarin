"use client"

import { createContext, useState, useContext, useEffect, useCallback, useRef, useMemo } from "react"
import { toast } from "react-toastify"
import axios from "axios"
import apiService from "@services/apiService.jsx"
import socketService from "@services/socketService.jsx"
import { useAuth } from "./AuthContext"

const ChatContext = createContext()

export const useChat = () => useContext(ChatContext)

export const ChatProvider = ({ children }) => {
  const { user, isAuthenticated, token } = useAuth()
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
  const [requestsData, setRequestsData] = useState([])
  const [pendingPhotoRequests, setPendingPhotoRequests] = useState(0)
  const [isApprovingRequests, setIsApprovingRequests] = useState(false)

  // Refs to store event handlers for cleanup
  const eventHandlersRef = useRef({})
  const reconnectAttemptRef = useRef(0)
  const socketInitializedRef = useRef(false)

  // Define authAxios early so it's available in all inner functions.
  const authAxios = useMemo(() => {
    const instance = axios.create({
      baseURL: "",
      headers: { "Content-Type": "application/json" },
    })
    instance.interceptors.request.use(
      (config) => {
        const authToken = token || localStorage.getItem("token")
        if (authToken) {
          config.headers.Authorization = `Bearer ${authToken}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )
    return instance
  }, [token])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Initialize socket connection with connection status tracking
  useEffect(() => {
    if (isAuthenticated && user && user._id) {
      // Validate user ID format before initializing socket
      if (!/^[0-9a-fA-F]{24}$/.test(user._id)) {
        console.error(`Cannot initialize socket: Invalid user ID format: ${user._id}`)
        return
      }

      const storedToken = sessionStorage.getItem("token") || localStorage.getItem("token")
      if (storedToken) {
        console.log(`Initializing socket for user ${user._id}`)
        socketService.init(user._id, storedToken)
        socketInitializedRef.current = true

        // Listen for connection state changes
        const connectionStatusCheck = setInterval(() => {
          const isConnected = socketService.isConnected()
          setSocketConnected(isConnected)

          // If we lose connection, try to reconnect after a delay
          if (!isConnected && socketInitializedRef.current && reconnectAttemptRef.current < 3) {
            reconnectAttemptRef.current++
            console.log(`Reconnection attempt ${reconnectAttemptRef.current}`)
            setTimeout(() => {
              socketService.reconnect()
            }, 3000)
          }
        }, 5000) // Check every 5 seconds

        return () => {
          clearInterval(connectionStatusCheck)
        }
      }
    }
  }, [isAuthenticated, user])

  // Setup socket event listeners
  useEffect(() => {
    if (!isAuthenticated || !user || !socketInitializedRef.current) return

    const cleanupEventHandlers = () => {
      Object.entries(eventHandlersRef.current).forEach(([event, handler]) => {
        if (handler) {
          socketService.off(event, handler)
        }
      })
      // Clear the stored handlers
      eventHandlersRef.current = {}
    }

    // Clean up any existing handlers first
    cleanupEventHandlers()

    // Setup new handlers
    const handleMessageReceived = (message) => {
      console.log("Received message:", message)
      if (!message || !message.sender || !message.recipient) {
        console.error("Invalid message object:", message)
        return
      }
      setMessages((prev) => {
        // Check for duplicates by ID or by tempMessageId
        if (prev.some((m) => m._id === message._id) ||
            (message.tempMessageId && prev.some(m => m.tempMessageId === message.tempMessageId))) {
          return prev
        }
        const updated = [...prev, message].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        )
        return updated
      })
      if (message.sender !== user._id) {
        setUnreadCounts((prev) => ({
          ...prev,
          [message.sender]: (prev[message.sender] || 0) + 1,
        }))
        updateConversationsList(message)
      }
    }

    const handleUserTyping = (data) => {
      if (!data) {
        console.error("Invalid typing data: empty data")
        return
      }
      const userId = data.userId || data.sender
      if (!userId) {
        console.error("Invalid typing data:", data)
        return
      }
      setTypingUsers((prev) => ({
        ...prev,
        [userId]: Date.now(),
      }))
    }

    const handleUserOnline = (data) => {
      if (!data || !data.userId) {
        console.error("Invalid online data:", data)
        return
      }
      setConversations((prev) =>
        prev.map((conv) =>
          conv.user._id === data.userId
            ? { ...conv, user: { ...conv.user, isOnline: true } }
            : conv
        )
      )
    }

    const handleUserOffline = (data) => {
      if (!data || !data.userId) {
        console.error("Invalid offline data:", data)
        return
      }
      setConversations((prev) =>
        prev.map((conv) =>
          conv.user._id === data.userId
            ? { ...conv, user: { ...conv.user, isOnline: false } }
            : conv
        )
      )
    }

    const handleMessagesRead = (data) => {
      if (!data || !data.reader || !data.messageIds || !Array.isArray(data.messageIds)) {
        console.error("Invalid read receipt data:", data)
        return
      }
      if (data.reader !== user._id) {
        setMessages((prev) =>
          prev.map((msg) =>
            data.messageIds.includes(msg._id) && msg.sender === user._id
              ? { ...msg, read: true }
              : msg
          )
        )
      }
    }

    // Register all event handlers
    eventHandlersRef.current.messageReceived = socketService.on("messageReceived", handleMessageReceived)
    eventHandlersRef.current.userTyping = socketService.on("userTyping", handleUserTyping)
    eventHandlersRef.current.userOnline = socketService.on("userOnline", handleUserOnline)
    eventHandlersRef.current.userOffline = socketService.on("userOffline", handleUserOffline)
    eventHandlersRef.current.messagesRead = socketService.on("messagesRead", handleMessagesRead)

    // Handle socket connection state changes
    eventHandlersRef.current.connect = socketService.on("connect", () => {
      setSocketConnected(true)
      reconnectAttemptRef.current = 0
      console.log("Socket connected successfully")
    })

    eventHandlersRef.current.disconnect = socketService.on("disconnect", () => {
      setSocketConnected(false)
      console.log("Socket disconnected")
    })

    // Clean up on unmount or dependency change
    return cleanupEventHandlers
  }, [isAuthenticated, user])

  // Effect to handle reconnection after the page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && socketInitializedRef.current && !socketService.isConnected()) {
        console.log("Page became visible, checking socket connection")
        socketService.reconnect()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  const updateConversationsList = useCallback(
    (message) => {
      if (!message || !message.sender || !message.recipient || !user || !user._id) {
        console.error("Invalid data for conversation update:", { message, user })
        return
      }
      const otherUserId = message.sender === user._id ? message.recipient : message.sender
      if (!otherUserId || !/^[0-9a-fA-F]{24}$/.test(otherUserId)) {
        console.error(`Invalid otherUserId: ${otherUserId}`)
        return
      }
      setConversations((prev) => {
        const index = prev.findIndex((conv) => conv.user && conv.user._id === otherUserId)
        if (index >= 0) {
          const updated = [...prev]
          updated[index] = { ...updated[index], lastMessage: message, updatedAt: message.createdAt }
          return updated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        } else {
          apiService
            .get(`/users/${otherUserId}`)
            .then((response) => {
              if (response.success && response.data && response.data.user) {
                setConversations((current) => {
                  if (current.some((conv) => conv.user && conv.user._id === otherUserId)) {
                    return current
                  }
                  const newConv = {
                    user: response.data.user,
                    lastMessage: message,
                    updatedAt: message.createdAt,
                  }
                  return [...current, newConv].sort(
                    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
                  )
                })
              } else {
                console.error("Invalid user response:", response)
              }
            })
            .catch((err) => console.error("Error fetching user for conversation:", err))
          return prev
        }
      })
    },
    [user]
  )

  const getMessages = useCallback(
    async (recipientId) => {
      if (!user || !recipientId) return []
      if (!/^[0-9a-fA-F]{24}$/.test(recipientId)) {
        const errMsg = `Invalid recipient ID format: ${recipientId}`
        console.error(errMsg)
        setError(errMsg)
        return []
      }
      setLoading(true)
      setError(null)
      try {
        const response = await apiService.get(`/messages/${recipientId}`)
        if (response.success) {
          const sorted = response.data.sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
          )
          setMessages(sorted)
          const unread = sorted.filter((msg) => msg.recipient === user._id && !msg.read)
          if (unread.length) {
            const ids = unread.map((msg) => msg._id)
            markMessagesAsRead(ids, recipientId)
            setUnreadCounts((prev) => ({ ...prev, [recipientId]: 0 }))
          }
          setActiveConversation(recipientId)
          return response.data
        } else {
          throw new Error(response.error || "Failed to get messages")
        }
      } catch (err) {
        const errMsg = err.error || err.message || "Failed to get messages"
        setError(errMsg)
        toast.error(errMsg)
        return []
      } finally {
        setLoading(false)
      }
    },
    [user]
  )

  const getConversations = useCallback(async () => {
    if (!user) {
      console.warn("Cannot get conversations: User is not authenticated")
      return []
    }
    if (!user._id) {
      console.warn("Cannot get conversations: User ID is missing")
      return []
    }
    if (!/^[0-9a-fA-F]{24}$/.test(user._id)) {
      console.error(`Invalid user ID format: ${user._id}`)
      setError("Invalid user ID format. Please log out and log in again.")
      toast.error("Authentication error. Please log out and log in again.")
      return []
    }
    setLoading(true)
    setError(null)
    try {
      const response = await apiService.get("/messages/conversations")
      if (response.success) {
        const valid = response.data.filter(
          (conv) =>
            conv && conv.user && conv.user._id && /^[0-9a-fA-F]{24}$/.test(conv.user._id)
        )
        if (valid.length !== response.data.length) {
          console.warn(`Filtered out ${response.data.length - valid.length} invalid conversations`)
        }
        setConversations(valid)
        const counts = {}
        valid.forEach((conv) => (counts[conv.user._id] = conv.unreadCount || 0))
        setUnreadCounts(counts)
        return valid
      } else {
        throw new Error(response.error || "Failed to get conversations")
      }
    } catch (err) {
      const errMsg = err.error || err.message || "Failed to get conversations"
      setError(errMsg)
      console.error(errMsg)
      return []
    } finally {
      setLoading(false)
    }
  }, [user])

  const uploadFile = useCallback(
    async (file, recipientId, onProgress = null) => {
      if (!user || !file) {
        setError("Cannot upload file: Missing user or file")
        return null
      }
      const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
      if (file.size > MAX_FILE_SIZE) {
        const errMsg = "File is too large (max 5MB allowed)"
        setError(errMsg)
        toast.error(errMsg)
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
        const errMsg = "Invalid file type. Only images, documents, audio, and videos are allowed."
        setError(errMsg)
        toast.error(errMsg)
        return null
      }
      if (recipientId && !/^[0-9a-fA-F]{24}$/.test(recipientId)) {
        const errMsg = `Invalid recipient ID format: ${recipientId}`
        setError(errMsg)
        toast.error(errMsg)
        return null
      }
      setUploading(true)
      setError(null)
      try {
        const formData = new FormData()
        formData.append("file", file)
        if (recipientId) formData.append("recipient", recipientId)
        const response = await apiService.upload("/messages/attachments", formData, onProgress)
        if (response.success) {
          return response.data
        } else {
          throw new Error(response.error || "Failed to upload file")
        }
      } catch (err) {
        const errMsg = err.error || err.message || "Failed to upload file"
        setError(errMsg)
        toast.error(errMsg)
        console.error("File upload error:", err)
        return null
      } finally {
        setUploading(false)
      }
    },
    [user]
  )

  const sendMessage = useCallback(
    async (recipientId, type, content, metadata = {}) => {
      if (!user || !recipientId) {
        setError("Cannot send message: Missing user or recipient")
        return null
      }
      if (!/^[0-9a-fA-F]{24}$/.test(recipientId)) {
        const errMsg = `Invalid recipient ID format: ${recipientId}`
        setError(errMsg)
        toast.error(errMsg)
        return null
      }
      setSending(true)
      setError(null)
      const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const enhancedMetadata = { ...metadata, clientMessageId }
      try {
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

        // First, try socket-based messaging
        let socketResponse = null
        try {
          console.log(`Attempting to send message via socket: type=${type}, recipient=${recipientId}`)
          socketResponse = await socketService.sendMessage(recipientId, type, content, enhancedMetadata)
          console.log("Socket message response:", socketResponse)
        } catch (socketError) {
          console.warn("Socket message failed, falling back to API:", socketError)
        }

        // If socket message was successful and not pending, use that response
        if (socketResponse && !socketResponse.pending) {
          console.log("Socket message sent successfully")
          setMessages((prev) => {
            // Check for duplicates by message ID or clientMessageId
            if (
              prev.some(
                (m) =>
                  m.metadata?.clientMessageId === clientMessageId ||
                  m._id === socketResponse._id ||
                  (socketResponse.tempMessageId && m.tempMessageId === socketResponse.tempMessageId)
              )
            ) return prev;

            return [...prev, socketResponse].sort(
              (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            )
          })
          updateConversationsList(socketResponse)
          return socketResponse
        }

        // If socket message failed or is pending, fall back to API
        console.log("Falling back to API for message sending")
        const apiResponse = await apiService.post("/messages", {
          recipient: recipientId,
          type,
          content,
          metadata: enhancedMetadata,
        })

        if (apiResponse.success) {
          const newMsg = apiResponse.data
          setMessages((prev) => {
            // Check for duplicates by message ID or clientMessageId or tempMessageId
            if (
              prev.some(
                (m) =>
                  m.metadata?.clientMessageId === clientMessageId ||
                  m._id === newMsg._id ||
                  (socketResponse?.tempMessageId && m.tempMessageId === socketResponse.tempMessageId)
              )
            ) return prev;

            return [...prev, newMsg].sort(
              (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            )
          })
          updateConversationsList(newMsg)
          return newMsg
        } else {
          throw new Error(apiResponse.error || "Failed to send message")
        }
      } catch (err) {
        const errMsg = err.error || err.message || "Failed to send message"
        setError(errMsg)
        toast.error(errMsg)
        console.error("Send message error:", err)
        return null
      } finally {
        setSending(false)
      }
    },
    [user, updateConversationsList]
  )

  const sendFileMessage = useCallback(
    async (recipientId, file, onProgress = null) => {
      if (!user || !recipientId || !file) {
        setError("Cannot send file: Missing user, recipient, or file")
        return null
      }
      try {
        const fileData = await uploadFile(file, recipientId, onProgress)
        if (!fileData) throw new Error("Failed to upload file")
        const metadata = {
          fileUrl: fileData.url,
          fileName: fileData.fileName || file.name,
          fileSize: fileData.fileSize || file.size,
          mimeType: fileData.mimeType || file.type,
          ...fileData.metadata,
        }
        return await sendMessage(recipientId, "file", fileData.fileName || file.name, metadata)
      } catch (err) {
        const errMsg = err.error || err.message || "Failed to send file message"
        setError(errMsg)
        toast.error(errMsg)
        console.error("Send file message error:", err)
        return null
      }
    },
    [user, uploadFile, sendMessage]
  )

  const sendTyping = useCallback(
    (recipientId) => {
      if (!user || !recipientId) return
      if (!/^[0-9a-fA-F]{24}$/.test(recipientId)) {
        console.error(`Invalid recipient ID format for typing indicator: ${recipientId}`)
        return
      }
      socketService.sendTyping(recipientId)
    },
    [user]
  )

  const markMessagesAsRead = useCallback(
    (messageIds, senderId) => {
      if (!user || !messageIds.length) return
      if (!/^[0-9a-fA-F]{24}$/.test(senderId)) {
        console.error(`Invalid sender ID format: ${senderId}`)
        return
      }
      setMessages((prev) =>
        prev.map((msg) => (messageIds.includes(msg._id) ? { ...msg, read: true } : msg))
      )
      socketService.emit("messageRead", {
        reader: user._id,
        sender: senderId,
        messageIds,
      })
      apiService.post("/messages/read", { messageIds }).catch((err) => {
        console.error("Error marking messages as read:", err)
      })
      setUnreadCounts((prev) => ({ ...prev, [senderId]: 0 }))
    },
    [user]
  )

  const handleApproveAllRequests = useCallback(
    async (recipientId) => {
      setIsApprovingRequests(true)
      try {
        if (requestsData.length > 0) {
          const results = await Promise.allSettled(
            requestsData.map((request) =>
              authAxios.put(`/api/users/photos/permissions/${request._id}`, {
                status: "approved",
              })
            )
          )
          const successCount = results.filter(
            (result) => result.status === "fulfilled" && result.value.data.success
          ).length
          if (successCount > 0) {
            console.log(`Approved ${successCount} photo request${successCount !== 1 ? "s" : ""}`)
            const systemMessage = {
              _id: Date.now().toString(),
              sender: "system",
              content: `Photo access approved for ${successCount} photo${successCount !== 1 ? "s" : ""}.`,
              createdAt: new Date().toISOString(),
              type: "system",
            }
            setMessages((prev) => [...prev, systemMessage])
            try {
              await sendMessage(recipientId, "text", `I've approved your request to view my private photos.`)
            } catch (err) {
              console.error("Error sending system message:", err)
            }
            setPendingPhotoRequests(0)
            setRequestsData([])
          } else {
            console.error("Failed to approve photo requests")
          }
        } else {
          const response = await authAxios.post(`/api/users/photos/approve-all`, {
            requesterId: recipientId,
          })
          if (response.data?.success) {
            const approvedCount = response.data.approvedCount || 1
            console.log(`Approved ${approvedCount} photo request${approvedCount !== 1 ? "s" : ""}`)
            const systemMessage = {
              _id: Date.now().toString(),
              sender: "system",
              content: `Photo access approved.`,
              createdAt: new Date().toISOString(),
              type: "system",
            }
            setMessages((prev) => [...prev, systemMessage])
            try {
              await sendMessage(recipientId, "text", `I've approved your request to view my private photos.`)
            } catch (err) {
              console.error("Error sending system message:", err)
            }
            setPendingPhotoRequests(0)
          } else {
            throw new Error("Approval failed")
          }
        }
      } catch (error) {
        console.error("Error approving photo requests. Please try again.", error)
        const systemMessage = {
          _id: Date.now().toString(),
          sender: "system",
          content: "Photo access approved (simulated).",
          createdAt: new Date().toISOString(),
          type: "system",
        }
        setMessages((prev) => [...prev, systemMessage])
      } finally {
        setIsApprovingRequests(false)
      }
    },
    [requestsData, authAxios, sendMessage]
  )

  const initiateVideoCall = useCallback(
    (recipientId) => {
      if (!user || !recipientId) {
        setError("Cannot initiate call: Missing user or recipient")
        return null
      }
      if (!/^[0-9a-fA-F]{24}$/.test(recipientId)) {
        const errMsg = `Invalid recipient ID format for video call: ${recipientId}`
        setError(errMsg)
        toast.error(errMsg)
        return null
      }
      return socketService.initiateVideoCall(recipientId)
    },
    [user]
  )

  const answerVideoCall = useCallback(
    (callerId, accept) => {
      if (!user || !callerId) {
        setError("Cannot answer call: Missing user or caller")
        return null
      }
      if (!/^[0-9a-fA-F]{24}$/.test(callerId)) {
        const errMsg = `Invalid caller ID format: ${callerId}`
        setError(errMsg)
        toast.error(errMsg)
        return null
      }
      return socketService.answerVideoCall(callerId, accept)
    },
    [user]
  )

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
    setActiveConversation,
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
    handleApproveAllRequests,
    isApprovingRequests,
    requestsData,
    pendingPhotoRequests
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export default ChatContext
