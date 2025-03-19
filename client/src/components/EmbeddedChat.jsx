

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  FaSmile,
  FaPaperPlane,
  FaPaperclip,
  FaTimes,
  FaCheckDouble,
  FaCheck,
  FaVideo,
  FaHeart,
  FaSpinner,
  FaFile,
  FaImage,
  FaFileAlt,
  FaFilePdf,
  FaFileAudio,
  FaFileVideo,
  FaCrown,
} from "react-icons/fa"
import { useAuth, useChat } from "../context"
import { toast } from "react-toastify"
import { useNavigate } from "react-router-dom"

/**
 * EmbeddedChat - A compact chat component that can be embedded in user profiles.
 *
 * Props:
 * - recipient: The user to chat with.
 * - isOpen: Whether the chat is open.
 * - onClose: Function to call when closing the chat.
 * - embedded: Whether the chat is embedded (affects styling).
 */
const EmbeddedChat = ({ recipient, isOpen, onClose, embedded = true }) => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const {
    messages,
    getMessages,
    sendMessage,
    sendTyping,
    initiateVideoCall,
    typingUsers,
    sending: sendingMessage,
    error: messageError,
    clearError,
    sendFileMessage,
  } = useChat()

  const [newMessage, setNewMessage] = useState("")
  const [showEmojis, setShowEmojis] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [attachment, setAttachment] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [messagesData, setMessagesData] = useState([])

  const messagesEndRef = useRef(null)
  const chatInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  // Load messages when chat is opened with the recipient
  useEffect(() => {
    let isMounted = true

    if (recipient && isOpen) {
      setIsLoading(true)
      getMessages(recipient._id)
        .then((fetchedMessages) => {
          if (isMounted) {
            // Check if fetchedMessages is actually an array
            if (Array.isArray(fetchedMessages)) {
              setMessagesData(fetchedMessages)
            }
            setIsLoading(false)
          }
        })
        .catch((err) => {
          console.error("Failed to load messages:", err)
          if (isMounted) {
            setIsLoading(false)
            toast.error("Failed to load messages. Please try again.")
          }
        })
    }

    // Cleanup function to prevent state updates on unmounted component
    return () => {
      isMounted = false
    }
  }, [recipient, isOpen, getMessages])

  // Update local messages state when the context messages change
  useEffect(() => {
    if (Array.isArray(messages)) {
      setMessagesData(messages)
    }
  }, [messages])

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messagesData])

  // Focus the input when chat opens
  useEffect(() => {
    if (isOpen && recipient) {
      setTimeout(() => chatInputRef.current?.focus(), 300)
    }
  }, [isOpen, recipient])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      // Properly clean up any uploads in progress
      if (isUploading) {
        // Cancel any ongoing uploads
        setIsUploading(false)
        setAttachment(null)
        setUploadProgress(0)
        // In a production environment, you would also want to abort the fetch/axios request
        // if you have access to the abort controller
      }
    }
  }, [isUploading])

  // Get the file icon based on file type
  const getFileIcon = useCallback((file) => {
    if (!file) return <FaFile />

    const fileType = file.type || ""
    if (fileType.startsWith("image/")) return <FaImage />
    if (fileType.startsWith("video/")) return <FaFileVideo />
    if (fileType.startsWith("audio/")) return <FaFileAudio />
    if (fileType === "application/pdf") return <FaFilePdf />
    return <FaFileAlt />
  }, [])

  // Handle sending a text message
  const handleSendMessage = async (e) => {
    e?.preventDefault()

    // If there's an attachment, handle it first
    if (attachment) {
      await handleSendAttachment()
      return
    }

    if (newMessage.trim() && !sendingMessage && recipient) {
      // Check if user can send messages (not just winks)
      if (user?.accountTier === "FREE" && newMessage.trim() !== "😉") {
        toast.error("Free accounts can only send winks. Upgrade to send messages.")
        return
      }

      try {
        await sendMessage(recipient._id, "text", newMessage.trim())
        setNewMessage("")
      } catch (error) {
        console.error("Failed to send message:", error)
        toast.error(error.message || "Failed to send message")
      }
    }
  }

  // Handle sending file attachment
  const handleSendAttachment = async () => {
    if (!attachment || !recipient || isUploading) return

    setIsUploading(true)
    try {
      // Use the sendFileMessage from ChatContext
      await sendFileMessage(recipient._id, attachment, (progress) => {
        setUploadProgress(progress)
      })

      toast.success("File sent successfully")

      // Reset attachment state after successful upload
      setAttachment(null)
      setUploadProgress(0)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      console.error("Failed to send attachment:", error)
      toast.error(error.message || "Failed to send file. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  // Handle typing indicator
  const handleTyping = (e) => {
    setNewMessage(e.target.value)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      if (e.target.value.trim() && recipient && sendTyping) {
        sendTyping(recipient._id)
      }
    }, 300)
  }

  // Handle sending a wink message
  const handleSendWink = async () => {
    if (!sendingMessage && recipient) {
      try {
        await sendMessage(recipient._id, "wink", "😉")
      } catch (error) {
        console.error("Failed to send wink:", error)
        toast.error(error.message || "Failed to send wink")
      }
    }
  }

  // Trigger file input when attachment button is clicked
  const handleFileAttachment = () => {
    if (user?.accountTier === "FREE") {
      toast.error("Free accounts cannot send files. Upgrade to send files.")
      return
    }
    fileInputRef.current?.click()
  }

  // Handle file selection for attachment
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 5MB.")
      e.target.value = null
      return
    }

    // Validate file type
    const allowedTypes = [
      // Images
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      // Documents
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      // Audio
      "audio/mpeg",
      "audio/wav",
      // Video - be cautious with video size
      "video/mp4",
      "video/quicktime",
    ]

    if (!allowedTypes.includes(file.type)) {
      toast.error("File type not supported.")
      e.target.value = null
      return
    }

    setAttachment(file)
    toast.info(`Selected file: ${file.name}`)
    e.target.value = null
  }

  // Remove the current attachment
  const handleRemoveAttachment = () => {
    setAttachment(null)
    setUploadProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Handle video call
  const handleVideoCall = () => {
    if (user?.accountTier === "FREE") {
      toast.error("Free accounts cannot make video calls. Upgrade for video calls.")
      return
    }

    if (recipient && recipient._id) {
      initiateVideoCall(recipient._id)
      toast.info(`Starting video call with ${recipient.nickname}...`)
    } else {
      toast.error("Cannot start call: recipient information is missing")
    }
  }

  // Format time for messages
  const formatMessageTime = useCallback((timestamp) => {
    if (!timestamp) return ""
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } catch (e) {
      console.error("Error formatting time:", e)
      return ""
    }
  }, [])

  // Format the date for grouping messages
  const formatMessageDate = useCallback((timestamp) => {
    if (!timestamp) return "Unknown date"
    try {
      const date = new Date(timestamp)
      const today = new Date()
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      if (date.toDateString() === today.toDateString()) {
        return "Today"
      } else if (date.toDateString() === yesterday.toDateString()) {
        return "Yesterday"
      } else {
        return date.toLocaleDateString()
      }
    } catch (e) {
      console.error("Error formatting date:", e)
      return "Unknown date"
    }
  }, [])

  // Group messages by date
  const groupMessagesByDate = useCallback(() => {
    const groups = {}
    if (!Array.isArray(messagesData)) return groups

    messagesData.forEach((message) => {
      if (message && message.createdAt) {
        const date = formatMessageDate(message.createdAt)
        if (!groups[date]) groups[date] = []
        groups[date].push(message)
      }
    })
    return groups
  }, [messagesData, formatMessageDate])

  // Common emoji list
  const commonEmojis = ["😊", "😂", "😍", "❤️", "👍", "🙌", "🔥", "✨", "🎉", "🤔", "😉", "🥰"]

  // Handle emoji selection
  const handleEmojiClick = (emoji) => {
    setNewMessage((prev) => prev + emoji)
    setShowEmojis(false)
    chatInputRef.current?.focus()
  }

  // Determine if the recipient is typing
  const isTyping =
    recipient && typingUsers && typingUsers[recipient._id] && Date.now() - typingUsers[recipient._id] < 3000

  // Safely handle close event
  const handleClose = () => {
    if (typeof onClose === "function") {
      onClose()
    }
  }

  // If chat is not open, render nothing
  if (!isOpen) return null

  // Render file attachment message
  const renderFileMessage = (message) => {
    const { metadata } = message
    if (!metadata || !metadata.fileUrl) {
      return <p className="message-content">Attachment unavailable</p>
    }

    const isImage = metadata.fileType && metadata.fileType.startsWith("image/")

    return (
      <div className="file-message">
        {isImage ? (
          <img
            src={metadata.fileUrl || "/placeholder.svg"}
            alt={metadata.fileName || "Image"}
            className="image-attachment"
            onError={(e) => {
              e.target.onerror = null
              e.target.src = "/placeholder.svg"
            }}
          />
        ) : (
          <div className="file-attachment">
            {metadata.fileType && metadata.fileType.startsWith("video/") ? (
              <FaFileVideo className="file-icon" />
            ) : metadata.fileType && metadata.fileType.startsWith("audio/") ? (
              <FaFileAudio className="file-icon" />
            ) : metadata.fileType === "application/pdf" ? (
              <FaFilePdf className="file-icon" />
            ) : (
              <FaFileAlt className="file-icon" />
            )}
            <span className="file-name">{metadata.fileName || "File"}</span>
            <span className="file-size">{metadata.fileSize ? `(${Math.round(metadata.fileSize / 1024)} KB)` : ""}</span>
            <a
              href={metadata.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="download-link"
              onClick={(e) => e.stopPropagation()}
            >
              Download
            </a>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`embedded-chat ${embedded ? "embedded" : "standalone"}`}>
      {/* Chat Header */}
      <div className="chat-header">
        <div className="chat-user">
          {recipient.photos && recipient.photos.length > 0 ? (
            <img
              src={recipient.photos[0].url || "/placeholder.svg"}
              alt={recipient.nickname}
              className="chat-avatar"
              onError={(e) => {
                e.target.onerror = null
                e.target.src = "/placeholder.svg"
              }}
            />
          ) : (
            <div className="chat-avatar-placeholder" />
          )}
          <div className="chat-user-info">
            <h3>{recipient.nickname}</h3>
            <p className={recipient.isOnline ? "status-online" : "status-offline"}>
              {recipient.isOnline ? "Online" : "Offline"}
            </p>
          </div>
        </div>
        <div className="chat-header-actions">
          {user?.accountTier !== "FREE" && (
            <button
              className="video-call-btn"
              onClick={handleVideoCall}
              title="Start Video Call"
              aria-label="Start video call"
              disabled={isUploading || sendingMessage}
            >
              <FaVideo />
            </button>
          )}
          <button className="close-chat-btn" onClick={handleClose} aria-label="Close chat" title="Close chat">
            <FaTimes />
          </button>
        </div>
      </div>
      {user?.accountTier === "FREE" && (
        <div className="premium-banner">
          <FaCrown className="premium-icon" />
          <span>Upgrade to send messages and make video calls(you can still send heart)</span>
          <button className="upgrade-btn" onClick={() => navigate("/subscription")} aria-label="Upgrade to premium">
            Upgrade
          </button>
        </div>
      )}

      {/* Messages Container */}
      <div className="messages-container">
        {isLoading ? (
          <div className="loading-messages">
            <div className="spinner"></div>
            <p>Loading messages...</p>
          </div>
        ) : !messagesData || messagesData.length === 0 ? (
          <div className="no-messages">
            <p>No messages yet. Say hello!</p>
          </div>
        ) : (
          Object.entries(groupMessagesByDate()).map(([date, msgs]) => (
            <React.Fragment key={date}>
              <div className="message-date">{date}</div>
              {msgs.map((message) => (
                <div key={message._id} className={`message ${message.sender === user?._id ? "sent" : "received"}`}>
                  {message.type === "text" && (
                    <>
                      <p className="message-content">{message.content}</p>
                      <span className="message-time">
                        {formatMessageTime(message.createdAt)}
                        {message.sender === user?._id &&
                          (message.read ? (
                            <FaCheckDouble className="read-indicator" />
                          ) : (
                            <FaCheck className="read-indicator" />
                          ))}
                      </span>
                    </>
                  )}
                  {message.type === "wink" && (
                    <div className="wink-message">
                      <p className="message-content">😉</p>
                      <span className="message-label">Wink</span>
                    </div>
                  )}
                  {message.type === "video" && (
                    <div className="video-call-message">
                      <FaVideo className="video-icon" />
                      <p className="message-content">Video Call</p>
                      <span className="message-time">{formatMessageTime(message.createdAt)}</span>
                    </div>
                  )}
                  {message.type === "file" && renderFileMessage(message)}
                </div>
              ))}
            </React.Fragment>
          ))
        )}
        {isTyping && (
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
        {messageError && (
          <div className="message-error">
            <p>{messageError}</p>
            <button onClick={clearError} aria-label="Dismiss error">
              <FaTimes />
            </button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment Preview */}
      {attachment && (
        <div className="attachment-preview">
          <div className="attachment-info">
            {getFileIcon(attachment)}
            <span className="attachment-name">{attachment.name}</span>
            <span className="attachment-size">({Math.round(attachment.size / 1024)} KB)</span>
          </div>
          {isUploading ? (
            <div className="upload-progress-container">
              <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }}></div>
              <span className="upload-progress-text">{uploadProgress}%</span>
            </div>
          ) : (
            <button className="remove-attachment" onClick={handleRemoveAttachment} disabled={isUploading}>
              <FaTimes />
            </button>
          )}
        </div>
      )}

      {/* Message Input Form */}
      <form className="message-input" onSubmit={handleSendMessage}>
        <button
          type="button"
          className="input-emoji"
          onClick={() => setShowEmojis(!showEmojis)}
          title="Add Emoji"
          aria-label="Add emoji"
          disabled={isUploading || sendingMessage}
        >
          <FaSmile />
        </button>
        {showEmojis && (
          <div className="emoji-picker">
            <div className="emoji-header">
              <h4>Emojis</h4>
              <button onClick={() => setShowEmojis(false)} aria-label="Close emoji picker">
                <FaTimes />
              </button>
            </div>
            <div className="emoji-list">
              {commonEmojis.map((emoji) => (
                <button key={emoji} type="button" onClick={() => handleEmojiClick(emoji)} aria-label={`Emoji ${emoji}`}>
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
        <input
          type="text"
          placeholder={user?.accountTier === "FREE" ? "Free users can only send winks" : "Type a message..."}
          value={newMessage}
          onChange={handleTyping}
          ref={chatInputRef}
          disabled={sendingMessage || isUploading || user?.accountTier === "FREE"}
          aria-label="Message input"
          title={user?.accountTier === "FREE" ? "Upgrade to send text messages" : "Type a message"}
        />
        <button
          type="button"
          className="input-attachment"
          onClick={handleFileAttachment}
          disabled={sendingMessage || isUploading || user?.accountTier === "FREE"}
          title={user?.accountTier === "FREE" ? "Upgrade to send files" : "Attach File"}
          aria-label="Attach file"
        >
          <FaPaperclip />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
          aria-hidden="true"
          accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,audio/mpeg,audio/wav,video/mp4,video/quicktime"
        />
        <button
          type="button"
          className="input-wink"
          onClick={handleSendWink}
          disabled={sendingMessage || isUploading}
          title="Send Wink"
          aria-label="Send wink"
        >
          <FaHeart />
        </button>
        <button
          type="submit"
          className="input-send"
          disabled={(!newMessage.trim() && !attachment) || sendingMessage || isUploading}
          title="Send Message"
          aria-label="Send message"
        >
          {sendingMessage || isUploading ? <FaSpinner className="fa-spin" /> : <FaPaperPlane />}
        </button>
      </form>
    </div>
  )
}

export default EmbeddedChat
