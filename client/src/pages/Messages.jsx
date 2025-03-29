"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { toast } from "react-toastify"
import {
  FaPaperPlane,
  FaPaperclip,
  FaTimes,
  FaSpinner,
  FaSearch,
  FaUserAlt,
  FaCheckDouble,
  FaCheck,
  FaFileAlt,
  FaFilePdf,
  FaFileVideo,
  FaFileAudio,
  FaImage
} from "react-icons/fa"

import { useAuth } from "../context/AuthContext"
import { useChat } from "../context/ChatContext"

// Debug logger function
const debug = (msg, ...args) => {
  console.log(`[Messages] ${msg}`, ...args)
}

// UserAvatar component - embedded directly
const UserAvatar = ({ user, size = "md", onClick }) => {
  const [imageError, setImageError] = useState(false)
  const sizeClass = size === "sm" ? "w-8 h-8" : size === "lg" ? "w-16 h-16" : "w-12 h-12"

  const handleError = () => {
    setImageError(true)
  }

  return (
    <div
      className={`user-avatar ${sizeClass} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {!imageError && user?.photos && user.photos.length > 0 ? (
        <img
          src={user.photos[0].url || "/placeholder.svg"}
          alt={user.nickname || "User"}
          onError={handleError}
          className="avatar-image"
        />
      ) : (
        <div className="avatar-placeholder">
          <FaUserAlt />
        </div>
      )}
      {user?.isVerified && (
        <span className="verified-badge" title="Verified User">✓</span>
      )}
    </div>
  )
}

// MessageBubble component - embedded directly
const MessageBubble = ({ message, isOwn }) => {
  const formatTime = (timestamp) => {
    if (!timestamp) return ""
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Get appropriate icon for file type
  const getFileIcon = (fileType) => {
    if (!fileType) return <FaFileAlt />
    if (fileType.startsWith("image/")) return <FaImage />
    if (fileType.startsWith("video/")) return <FaFileVideo />
    if (fileType.startsWith("audio/")) return <FaFileAudio />
    if (fileType === "application/pdf") return <FaFilePdf />
    return <FaFileAlt />
  }

  return (
    <div className={`message-bubble ${isOwn ? 'own' : 'other'}`}>
      {message.type === "text" && (
        <>
          <div className="message-content text-message">
            <p>{message.content}</p>
          </div>
          <div className="message-metadata">
            <span className="message-time">{formatTime(message.createdAt)}</span>
            {isOwn && (
              <span className="read-status">
                {message.read ? <FaCheckDouble className="read-icon" /> : <FaCheck className="sent-icon" />}
              </span>
            )}
          </div>
        </>
      )}

      {message.type === "file" && (
        <div className="message-content file-message">
          {message.metadata?.fileType?.startsWith("image/") ? (
            <div className="image-file">
              <img
                src={message.metadata.fileUrl || "/placeholder.svg"}
                alt="Image"
                className="message-image"
                onError={(e) => { e.target.src = "/placeholder.svg" }}
              />
            </div>
          ) : (
            <div className="generic-file">
              <div className="file-icon">{getFileIcon(message.metadata?.fileType)}</div>
              <div className="file-details">
                <span className="file-name">{message.metadata?.fileName || "File"}</span>
                <a
                  href={message.metadata?.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="download-link"
                >
                  Download
                </a>
              </div>
            </div>
          )}
          <div className="message-metadata">
            <span className="message-time">{formatTime(message.createdAt)}</span>
            {isOwn && (
              <span className="read-status">
                {message.read ? <FaCheckDouble className="read-icon" /> : <FaCheck className="sent-icon" />}
              </span>
            )}
          </div>
        </div>
      )}

      {message.type === "wink" && (
        <div className="message-content wink-message">
          <p className="wink-emoji">😉</p>
          <div className="message-metadata">
            <span className="message-time">{formatTime(message.createdAt)}</span>
            {isOwn && (
              <span className="read-status">
                {message.read ? <FaCheckDouble className="read-icon" /> : <FaCheck className="sent-icon" />}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ConversationList component
const ConversationList = ({ conversations, activeId, onSelect, unreadCounts }) => {
  if (!conversations || conversations.length === 0) {
    return (
      <div className="no-conversations">
        <p>No conversations yet</p>
      </div>
    )
  }

  return (
    <div className="conversations-list">
      {conversations.map((conv) => (
        <div
          key={conv.user?._id || "unknown"}
          className={`conversation-item ${activeId === conv.user?._id ? "active" : ""}`}
          onClick={() => conv.user?._id && onSelect(conv.user._id)}
        >
          <div className="conversation-avatar">
            <UserAvatar user={conv.user} size="md" />
            {conv.user?.isOnline && <span className="online-indicator"></span>}
          </div>
          <div className="conversation-details">
            <div className="conversation-header">
              <h4 className="conversation-name">{conv.user?.nickname || "User"}</h4>
              <span className="conversation-time">
                {conv.lastMessage &&
                  new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="conversation-preview">
              {conv.lastMessage && (
                <p className="last-message">
                  {conv.lastMessage.type === "text"
                    ? conv.lastMessage.content
                    : conv.lastMessage.type === "file"
                      ? "📎 Attachment"
                      : conv.lastMessage.type === "wink"
                        ? "😉 Wink"
                        : "Message"}
                </p>
              )}
              {unreadCounts[conv.user?._id] > 0 && <span className="unread-badge">{unreadCounts[conv.user._id]}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Main Messages component
const Messages = () => {
  const { user } = useAuth()
  const {
    messages,
    conversations,
    unreadCounts,
    typingUsers,
    loading,
    sending,
    uploading,
    error,
    activeConversation,
    getMessages,
    getConversations,
    sendMessage,
    sendFileMessage,
    sendTyping,
    markMessagesAsRead,
    setActiveConversation,
  } = useChat()

  const [messageText, setMessageText] = useState("")
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [authError, setAuthError] = useState(null)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const conversationsLoadedRef = useRef(false)
  const isInitialMountRef = useRef(true)

  // Get active conversation user
  const activeUser = conversations.find((conv) => conv.user && conv.user._id === activeConversation)?.user

  // MongoDB ObjectID validation function
  const isValidMongoId = useCallback((id) => {
    return id && typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)
  }, [])

  // Check user auth status only on initial mount
  useEffect(() => {
    if (!isInitialMountRef.current) return

    // Perform one-time auth check
    if (!user) {
      debug("No user object found")
      setAuthError("Not authenticated")
      return
    }

    if (!user._id) {
      debug("User object missing _id", user)
      setAuthError("User ID is missing")
      return
    }

    debug("User authenticated:", user._id)

    // Mark initial mount as complete
    isInitialMountRef.current = false
  }, [user])

  // Sync effect for user ID validation - independent of API calls
  useEffect(() => {
    if (!user || !user._id) return

    // Validate user ID format
    if (!isValidMongoId(user._id)) {
      debug(`Invalid user ID format detected: ${user._id}`)
      setAuthError("Invalid user ID format")
    } else {
      // Clear auth error if ID is valid
      setAuthError(null)
    }
  }, [user, isValidMongoId])

  // Load conversations - with protection against duplicate calls
  useEffect(() => {
    // Skip if already loaded, there's an auth error, or no valid user
    if (conversationsLoadedRef.current || authError || !user || !user._id) return

    // Skip if user ID is invalid
    if (!isValidMongoId(user._id)) {
      debug(`Skipping API call due to invalid user ID format: ${user._id}`)
      return
    }

    const loadConversations = async () => {
      // Set loading flag immediately to prevent duplicate calls
      conversationsLoadedRef.current = true

      try {
        debug("Loading conversations...", user._id)
        await getConversations()
        debug("Conversations loaded successfully")
      } catch (err) {
        debug("Failed to load conversations:", err)

        // Log specific error details
        if (err.message) debug("Error message:", err.message)
        if (err.error) debug("Error details:", err.error)

        // Clear loaded flag if error relates to auth - allow retry after fixing
        if (err.message?.includes('Invalid user ID format') ||
            err.error?.includes('Invalid user ID format')) {
          conversationsLoadedRef.current = false
          setAuthError("Invalid user ID format. Please log out and log in again.")
        } else {
          toast.error("Failed to load conversations. Please try again.")
        }
      }
    }

    loadConversations()
  }, [user, getConversations, isValidMongoId, authError])

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConversation || !user || authError) return

    // Validate conversation ID before loading messages
    if (!isValidMongoId(activeConversation)) {
      debug(`Invalid conversation ID format: ${activeConversation}`)
      toast.error("Invalid conversation selected")
      return
    }

    const loadMessages = async () => {
      try {
        debug(`Loading messages for conversation: ${activeConversation}`)
        await getMessages(activeConversation)

        // Mark messages as read
        const unreadMessages = messages
          .filter(m => m.sender === activeConversation && !m.read)
          .map(m => m._id)

        if (unreadMessages.length > 0) {
          debug(`Marking ${unreadMessages.length} messages as read`)
          markMessagesAsRead(unreadMessages, activeConversation)
        }
      } catch (err) {
        debug("Failed to load messages:", err)
        toast.error("Failed to load messages")
      }
    }

    loadMessages()
  }, [activeConversation, user, getMessages, messages, markMessagesAsRead, isValidMongoId, authError])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Cleanup typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSelectConversation = (userId) => {
    if (!isValidMongoId(userId)) {
      debug(`Invalid recipient ID format: ${userId}`)
      toast.error("Invalid conversation selected")
      return
    }

    if (userId !== activeConversation) {
      setActiveConversation(userId)
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()

    if (selectedFile) {
      await handleSendFile()
      return
    }

    if (!messageText.trim() || !activeConversation) return

    try {
      await sendMessage(activeConversation, "text", messageText.trim())
      setMessageText("")
    } catch (error) {
      debug("Failed to send message:", error)
      toast.error("Failed to send message")
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 5MB.")
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    setSelectedFile(file)
  }

  const handleSendFile = async () => {
    if (!selectedFile || !activeConversation) return

    try {
      await sendFileMessage(activeConversation, selectedFile, (progress) => {
        setUploadProgress(progress)
      })

      setSelectedFile(null)
      setUploadProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ""
    } catch (error) {
      debug("Failed to send file:", error)
      toast.error("Failed to send file")
    }
  }

  const handleCancelFileUpload = () => {
    setSelectedFile(null)
    setUploadProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleTyping = () => {
    if (!activeConversation) return

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    sendTyping(activeConversation)

    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null
    }, 3000)
  }

  const handleLogout = () => {
    // Force a page refresh to clear any stale auth state
    window.location.href = "/logout";
  }

  const isUserTyping = activeConversation &&
    typingUsers[activeConversation] &&
    Date.now() - typingUsers[activeConversation] < 3000

  // If we have an auth error, show a special UI
  if (authError) {
    return (
      <div className="messages-page">
        <div className="auth-error-container">
          <div className="error-icon">⚠️</div>
          <h3>Authentication Error</h3>
          <p>{authError}</p>
          <p>This is usually caused by a temporary issue with your session.</p>
          <div className="error-actions">
            <button onClick={() => window.location.reload()} className="btn btn-secondary">
              Refresh Page
            </button>
            <button onClick={handleLogout} className="btn btn-primary">
              Log Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="messages-page">
      <div className="conversations-panel">
        <div className="conversations-header">
          <h2>Conversations</h2>
        </div>
        {loading && conversations.length === 0 ? (
          <div className="loading-container">
            <FaSpinner className="spinner" />
            <p>Loading conversations...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="no-conversations">
            <FaSearch className="search-icon" />
            <p>No conversations yet</p>
            <p className="hint">Start a conversation from the Discover page</p>
          </div>
        ) : (
          <ConversationList
            conversations={conversations}
            activeId={activeConversation}
            onSelect={handleSelectConversation}
            unreadCounts={unreadCounts}
          />
        )}
      </div>

      <div className="messages-panel">
        {activeConversation && activeUser ? (
          <>
            <div className="messages-header">
              <div className="user-avatar">
                <UserAvatar user={activeUser} size="md" />
                {activeUser.isOnline && <span className="online-indicator"></span>}
              </div>
              <div className="user-info">
                <h3>{activeUser.nickname || "User"}</h3>
                {isUserTyping && <p className="typing-status">typing...</p>}
              </div>
            </div>

            <div className="messages-container">
              {loading ? (
                <div className="loading-container">
                  <FaSpinner className="spinner" />
                  <p>Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="empty-messages">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                <div className="messages-list">
                  {messages.map((message) => (
                    <MessageBubble key={message._id} message={message} isOwn={message.sender === user?._id} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="message-input-container">
              {selectedFile && (
                <div className="selected-file">
                  <div className="file-info">
                    <span className="file-name">{selectedFile.name}</span>
                    <span className="file-size">({Math.round(selectedFile.size / 1024)} KB)</span>
                  </div>
                  {uploading ? (
                    <div className="upload-progress">
                      <div className="progress-bar" style={{ width: `${uploadProgress}%` }}></div>
                      <span>{uploadProgress}%</span>
                    </div>
                  ) : (
                    <button className="cancel-file" onClick={handleCancelFileUpload}>
                      <FaTimes />
                    </button>
                  )}
                </div>
              )}

              <form onSubmit={handleSendMessage} className="message-form">
                <button
                  type="button"
                  className="attachment-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending || uploading}
                >
                  <FaPaperclip />
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                  accept="image/*,application/pdf,text/plain,audio/*,video/*"
                />

                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={() => handleTyping()}
                  placeholder="Type a message..."
                  className="message-input"
                  disabled={sending || uploading || !!selectedFile}
                />

                <button
                  type="submit"
                  className="send-button"
                  disabled={(!messageText.trim() && !selectedFile) || sending || uploading}
                >
                  {sending || uploading ? <FaSpinner className="spinner" /> : <FaPaperPlane />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="no-conversation-selected">
            <div className="empty-state">
              <h3>Select a conversation</h3>
              <p>Choose a conversation from the list to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Messages
