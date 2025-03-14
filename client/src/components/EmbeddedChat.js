"use client"

// client/src/components/EmbeddedChat.js
import React, { useState, useEffect, useRef } from "react"
import {
  FaSmile,
  FaPaperPlane,
  FaPaperclip,
  FaTimes,
  FaCheckDouble,
  FaCheck,
  FaVideo,
  FaSpinner,
  FaEllipsisH,
} from "react-icons/fa"
import { useAuth, useChat } from "../context"
import { toast } from "react-toastify"

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
    markMessageRead,
  } = useChat()

  const [newMessage, setNewMessage] = useState("")
  const [showEmojis, setShowEmojis] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [attachment, setAttachment] = useState(null)
  const [showReactionMenu, setShowReactionMenu] = useState(null)

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
        .then(() => {
          if (isMounted) setIsLoading(false)
        })
        .catch((err) => {
          console.error("Failed to load messages:", err)
          if (isMounted) setIsLoading(false)
        })
    }

    return () => {
      isMounted = false
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
    }
  }, [])

  // Handle sending a text message
  const handleSendMessage = async (e) => {
    e?.preventDefault()
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
      setAttachment(file)
      // TODO: Implement file uploading via your chat context if desired.
      toast.info(`Selected file: ${file.name}`)
      e.target.value = null
    }
  }

  // Trigger file input when attachment button is clicked
  const handleFileAttachment = () => {
    fileInputRef.current?.click()
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

  // Handle message reaction
  const handleReaction = async (messageId, emoji) => {
    try {
      // This would call a method in your chat context to add a reaction
      // await addMessageReaction(messageId, emoji);
      toast.info(`Reaction added: ${emoji}`)
      setShowReactionMenu(null)
    } catch (error) {
      console.error("Failed to add reaction:", error)
      toast.error("Failed to add reaction")
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

  // Reaction emojis
  const reactionEmojis = ["👍", "❤️", "😂", "😮", "😢", "😠"]

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
                      <div className="message-footer">
                        <span className="message-time">
                          {formatMessageTime(message.createdAt)}
                          {message.sender === user?._id &&
                            (message.read ? (
                              <FaCheckDouble className="read-indicator" />
                            ) : (
                              <FaCheck className="read-indicator" />
                            ))}
                        </span>

                        {/* Message reactions display */}
                        {message.reactions && message.reactions.length > 0 && (
                          <div className="message-reactions">
                            {message.reactions.map((reaction, index) => (
                              <span key={index} className="reaction-emoji">
                                {reaction}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  {message.type === "wink" && (
                    <div className="wink-message">
                      <span role="img" aria-label="Wink">
                        {message.content}
                      </span>
                      <div className="message-footer">
                        <span className="message-time">{formatMessageTime(message.createdAt)}</span>
                      </div>
                    </div>
                  )}
                  <div className="reaction-menu">
                    {showReactionMenu === message._id && (
                      <div className="reaction-options">
                        {reactionEmojis.map((emoji, index) => (
                          <span
                            key={index}
                            className="reaction-option"
                            onClick={() => handleReaction(message._id, emoji)}
                          >
                            {emoji}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="typing-indicator">
                  {recipient.nickname} is typing...
                  <FaEllipsisH className="typing-dots" />
                </div>
              )}
            </React.Fragment>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <form className="chat-input" onSubmit={handleSendMessage}>
        <div className="input-container">
          <button
            type="button"
            className="emoji-btn"
            onClick={() => setShowEmojis(!showEmojis)}
            aria-label="Toggle emojis"
            title="Toggle emojis"
          >
            <FaSmile />
          </button>

          <input
            type="text"
            ref={chatInputRef}
            placeholder="Type a message..."
            value={newMessage}
            onChange={handleTyping}
            aria-label="Message input"
          />

          <button
            type="button"
            className="attach-btn"
            onClick={handleFileAttachment}
            aria-label="Attach file"
            title="Attach file"
          >
            <FaPaperclip />
          </button>
          <input
            type="file"
            style={{ display: "none" }}
            onChange={handleFileChange}
            ref={fileInputRef}
            aria-label="File input"
          />
        </div>

        {showEmojis && (
          <div className="emojis-panel">
            <div className="emojis-scroll">
              {commonEmojis.map((emoji, index) => (
                <span key={index} className="emoji" onClick={() => handleEmojiClick(emoji)}>
                  {emoji}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          className="send-btn"
          onClick={handleSendMessage}
          aria-label="Send message"
          title="Send message"
          disabled={sendingMessage}
        >
          {sendingMessage ? <FaSpinner className="spinner" /> : <FaPaperPlane />}
        </button>
      </form>
    </div>
  )
}

export default EmbeddedChat
