"use client"

import { createContext, useState, useContext, useEffect, useCallback, useMemo } from "react"
import { toast } from "react-toastify"
import { useAuth } from "./AuthContext"
import chatService from "../services/ChatService"
import useChatConnection from "../hooks/useChatConnection"
import apiService from "../services/apiService.jsx"
import { logger } from "../utils"

// Create a logger for this context
const log = logger.create("ChatContext")

const ChatContext = createContext()

export const useChat = () => useContext(ChatContext)

export const ChatProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth()
  const { connected: socketConnected } = useChatConnection()
  
  // State
  const [conversations, setConversations] = useState([])
  const [unreadCounts, setUnreadCounts] = useState({})
  const [typingUsers, setTypingUsers] = useState({})
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [activeConversation, setActiveConversation] = useState(null)
  const [totalUnreadCount, setTotalUnreadCount] = useState(0)

  // Initialize chat service when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user?._id) {
      chatService.initialize(user)
      
      // Set up event listeners for typing indicators
      const typingListener = chatService.on('userTyping', (data) => {
        if (data && data.userId) {
          setTypingUsers(prev => {
            const updated = { ...prev, [data.userId]: Date.now() };
            
            // Auto-clear typing indicators after 3 seconds
            setTimeout(() => {
              setTypingUsers(current => {
                const timestamp = current[data.userId];
                if (timestamp && Date.now() - timestamp > 3000) {
                  const newState = { ...current };
                  delete newState[data.userId];
                  return newState;
                }
                return current;
              });
            }, 3000);
            
            return updated;
          });
        }
      });
      
      // Listen for message received to update conversations list
      const messageListener = chatService.on('messageReceived', (message) => {
        if (message && message.sender) {
          updateConversationsList(message);
          
          // Update unread counts
          if (message.sender !== user._id && !message.read) {
            setUnreadCounts(prev => {
              const senderId = message.sender;
              const newCounts = { 
                ...prev, 
                [senderId]: (prev[senderId] || 0) + 1 
              };
              
              // Calculate total
              const total = Object.values(newCounts).reduce((sum, count) => sum + count, 0);
              setTotalUnreadCount(total);
              
              return newCounts;
            });
          }
        }
      });
      
      // Cleanup listeners
      return () => {
        typingListener();
        messageListener();
      };
    }
  }, [isAuthenticated, user]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Update conversations list when a new message arrives
  const updateConversationsList = useCallback(
    (message) => {
      if (!message || !message.sender || !message.recipient || !user || !user._id) {
        log.error("Invalid data for conversation update:", { message, user })
        return
      }
      
      const otherUserId = message.sender === user._id ? message.recipient : message.sender
      
      setConversations((prev) => {
        const index = prev.findIndex((conv) => conv.user && conv.user._id === otherUserId)
        
        if (index >= 0) {
          // Update existing conversation
          const updated = [...prev]
          updated[index] = { 
            ...updated[index], 
            lastMessage: message, 
            updatedAt: message.createdAt 
          }
          
          // Sort by most recent
          return updated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        } else {
          // New conversation - need to fetch user data
          apiService
            .get(`/users/${otherUserId}`)
            .then((response) => {
              if (response.success && response.data && response.data.user) {
                setConversations((current) => {
                  // Check again to avoid duplicates
                  if (current.some((conv) => conv.user && conv.user._id === otherUserId)) {
                    return current
                  }
                  
                  // Create new conversation
                  const newConv = {
                    user: response.data.user,
                    lastMessage: message,
                    updatedAt: message.createdAt,
                  }
                  
                  // Add and sort
                  return [...current, newConv].sort(
                    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
                  )
                })
              } else {
                log.error("Invalid user response:", response)
              }
            })
            .catch((err) => log.error("Error fetching user for conversation:", err))
          
          return prev
        }
      })
    },
    [user]
  )

  // Get conversations list
  const getConversations = useCallback(async () => {
    if (!isAuthenticated || !user?._id) {
      log.warn("Cannot get conversations: User is not authenticated")
      return []
    }
    
    setLoading(true)
    setError(null)
    
    try {
      log.debug("Fetching conversations")
      
      const conversations = await chatService.getConversations()
      
      // Update state
      setConversations(conversations)
      
      // Update unread counts
      const counts = {}
      let total = 0
      
      conversations.forEach(conv => {
        counts[conv.user._id] = conv.unreadCount || 0
        total += (conv.unreadCount || 0)
      })
      
      setUnreadCounts(counts)
      setTotalUnreadCount(total)
      
      return conversations
    } catch (err) {
      const errMsg = err.message || "Failed to load conversations"
      setError(errMsg)
      log.error("Error fetching conversations:", err)
      return []
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, user])

  // Upload a file for messaging
  const uploadFile = useCallback(
    async (file, recipientId, onProgress = null) => {
      if (!isAuthenticated || !user?._id || !file) {
        const errMsg = "Cannot upload file: Not authenticated or file missing"
        setError(errMsg)
        return null
      }
      
      // File validation
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
      
      setUploading(true)
      setError(null)
      
      try {
        log.debug(`Uploading file: ${file.name}`)
        
        const formData = new FormData()
        formData.append("file", file)
        if (recipientId) formData.append("recipient", recipientId)
        
        const response = await apiService.upload("/messages/attachments", formData, onProgress)
        
        if (response.success) {
          log.debug("File uploaded successfully")
          return response.data
        } else {
          throw new Error(response.error || "Failed to upload file")
        }
      } catch (err) {
        const errMsg = err.message || "Failed to upload file"
        setError(errMsg)
        toast.error(errMsg)
        log.error("File upload error:", err)
        return null
      } finally {
        setUploading(false)
      }
    },
    [isAuthenticated, user]
  )

  // Send a file message
  const sendFileMessage = useCallback(
    async (recipientId, file, onProgress = null) => {
      if (!isAuthenticated || !user?._id || !recipientId || !file) {
        const errMsg = "Cannot send file: Missing authentication, recipient, or file"
        setError(errMsg)
        return null
      }
      
      try {
        log.debug(`Sending file message to ${recipientId}`)
        
        // First upload the file
        const fileData = await uploadFile(file, recipientId, onProgress)
        if (!fileData) throw new Error("Failed to upload file")
        
        // Prepare metadata
        const metadata = {
          fileUrl: fileData.url,
          fileName: fileData.fileName || file.name,
          fileSize: fileData.fileSize || file.size,
          mimeType: fileData.mimeType || file.type,
          ...fileData.metadata,
        }
        
        // Send the file message
        return await chatService.sendMessage(
          recipientId, 
          fileData.fileName || file.name, 
          "file", 
          metadata
        )
      } catch (err) {
        const errMsg = err.message || "Failed to send file message"
        setError(errMsg)
        toast.error(errMsg)
        log.error("Send file message error:", err)
        return null
      }
    },
    [isAuthenticated, user, uploadFile]
  )

  // Mark a conversation as read
  const markConversationRead = useCallback(async (conversationId) => {
    if (!isAuthenticated || !user?._id || !conversationId) {
      return false
    }
    
    try {
      log.debug(`Marking conversation with ${conversationId} as read`)
      
      await chatService.markConversationRead(conversationId)
      
      // Update unread counts
      setUnreadCounts(prev => {
        const newCounts = { ...prev, [conversationId]: 0 }
        
        // Recalculate total
        const total = Object.values(newCounts).reduce((sum, count) => sum + count, 0)
        setTotalUnreadCount(total)
        
        return newCounts
      })
      
      return true
    } catch (err) {
      log.error("Error marking conversation as read:", err)
      return false
    }
  }, [isAuthenticated, user])

  // Provide all chat-related values to components
  const value = useMemo(() => ({
    // State
    conversations,
    unreadCounts,
    typingUsers,
    loading,
    uploading,
    error,
    socketConnected,
    activeConversation,
    totalUnreadCount,
    
    // Actions
    setActiveConversation,
    getConversations,
    uploadFile,
    sendFileMessage,
    markConversationRead,
    clearError,
    
    // Helpers
    isInitialized: !!chatService.isReady(),
  }), [
    conversations,
    unreadCounts,
    typingUsers,
    loading,
    uploading,
    error,
    socketConnected,
    activeConversation,
    totalUnreadCount,
    getConversations,
    uploadFile,
    sendFileMessage,
    markConversationRead,
    clearError
  ])

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export default ChatContext