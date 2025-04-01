"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "../context"
import { useApi } from "./useApi"
import { useSocketConnection } from "./useSocketConnection"
import { logger } from "../utils"

// Create a logger for this hook
const log = logger.create("useChatMessages")

export const useChatMessages = (recipientId) => {
  const { user, isAuthenticated } = useAuth()
  const api = useApi()
  const socket = useSocketConnection()

  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [sending, setSending] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Refs for tracking state in callbacks
  const messagesRef = useRef(messages)
  const pageRef = useRef(page)
  const hasMoreRef = useRef(hasMore)
  const mountedRef = useRef(true)
  const socketListenersRef = useRef([])
  const retryTimeoutRef = useRef(null)
  const retryCountRef = useRef(0)
  const maxRetries = 3

  // Update refs when state changes
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    pageRef.current = page
  }, [page])

  useEffect(() => {
    hasMoreRef.current = hasMore
  }, [hasMore])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false

      // Clear any pending retries
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }

      // Unregister socket listeners
      socketListenersRef.current.forEach((listener) => {
        if (listener && typeof listener === "function") {
          listener()
        }
      })
    }
  }, [])

  // Load initial messages
  const loadMessages = useCallback(
    async (forceRefresh = false) => {
      // Skip if no recipient ID or not authenticated
      if (!recipientId || !isAuthenticated) {
        log.debug("Missing recipientId or not authenticated, skipping message load")
        setLoading(false)
        return
      }

      // Skip if already loading unless forced
      if (loading && !forceRefresh) {
        log.debug("Already loading messages, skipping duplicate fetch")
        return
      }

      // Validate user ID
      if (!user?._id) {
        log.error("User ID is undefined or invalid")
        setError("User authentication issue. Please try logging out and back in.")
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        log.info(`Loading messages with ${recipientId}, page ${pageRef.current}`)

        const response = await api.get(`/messages/${recipientId}`, {
          page: 1,
          limit: 20,
        })

        if (!response || !response.success) {
          throw new Error(response?.error || "Failed to load messages")
        }

        const messageData = response.data || []
        log.info(`Loaded ${messageData.length} messages`)

        if (!mountedRef.current) return

        setMessages(messageData)
        setHasMore(messageData.length === 20)
        setPage(1)
        setLoading(false)
        retryCountRef.current = 0

        return messageData
      } catch (err) {
        log.error("Error loading messages:", err)

        if (!mountedRef.current) return

        setError(err.message || "Failed to load messages")
        setLoading(false)

        // Retry logic with exponential backoff
        if (retryCountRef.current < maxRetries) {
          const retryDelay = Math.min(2000 * Math.pow(2, retryCountRef.current), 10000)
          log.debug(`Will retry in ${retryDelay / 1000} seconds (attempt ${retryCountRef.current + 1})`)

          retryTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              retryCountRef.current += 1
              loadMessages(true)
            }
          }, retryDelay)
        }

        return []
      }
    },
    [recipientId, isAuthenticated, user, api, loading],
  )

  // Load more messages (pagination)
  const loadMoreMessages = useCallback(async () => {
    // Skip if no recipient ID, not authenticated, already loading more, or no more messages
    if (!recipientId || !isAuthenticated || loadingMore || !hasMoreRef.current) {
      return
    }

    setLoadingMore(true)

    try {
      const nextPage = pageRef.current + 1
      log.debug(`Loading more messages, page ${nextPage}`)

      const response = await api.get(`/messages/${recipientId}`, {
        page: nextPage,
        limit: 20,
      })

      if (!response || !response.success) {
        throw new Error(response?.error || "Failed to load more messages")
      }

      const moreMessages = response.data || []

      if (!mountedRef.current) return

      if (moreMessages.length > 0) {
        setMessages((prev) => [...prev, ...moreMessages])
        setPage(nextPage)
      }

      setHasMore(moreMessages.length === 20)
      setLoadingMore(false)
    } catch (err) {
      log.error("Error loading more messages:", err)

      if (!mountedRef.current) return

      setError(err.message || "Failed to load more messages")
      setLoadingMore(false)
    }
  }, [recipientId, isAuthenticated, api, loadingMore])

  // Send a message
  const sendMessage = useCallback(
    async (content, type = "text", metadata = null) => {
      // Skip if no recipient ID or not authenticated
      if (!recipientId || !isAuthenticated) {
        log.error("Cannot send message: Missing recipientId or not authenticated")
        throw new Error("Cannot send message: Authentication required")
      }

      // Validate user ID
      if (!user?._id) {
        log.error("Cannot send message: User ID is undefined or invalid")
        throw new Error("User authentication issue. Please try logging out and back in.")
      }

      setSending(true)

      try {
        log.debug(`Sending ${type} message to ${recipientId}`)

        // Prepare message data
        const messageData = {
          recipient: recipientId,
          content,
          type,
        }

        if (metadata) {
          messageData.metadata = metadata
        }

        // Try socket first if connected
        if (socket.connected) {
          return new Promise((resolve, reject) => {
            socket.emit("message:send", messageData, (response) => {
              if (!mountedRef.current) return

              if (response && response.success) {
                log.debug("Message sent via socket successfully")

                // Add message to state
                const newMessage = response.data
                setMessages((prev) => [newMessage, ...prev])
                setSending(false)
                resolve(newMessage)
              } else {
                log.warn("Socket message send failed, falling back to API")

                // Fall back to API
                sendViaApi().then(resolve).catch(reject)
              }
            })

            // Set timeout for socket response
            setTimeout(() => {
              log.warn("Socket message send timeout, falling back to API")
              sendViaApi().then(resolve).catch(reject)
            }, 5000)
          })
        } else {
          log.debug("Socket not connected, sending via API")
          return sendViaApi()
        }

        // Helper function for API fallback
        async function sendViaApi() {
          const response = await api.post("/messages", messageData)

          if (!response || !response.success) {
            throw new Error(response?.error || "Failed to send message")
          }

          if (!mountedRef.current) return

          const newMessage = response.data
          log.debug("Message sent via API successfully")

          // Add message to state
          setMessages((prev) => [newMessage, ...prev])
          setSending(false)
          return newMessage
        }
      } catch (err) {
        log.error("Error sending message:", err)

        if (!mountedRef.current) return

        setSending(false)
        throw err
      }
    },
    [recipientId, isAuthenticated, user, api, socket],
  )

  // Set up socket listeners for real-time messages
  useEffect(() => {
    // Skip if no recipient ID, not authenticated, or socket not connected
    if (!recipientId || !isAuthenticated || !socket.connected) {
      return
    }

    log.debug(`Setting up socket listeners for messages with ${recipientId}`)

    // Listen for new messages
    const unregisterNewMessage = socket.on("message:new", (message) => {
      if (!mountedRef.current) return

      // Only add messages from/to this conversation
      if (
        message &&
        ((message.sender === recipientId && message.recipient === user?._id) ||
          (message.sender === user?._id && message.recipient === recipientId))
      ) {
        log.debug("Received new message via socket")

        // Add to messages if not already there
        setMessages((prev) => {
          const exists = prev.some((m) => m._id === message._id)
          if (exists) return prev
          return [message, ...prev]
        })
      }
    })

    // Listen for message status updates
    const unregisterStatusUpdate = socket.on("message:status", (update) => {
      if (!mountedRef.current) return

      if (update && update.messageId) {
        log.debug(`Received message status update for ${update.messageId}`)

        // Update message status
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === update.messageId
              ? { ...msg, status: update.status, updatedAt: update.timestamp || new Date() }
              : msg,
          ),
        )
      }
    })

    // Store unregister functions
    socketListenersRef.current = [unregisterNewMessage, unregisterStatusUpdate]

    // Cleanup listeners on unmount or when dependencies change
    return () => {
      socketListenersRef.current.forEach((listener) => {
        if (listener && typeof listener === "function") {
          listener()
        }
      })
      socketListenersRef.current = []
    }
  }, [recipientId, isAuthenticated, user, socket])

  // Load initial messages when recipient changes
  useEffect(() => {
    if (recipientId && isAuthenticated) {
      loadMessages()
    } else {
      setLoading(false)
    }
  }, [recipientId, isAuthenticated, loadMessages])

  return {
    messages,
    loading,
    error,
    hasMore,
    loadMoreMessages,
    sendMessage,
    sending,
    loadingMore,
    refresh: () => loadMessages(true),
  }
}
