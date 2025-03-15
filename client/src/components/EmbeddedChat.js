"use client"

import React, { useState, useEffect, useRef } from "react"
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
} from "react-icons/fa"
import { useAuth, useChat } from "../context"
import { toast } from "react-toastify"
import apiService from "../services/apiService"

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
  } = useChat()

  const [newMessage, setNewMessage] = useState("")
  const [showEmojis, setShowEmojis] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [attachment, setAttachment] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const messagesEndRef = useRef(null)
  const chatInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  // Load messages when chat is opened with the recipient
  useEffect(() => {
    if (recipient && isOpen) {
      setIsLoading(true)
      getMessages(recipient._id)
        .then(() => setIsLoading(false))
        .catch((err) => {
          console.error("Failed to load messages:", err)
          setIsLoading(false)
          toast.error("Failed to load messages. Please try again.")
        })
    }
  }, [recipient, isOpen, getMessages])

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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
      // Clear any uploads in progress
      if (isUploading) {
        // In a production environment, you might want to cancel any ongoing uploads
        setIsUploading(false)
      }
    }
  }, [isUploading])

  // Get the file icon based on file type
  const getFileIcon = (file) => {
    if (!file) return <FaFile />;

    const fileType = file.type;
    if (fileType.startsWith('image/')) return <FaImage />;
    if (fileType.startsWith('video/')) return <FaFileVideo />;
    if (fileType.startsWith('audio/')) return <FaFileAudio />;
    if (fileType === 'application/pdf') return <FaFilePdf />;
    return <FaFileAlt />;
  };

  // Handle sending a text message
  const handleSendMessage = async (e) => {
    e?.preventDefault()

    // If there's an attachment, handle it first
    if (attachment) {
      try {
        setIsUploading(true)

        // Create a FormData object for the file upload
        const formData = new FormData()
        formData.append("file", attachment)
        formData.append("recipient", recipient._id)

        // Upload the file using apiService
        const response = await apiService.upload("/messages/attachments", formData, (progress) => {
          setUploadProgress(progress)
        })

        if (response.success) {
          // Send a message with the attachment reference
          await sendMessage(recipient._id, "file", attachment.name, {
            fileUrl: response.data.url,
            fileType: attachment.type,
            fileName: attachment.name,
            fileSize: attachment.size
          })

          toast.success("File sent successfully")
        } else {
          throw new Error(response.error || "Failed to upload file")
        }
      } catch (error) {
        console.error("Failed to upload attachment:", error)
        toast.error(error.message || "Failed to send file. Please try again.")
      } finally {
        setIsUploading(false)
        setUploadProgress(0)
        setAttachment(null)
      }
      return
    }

    if (newMessage.trim() && !sendingMessage && recipient) {
      try {
        await sendMessage(recipient._id, "text", newMessage.trim())
        setNewMessage("")
      } catch (error) {
        console.error("Failed to send message:", error)
        toast.error(error.message || "Failed to send message")
      }
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

  // Handle file selection for attachment
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File is too large. Maximum size is 5MB.")
        e.target.value = null
        return
      }

      // Validate file type
      const allowedTypes = [
        // Images
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
        // Documents
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        // Audio
        'audio/mpeg', 'audio/wav',
        // Video - be cautious with video size
        'video/mp4', 'video/quicktime'
      ];

      if (!allowedTypes.includes(file.type)) {
        toast.error("File type not supported.")
        e.target.value = null
        return
      }

      setAttachment(file)
      toast.info(`Selected file: ${file.name}`)
      e.target.value = null
    }
  }

  // Trigger file input when attachment button is clicked
  const handleFileAttachment = () => {
    fileInputRef.current?.click()
  }

  // Remove the current attachment
  const handleRemoveAttachment = () => {
    setAttachment(null)
    setUploadProgress(0)
  }

  // Handle video call
  const handleVideoCall = () => {
    if (recipient && recipient._id) {
      initiateVideoCall(recipient._id)
      toast.info(`Starting video call with ${recipient.nickname}...`)
    } else {
      toast.error("Cannot start call: recipient information is missing")
    }
  }

  // Format time for messages
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return ""
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  // Format the date for grouping messages
  const formatMessageDate = (timestamp) => {
    if (!timestamp) return "Unknown date"
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
  }

  // Group messages by date
  const groupMessagesByDate = () => {
    const groups = {}
    if (!Array.isArray(messages)) return groups
    messages.forEach((message) => {
      if (message && message.createdAt) {
        const date = formatMessageDate(message.createdAt)
        if (!groups[date]) groups[date] = []
        groups[date].push(message)
      }
    })
    return groups
  }

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

  // If chat is not open, render nothing
  if (!isOpen) return null

  // Render file attachment message
  const renderFileMessage = (message) => {
    const { metadata } = message;
    if (!metadata || !metadata.fileUrl) {
      return <p className="message-content">Attachment unavailable</p>;
    }

    const isImage = metadata.fileType && metadata.fileType.startsWith('image/');

    return (
      <div className="file-message">
        {isImage ? (
          <img
            src={metadata.fileUrl}
            alt={metadata.fileName || "Image"}
            className="image-attachment"
          />
        ) : (
          <div className="file-attachment">
            {metadata.fileType && metadata.fileType.startsWith('video/') ? (
              <FaFileVideo className="file-icon" />
            ) : metadata.fileType && metadata.fileType.startsWith('audio/') ? (
              <FaFileAudio className="file-icon" />
            ) : metadata.fileType === 'application/pdf' ? (
              <FaFilePdf className="file-icon" />
            ) : (
              <FaFileAlt className="file-icon" />
            )}
            <span className="file-name">{metadata.fileName || "File"}</span>
            <span className="file-size">
              {metadata.fileSize ? `(${Math.round(metadata.fileSize / 1024)} KB)` : ""}
            </span>
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
    );
  };

  return (
    <div className={`embedded-chat ${embedded ? "embedded" : "standalone"}`}>
      {/* Chat Header */}
      <div className="chat-header">
        <div className="chat-user">
          {recipient.photos && recipient.photos.length > 0 ? (
            <img src={recipient.photos[0].url || "/placeholder.svg"} alt={recipient.nickname} className="chat-avatar" />
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
          <button
            className="video-call-btn"
            onClick={handleVideoCall}
            title="Start Video Call"
            aria-label="Start video call"
          >
            <FaVideo />
          </button>
          <button className="close-chat-btn" onClick={onClose} aria-label="Close chat" title="Close chat">
            <FaTimes />
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="messages-container">
        {isLoading ? (
          <div className="loading-messages">
            <div className="spinner"></div>
            <p>Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
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
            <button className="remove-attachment" onClick={handleRemoveAttachment}>
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
          disabled={isUploading}
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
          placeholder="Type a message..."
          value={newMessage}
          onChange={handleTyping}
          ref={chatInputRef}
          disabled={sendingMessage || isUploading}
          aria-label="Message input"
        />
        <button
          type="button"
          className="input-attachment"
          onClick={handleFileAttachment}
          disabled={sendingMessage || isUploading}
          title="Attach File"
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
