"use client"

// client/src/context/ChatContext.js
import { createContext, useReducer, useContext, useCallback, useState, useEffect, useRef } from "react"
import apiService from "../services/apiService"
import socketService from "../services/socketService"
import { toast } from "react-toastify"

const ChatContext = createContext()

const initialState = {
  messages: [],
  sending: false,
  error: null,
}

const chatReducer = (state, action) => {
  switch (action.type) {
    case "SENDING_MESSAGE":
      return { ...state, sending: true, error: null }
    case "SEND_MESSAGE":
      return { ...state, sending: false, messages: [...state.messages, action.payload] }
    case "MESSAGE_ERROR":
      return { ...state, sending: false, error: action.payload }
    case "SET_MESSAGES":
      return { ...state, messages: action.payload }
    case "UPDATE_MESSAGE":
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg._id === action.payload.messageId ? { ...msg, ...action.payload.updates } : msg,
        ),
      }
    case "CLEAR_ERROR":
      return { ...state, error: null }
    default:
      return state
  }
}

export const ChatProvider = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState)
  const [currentChat, setCurrentChat] = useState(null)
  const [typingUsers, setTypingUsers] = useState({})
  const [unreadMessages, setUnreadMessages] = useState([])
  const [loadingUnread, setLoadingUnread] = useState(false)
  const [unreadError, setUnreadError] = useState(null)
  const [lastUnreadFetch, setLastUnreadFetch] = useState(0)
  const [unreadRetryCount, setUnreadRetryCount] = useState(0)
  const messagesEndRef = useRef(null)
  const chatInputRef = useRef(null)

  // Fetch messages for a conversation
  const getMessages = useCallback(async (userId) => {
    if (!userId) return
    try {
      const response = await apiService.get(`/messages/${userId}`)
      if (response.success) {
        dispatch({ type: "SET_MESSAGES", payload: response.data || [] })
        return response.data
      } else {
        throw new Error(response.error || "Failed to fetch messages")
      }
    } catch (error) {
      console.error("Error fetching messages:", error)
      toast.error(error.message || "Failed to fetch messages")
      return []
    }
  }, [])

  /**
   * Mark a message as read.
   */
  const markMessageRead = useCallback(async (messageId) => {
    try {
      await apiService.put(`/messages/${messageId}/read`)
      setUnreadMessages((prev) => prev.filter((msg) => msg._id !== messageId))
    } catch (error) {
      console.error("Error marking message as read:", error)
    }
  }, [])

  // Get unread messages with error handling and retry logic.
  const getUnreadMessages = useCallback(
    async (force = false) => {
      const now = Date.now()
      const minInterval = 10000 // 10 seconds between calls
      if (!force && now - lastUnreadFetch < minInterval) return
      if (unreadRetryCount > 5) {
        console.warn("Too many failed attempts to fetch unread messages, giving up")
        setUnreadError("Unable to fetch unread messages after multiple attempts")
        return
      }
      if (loadingUnread) return
      setLoadingUnread(true)
      setLastUnreadFetch(now)
      try {
        const response = await apiService.get("/messages/unread/count")
        if (response && response.success) {
          setUnreadRetryCount(0)
          setUnreadError(null)
          const messageData = Array.isArray(response.bySender) ? response.bySender : []
          setUnreadMessages(messageData)
          return response
        } else {
          throw new Error(response?.error || "Failed to fetch unread messages")
        }
      } catch (error) {
        console.error("Error fetching unread messages:", error)
        setUnreadRetryCount((prev) => prev + 1)
        setUnreadError(error.message || "Error fetching unread messages")
        const backoffTime = Math.min(30000, 1000 * Math.pow(2, unreadRetryCount))
        setTimeout(() => {
          getUnreadMessages(true)
        }, backoffTime)
        return null
      } finally {
        setLoadingUnread(false)
      }
    },
    [lastUnreadFetch, loadingUnread, unreadRetryCount],
  )

  /**
   * Send a message to a recipient with proper formatting.
   * Supports text, wink, and video messages.
   */
  const sendMessage = useCallback(
    async (recipient, type, content) => {
      dispatch({ type: "SENDING_MESSAGE" })
      try {
        const messageData = { recipient, type }
        if (type === "text") {
          messageData.content = content
          // Remove metadata for non-location messages
        } else if (type === "wink") {
          messageData.content = "😉"
        } else if (type === "video") {
          messageData.content = "Video Call"
        } else {
          // For unsupported types, throw an error
          throw new Error(`Unsupported message type: ${type}`)
        }
        const data = await apiService.post("/messages", messageData)
        if (!data.success) {
          throw new Error(data.error || "Failed to send message")
        }
        const message = data.data
        try {
          await socketService.sendMessage(recipient, type, message._id)
        } catch (socketErr) {
          console.warn("Socket delivery failed, but message is saved:", socketErr)
        }
        dispatch({ type: "SEND_MESSAGE", payload: message })
        return message
      } catch (err) {
        const errorMsg = err.error || err.message || "Failed to send message"
        dispatch({ type: "MESSAGE_ERROR", payload: errorMsg })
        throw err
      }
    },
    [dispatch],
  )

  /**
   * Send typing indicator.
   */
  const sendTyping = useCallback((recipientId) => {
    if (!recipientId) return
    socketService.sendTyping(recipientId)
  }, [])

  /**
   * Initiate a video call.
   */
  const initiateVideoCall = useCallback((recipientId) => {
    if (!recipientId) {
      toast.error("Cannot start call: No recipient selected")
      return
    }
    try {
      socketService.initiateVideoCall(recipientId)
      toast.info("Calling...")
    } catch (error) {
      console.error("Error initiating call:", error)
      toast.error("Failed to start call")
    }
  }, [])

  /**
   * Clear error state.
   */
  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" })
  }, [])

  /**
   * Add a reaction to a message
   * @param {string} messageId - The ID of the message to react to
   * @param {string} emoji - The emoji reaction
   */
  const addMessageReaction = useCallback(
    async (messageId, emoji) => {
      try {
        const response = await apiService.post(`/messages/${messageId}/reaction`, { emoji })
        if (response.success) {
          // Update the message in the state with the new reaction
          dispatch({
            type: "UPDATE_MESSAGE",
            payload: {
              messageId,
              updates: { reactions: response.data.reactions },
            },
          })
          return response.data
        } else {
          throw new Error(response.error || "Failed to add reaction")
        }
      } catch (error) {
        console.error("Error adding reaction:", error)
        toast.error(error.message || "Failed to add reaction")
        throw error
      }
    },
    [dispatch],
  )

  /**
   * Remove a reaction from a message
   * @param {string} messageId - The ID of the message
   * @param {string} reactionId - The ID of the reaction to remove
   */
  const removeMessageReaction = useCallback(
    async (messageId, reactionId) => {
      try {
        const response = await apiService.delete(`/messages/${messageId}/reaction/${reactionId}`)
        if (response.success) {
          // Update the message in the state with the updated reactions
          dispatch({
            type: "UPDATE_MESSAGE",
            payload: {
              messageId,
              updates: { reactions: response.data.reactions },
            },
          })
          return response.data
        } else {
          throw new Error(response.error || "Failed to remove reaction")
        }
      } catch (error) {
        console.error("Error removing reaction:", error)
        toast.error(error.message || "Failed to remove reaction")
        throw error
      }
    },
    [dispatch],
  )

  /**
   * Search messages
   * @param {string} query - The search query
   * @param {string} conversationWith - Optional user ID to limit search to a specific conversation
   * @param {object} options - Additional search options (page, limit)
   */
  const searchMessages = useCallback(async (query, conversationWith = null, options = {}) => {
    try {
      const params = {
        query,
        page: options.page || 1,
        limit: options.limit || 20,
      }

      if (conversationWith) {
        params.with = conversationWith
      }

      const response = await apiService.get("/messages/search", params)
      if (response.success) {
        return response
      } else {
        throw new Error(response.error || "Failed to search messages")
      }
    } catch (error) {
      console.error("Error searching messages:", error)
      toast.error(error.message || "Failed to search messages")
      throw error
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    getUnreadMessages(true)
    let pollInterval = 30000
    let pollTimer = null
    const pollUnreadMessages = () => {
      if (isMounted) {
        getUnreadMessages().finally(() => {
          pollInterval = unreadError ? Math.min(pollInterval * 1.5, 300000) : 30000
          if (isMounted) pollTimer = setTimeout(pollUnreadMessages, pollInterval)
        })
      }
    }
    pollTimer = setTimeout(pollUnreadMessages, pollInterval)
    const handleNewMessage = (message) => {
      if (currentChat && message.sender === currentChat._id) {
        dispatch({ type: "SEND_MESSAGE", payload: message })
        markMessageRead(message._id)
      } else {
        getUnreadMessages(true)
        toast.info(`New message from ${message.senderName || "Someone"}`)
      }
    }
    const handleTyping = (data) => {
      setTypingUsers((prev) => ({ ...prev, [data.userId]: Date.now() }))
    }
    socketService.on("newMessage", handleNewMessage)
    socketService.on("userTyping", handleTyping)
    return () => {
      isMounted = false
      if (pollTimer) clearTimeout(pollTimer)
      socketService.off("newMessage", handleNewMessage)
      socketService.off("userTyping", handleTyping)
    }
  }, [currentChat, getUnreadMessages, markMessageRead, unreadError])

  return (
    <ChatContext.Provider
      value={{
        messages: state.messages,
        sending: state.sending,
        error: state.error,
        unreadMessages,
        typingUsers,
        currentChat,
        loadingUnread,
        unreadError,
        sendMessage,
        // Removed sendLocationMessage from context
        getMessages,
        getUnreadMessages,
        setCurrentChat,
        sendTyping,
        initiateVideoCall,
        markMessageRead,
        clearError,
        addMessageReaction,
        removeMessageReaction,
        searchMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export const useChat = () => {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider")
  }
  return context
}
