"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
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
  FaLock,
  FaPhoneSlash,
  FaPhone,
  FaSync
} from "react-icons/fa"
import { useAuth } from "../context"
import { useNavigate } from "react-router-dom"
import VideoCall from "./VideoCall"
import "../styles/video-call.css"
import { toast } from "react-toastify"

// Import common components
import { Button, Avatar, LoadingSpinner, LoadingState, ErrorMessage, withErrorBoundary } from "./common"
// Import hooks and utilities
import { useApi, useMounted, useChatMessages } from "../hooks"
import { formatDate, logger, normalizePhotoUrl } from "../utils"
import { groupMessagesByDate, classNames, getFileIconType, commonEmojis } from "../utils/chatUtils"
// Keep direct import for socket service for compatibility during refactoring
import socketService from "../services/socketService.jsx"

// Create contextual logger
const log = logger.create('EmbeddedChat')

// Add CSS for the pulse animation
const pulseStyle = document.createElement("style")
pulseStyle.textContent = `
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }
  .pulse {
    animation: pulse 1s infinite;
  }
`
document.head.appendChild(pulseStyle)

/**
 * EmbeddedChat component - Handles real-time messaging with a recipient
 * 
 * This component provides a full-featured chat interface with:
 * - Real-time messaging using socket.io
 * - Message read receipts
 * - File uploads and media sharing
 * - Typing indicators
 * - Emoji support
 * - Video calling
 * 
 * Uses the useChatMessages hook for messaging functionality
 * 
 * @param {Object} props - Component props
 * @param {Object} props.recipient - The user object to chat with
 * @param {boolean} props.isOpen - Whether the chat is open/visible
 * @param {Function} props.onClose - Function to call when the close button is clicked
 * @param {boolean} props.embedded - Whether the chat is embedded in another component
 * @returns {React.ReactElement} The embedded chat component
 */
const EmbeddedChat = ({ recipient, isOpen, onClose, embedded = true }) => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { isMounted } = useMounted()
  const api = useApi()
  
  // Get a stable recipient ID
  const recipientId = useMemo(() => recipient?._id, [recipient?._id]);
  
  // Use the chat messages hook with stable ID reference
  const {
    messages: messagesData,
    loading: isLoading,
    error: messageError,
    isTyping: typingIndicator,
    sendMessage,
    sendTypingIndicator,
    markMessagesAsRead,
    loadMessages,
    clearError,
    sendFileMessage
  } = useChatMessages(recipientId)

  // Local state for chat and attachments
  const [newMessage, setNewMessage] = useState("")
  const [showEmojis, setShowEmojis] = useState(false)
  const [attachment, setAttachment] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [pendingPhotoRequests, setPendingPhotoRequests] = useState(0)
  const [isApprovingRequests, setIsApprovingRequests] = useState(false)
  const [requestsData, setRequestsData] = useState([])
  const [sending, setSending] = useState(false)

  // Video call state
  const [activeCall, setActiveCall] = useState(false)
  const [isCallInitiator, setIsCallInitiator] = useState(false)
  const [incomingCall, setIncomingCall] = useState(null)
  const [callError, setCallError] = useState(null)

  // Refs for DOM and socket
  const messagesEndRef = useRef(null)
  const chatInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const socketRef = useRef(null)

  // Set up socket reference on mount
  useEffect(() => {
    if (socketService.socket) {
      log.debug("Socket reference obtained")
      socketRef.current = socketService.socket

      // Handle call answered events
      const handleCallAnswered = (data) => {
        log.debug("Call answer received:", data)
        if (data.accept) {
          log.debug("Call was accepted")
        } else {
          log.debug("Call was rejected")
          if (activeCall) {
            setActiveCall(false)
            toast.info("Call was declined")
          }
        }
      }
      socketRef.current.on("callAnswered", handleCallAnswered)

      return () => {
        if (socketRef.current) {
          socketRef.current.off("callAnswered", handleCallAnswered)
        }
      }
    } else {
      log.warn("Socket connection not available", socketService)
    }
  }, [activeCall])

  // Manual refresh function for user-initiated refreshes
  const refreshMessages = useCallback(() => {
    if (isOpen && recipient?._id) {
      log.debug('Manual message refresh requested');
      loadMessages();
    }
  }, [isOpen, recipient, loadMessages]);
  
  // We no longer need a separate useEffect to load messages when chat opens
  // because the useChatMessages hook will handle the initial load
  // This prevents duplicate loading and infinite loops

  // Incoming call handler
  const handleIncomingCall = useCallback(
    (data) => {
      try {
        if (!data) {
          log.error("Received empty call data")
          return
        }
        log.debug("Incoming call received:", data)
        const callerId =
          (data.caller && (data.caller.userId || data.caller._id)) ||
          data.userId ||
          (data.from && data.from.userId)
        if (!callerId) {
          log.error("Caller ID not found in incoming call data", data)
          return
        }
        setIncomingCall(data)
        log.debug("Incoming call state set", data)
      } catch (error) {
        log.error("Error handling incoming call:", error)
      }
    },
    [recipient]
  )

  // Setup incoming call listener
  useEffect(() => {
    if (!socketRef.current) {
      log.warn("No socket available for incoming call handling")
      return
    }
    const handleIncomingCallEvent = (data) => {
      log.debug("Incoming call event received:", data)
      handleIncomingCall(data)
    }
    socketRef.current.on("incomingCall", handleIncomingCallEvent)
    return () => {
      if (socketRef.current) {
        socketRef.current.off("incomingCall", handleIncomingCallEvent)
      }
    }
  }, [recipient, handleIncomingCall])

  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messagesData])

  // Focus chat input when chat opens
  useEffect(() => {
    if (isOpen && recipient) {
      setTimeout(() => chatInputRef.current?.focus(), 300)
    }
  }, [isOpen, recipient])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      if (isUploading) {
        setIsUploading(false)
        setAttachment(null)
        setUploadProgress(0)
      }
    }
  }, [isUploading])

  // ------------------ Video Call Integration ------------------

  // Initiate video call handler
  const handleVideoCall = () => {
    if (user?.accountTier === "FREE") {
      log.error("Free accounts cannot make video calls. Upgrade for video calls.")
      toast.error("Upgrade to make video calls")
      return
    }
    if (!socketRef.current) {
      log.error("Cannot start call: No connection available")
      toast.error("Cannot connect to video service")
      return
    }
    if (activeCall) {
      log.debug("Call already in progress")
      return
    }
    if (recipient?._id) {
      log.debug(`Starting video call with ${recipient.nickname}...`)
      setIsCallInitiator(true)
      setActiveCall(true)
      socketRef.current.emit("initiateCall", {
        recipientId: recipient._id,
        callType: "video",
        userId: user._id,
        callId: `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        caller: { userId: user._id, name: user.nickname || "User" },
      })
      // Send a message about the video call
      sendMessage("Video Call", "video")
        .catch((error) => {
          log.error("Failed to send video call message:", error)
        })
    } else {
      log.error("Cannot start call: recipient information is missing")
      toast.error("Cannot start call: missing recipient information")
    }
  }

  // Accept incoming call
  const handleAcceptCall = () => {
    log.debug("Accepting incoming call", incomingCall)
    if (!incomingCall) {
      log.error("No incoming call to accept")
      return
    }
    if (!socketRef.current) {
      log.error("Cannot accept call: No socket connection available")
      toast.error("Cannot connect to video service")
      return
    }
    const callerId = incomingCall.caller?.userId || incomingCall.userId
    if (!callerId) {
      log.error("Cannot accept call: No caller ID found")
      toast.error("Cannot accept call: Invalid call data")
      return
    }
    socketRef.current.emit("answerCall", {
      callerId,
      accept: true,
      callId: incomingCall.callId,
      timestamp: Date.now(),
    })
    log.debug(`Accepting call from ${incomingCall.caller?.name || "caller"} with ID ${callerId}`)
    setActiveCall(true)
    setIsCallInitiator(false)
    setIncomingCall(null)
  }

  // Reject incoming call
  const handleRejectCall = () => {
    log.debug("Rejecting incoming call", incomingCall)
    if (!incomingCall) {
      log.error("No incoming call to reject")
      return
    }
    if (!socketRef.current) {
      log.error("Cannot reject call: No socket connection available")
      return
    }
    const callerId = incomingCall.caller?.userId || incomingCall.userId
    if (!callerId) {
      log.error("Cannot reject call: No caller ID found")
      return
    }
    socketRef.current.emit("answerCall", {
      callerId,
      accept: false,
      callId: incomingCall.callId,
      timestamp: Date.now(),
    })
    log.debug(`Rejecting call from ${incomingCall.caller?.name || "caller"} with ID ${callerId}`)
    setIncomingCall(null)
  }

  // End the active video call
  const handleEndCall = useCallback(() => {
    setActiveCall(false)
  }, [])

  // Capture any errors from VideoCall
  const handleCallError = useCallback((error) => {
    setCallError(error.message || "Call failed")
    log.error("Call error:", error)
    setActiveCall(false)
  }, [])

  // ------------------ End Video Call Integration ------------------

  // ------------------ Message & Attachment Handlers ------------------

  // Utility for file icon using shared getFileIconType helper
  const getFileIcon = useCallback((file) => {
    if (!file) return <FaFile />;
    const fileType = file.type || "";
    const iconType = getFileIconType(fileType);
    
    switch (iconType) {
      case 'image': return <FaImage />;
      case 'video': return <FaFileVideo />;
      case 'audio': return <FaFileAudio />;
      case 'pdf': return <FaFilePdf />;
      default: return <FaFileAlt />;
    }
  }, [])

  // Use the shared utility function to group messages by date
  const getMessageGroups = useCallback(() => {
    return groupMessagesByDate(messagesData);
  }, [messagesData])

  // Use shared emoji list from utils
  // No need to redefine this list as it's imported from utils as commonEmojis

  const handleEmojiClick = (emoji) => {
    setNewMessage((prev) => prev + emoji)
    setShowEmojis(false)
    chatInputRef.current?.focus()
  }

  // Handle typing
  const handleTyping = (e) => {
    setNewMessage(e.target.value)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)

    // Only send typing events if input has content and we have recipient
    typingTimeoutRef.current = setTimeout(() => {
      if (e.target.value.trim() && recipient?._id) {
        sendTypingIndicator()
      }
    }, 300)
  }

  // Send a message
  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (attachment) return handleSendAttachment()
    if (newMessage.trim() && !sending && recipient?._id) {
      if (user?.accountTier === "FREE" && newMessage.trim() !== "😉") {
        toast.error("Free accounts can only send winks. Upgrade to send messages.")
        return
      }
      try {
        setSending(true)
        await sendMessage(newMessage.trim(), "text")
        setNewMessage("")
      } catch (error) {
        log.error("Failed to send message:", error)
        toast.error(error.message || "Failed to send message")
      } finally {
        setSending(false)
      }
    }
  }

  // Send attachment message
  const handleSendAttachment = async () => {
    if (!attachment || !recipient?._id || isUploading) return
    setIsUploading(true)
    
    try {
      // Update progress handler
      const onProgress = (progress) => {
        if (isMounted()) {
          setUploadProgress(progress)
        }
      }
      
      // Use the hook's sendFileMessage method which handles validation
      const response = await sendFileMessage(attachment, onProgress)
      
      if (!response) {
        // This can happen due to validation errors in the hook
        toast.error(messageError || "Failed to send file. Please try again.")
        throw new Error('File upload failed')
      }
      
      log.debug("File sent successfully")
      
      // Clear the attachment state
      setAttachment(null)
      setUploadProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ""
    } catch (error) {
      log.error("Failed to send file:", error)
      if (!messageError) { // Only show toast if the hook didn't already set an error
        toast.error(error.message || "Failed to send file. Please try again.")
      }
    } finally {
      if (isMounted()) {
        setIsUploading(false)
      }
    }
  }

  // Send wink message
  const handleSendWink = async () => {
    if (!sending && recipient?._id) {
      try {
        setSending(true)
        await sendMessage("😉", "wink")
      } catch (error) {
        log.error("Failed to send wink:", error)
        toast.error(error.message || "Failed to send wink")
      } finally {
        setSending(false)
      }
    }
  }

  // Handle file attachment
  const handleFileAttachment = () => {
    if (user?.accountTier === "FREE") {
      toast.error("Free accounts cannot send files. Upgrade to send files.")
      return
    }
    fileInputRef.current?.click()
  }

  // Handle file input change
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Set the file directly - validation happens in the hook
    setAttachment(file)
    log.debug(`Selected file: ${file.name}`)
    e.target.value = null
  }

  // Remove attached file
  const handleRemoveAttachment = () => {
    setAttachment(null)
    setUploadProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // ------------------ Approve Photo Requests ------------------
  const handleApproveAllRequests = async () => {
    setIsApprovingRequests(true)
    try {
      if (requestsData.length > 0) {
        const results = await Promise.allSettled(
          requestsData.map((request) =>
            api.put(`/users/photos/permissions/${request._id}`, {
              status: "approved",
            })
          )
        )
        const successCount = results.filter(
          (result) => result.status === "fulfilled" && result.value
        ).length
        if (successCount > 0) {
          log.debug(`Approved ${successCount} photo request${successCount !== 1 ? "s" : ""}`)
          const systemMessage = {
            _id: Date.now().toString(),
            sender: "system",
            content: `Photo access approved for ${successCount} photo${successCount !== 1 ? "s" : ""}.`,
            createdAt: new Date().toISOString(),
            type: "system",
          }
          // Using the sendMessage from hook to inform recipient
          await sendMessage(`I've approved your request to view my private photos.`, "text")
          setPendingPhotoRequests(0)
          setRequestsData([])
        } else {
          toast.error("Failed to approve photo requests")
        }
      } else {
        const response = await api.post(`/users/photos/approve-all`, {
          requesterId: recipient._id,
        })
        if (response) {
          const approvedCount = response.approvedCount || 1
          log.debug(`Approved ${approvedCount} photo request${approvedCount !== 1 ? "s" : ""}`)
          
          // Using the sendMessage from hook to inform recipient
          await sendMessage(`I've approved your request to view my private photos.`, "text")
          setPendingPhotoRequests(0)
        } else {
          throw new Error("Approval failed")
        }
      }
    } catch (error) {
      log.error("Error approving photo requests:", error)
      toast.error("Error approving photo requests. Please try again.")
    } finally {
      if (isMounted()) {
        setIsApprovingRequests(false)
      }
    }
  }

  // ------------------ End Message Handlers ------------------

  if (!isOpen) return null

  return (
    <div className={classNames('embedded-chat', embedded ? 'embedded' : 'standalone')}>
      {/* Video Call Integration */}
      {activeCall && socketRef.current ? (
        <VideoCall
          isInitiator={isCallInitiator}
          remoteUserId={recipient._id}
          remoteUserName={recipient.nickname}
          onClose={handleEndCall}
          socket={socketRef.current}
          onError={handleCallError}
        />
      ) : activeCall ? (
        <div className="video-call-error">
          <h3>Cannot start video call</h3>
          <p>Connection not available. Please try again later.</p>
          <Button onClick={handleEndCall} variant="danger">
            Close
          </Button>
        </div>
      ) : null}

      <div className="chat-header">
        <div className="chat-user">
          <Avatar 
            src={recipient?.photos?.length ? recipient.photos[0].url : null}
            alt={recipient?.nickname}
            size="small"
            className="chat-avatar"
            status={recipient?.isOnline ? "online" : null}
          />
          <div className="chat-user-info">
            <h3>{recipient?.nickname}</h3>
            <p className={recipient?.isOnline ? "status-online" : "status-offline"}>
              {recipient?.isOnline ? "Online" : "Offline"}
            </p>
          </div>
        </div>
        <div className="chat-header-actions">
          <Button
            className="photo-request-btn"
            onClick={handleApproveAllRequests}
            icon={isApprovingRequests ? <FaSpinner className="fa-spin" /> : <FaLock />}
            aria-label="Approve photo requests"
            variant="light"
            size="small"
            disabled={isApprovingRequests}
          >
            <span className="request-badge">!</span>
          </Button>
          {user?.accountTier !== "FREE" && !activeCall && (
            <Button
              className="video-call-btn"
              onClick={handleVideoCall}
              icon={<FaVideo />}
              aria-label="Start video call"
              variant="light"
              size="small"
              disabled={isUploading || sending || activeCall}
            />
          )}
          <Button 
            className="close-chat-btn" 
            onClick={onClose} 
            icon={<FaTimes />}
            aria-label="Close chat" 
            variant="light"
            size="small"
          />
        </div>
      </div>

      {/* Incoming Call Banner */}
      {incomingCall && (
        <div className="incoming-call-banner">
          <div className="incoming-call-info">
            <FaVideo className="call-icon pulse" />
            <span>{recipient?.nickname || "Someone"} is calling you</span>
          </div>
          <div className="incoming-call-actions">
            <Button
              className="decline-call-btn"
              onClick={handleRejectCall}
              icon={<FaPhoneSlash />}
              variant="danger"
              size="small"
              aria-label="Decline call"
            />
            <Button
              className="accept-call-btn"
              onClick={handleAcceptCall}
              icon={<FaPhone />}
              variant="success"
              size="small"
              aria-label="Accept call"
            />
          </div>
        </div>
      )}

      {user?.accountTier === "FREE" && (
        <div className="premium-banner">
          <FaCrown className="premium-icon" />
          <span>Upgrade to send messages and make video calls (you can still send heart)</span>
          <Button 
            className="upgrade-btn" 
            onClick={() => navigate("/subscription")}
            variant="primary"
            size="small"
          >
            Upgrade
          </Button>
        </div>
      )}

      <div className="messages-container">
        <div className="messages-header">
          <Button
            className="refresh-messages-btn"
            onClick={refreshMessages}
            disabled={isLoading}
            icon={isLoading ? <FaSpinner className="fa-spin" /> : <FaSync />}
            title="Refresh messages"
            aria-label="Refresh messages"
            variant="light"
            size="small"
          />
        </div>
        
        <LoadingState 
          isLoading={isLoading}
          error={messageError}
          loadingText="Loading messages..."
          size="medium"
          spinnerProps={{ centered: true }}
          showChildrenAfterLoad={true}
          onRetry={refreshMessages}
          renderError={(error, retry) => (
            <div className="message-error">
              <ErrorMessage
                message={error}
                title="Error Loading Messages"
                type="error"
                onDismiss={clearError}
                showIcon={true}
              />
              <Button
                onClick={retry}
                variant="primary"
                size="small"
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          )}
        >
          {!messagesData || messagesData.length === 0 ? (
            <div className="no-messages">
              <p>No messages yet. Say hello!</p>
            </div>
          ) : (
          Object.entries(getMessageGroups()).map(([date, msgs]) => (
            <React.Fragment key={date}>
              <div className="message-date">{date}</div>
              {msgs.map((message) => {
                // Make sure we're comparing strings with strings or IDs with IDs
                const isSentByCurrentUser = user && message.sender &&
                  (message.sender === user._id ||
                   (typeof message.sender === 'object' && message.sender._id === user._id));

                return (
                  <div
                    key={message._id}
                    className={classNames(
                      'message',
                      isSentByCurrentUser ? 'sent' : 'received',
                      message.type === 'system' ? 'system-message' : ''
                    )}
                  >
                    {message.type === "text" && (
                      <>
                        <p className="message-content">{message.content}</p>
                        <span className="message-time">
                          {formatDate(message.createdAt, { showTime: true, showDate: false })}
                          {isSentByCurrentUser &&
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
                        <span className="message-time">
                          {formatDate(message.createdAt, { showTime: true, showDate: false })}
                        </span>
                      </div>
                    )}
                    {message.type === "file" && (
                      <div className="file-message">
                        {message.metadata?.fileUrl ? (
                          message.metadata.fileType?.startsWith("image/") ? (
                            <img
                              src={normalizePhotoUrl(message.metadata.fileUrl)}
                              alt={message.metadata.fileName || "Image"}
                              className="image-attachment"
                            />
                          ) : (
                            <div className="file-attachment">
                              {message.metadata.fileType?.startsWith("video/") ? (
                                <FaFileVideo className="file-icon" />
                              ) : message.metadata.fileType?.startsWith("audio/") ? (
                                <FaFileAudio className="file-icon" />
                              ) : message.metadata.fileType === "application/pdf" ? (
                                <FaFilePdf className="file-icon" />
                              ) : (
                                <FaFileAlt className="file-icon" />
                              )}
                              <span className="file-name">{message.metadata.fileName || "File"}</span>
                              <span className="file-size">
                                {message.metadata.fileSize ? `(${Math.round(message.metadata.fileSize / 1024)} KB)` : ""}
                              </span>
                              <Button
                                href={message.metadata.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="download-link"
                                onClick={(e) => e.stopPropagation()}
                                variant="link"
                                size="small"
                              >
                                Download
                              </Button>
                            </div>
                          )
                        ) : (
                          <p className="message-content">Attachment unavailable</p>
                        )}
                      </div>
                    )}
                    {message.type === "system" && (
                      <div className="system-message-content">
                        <p>{message.content}</p>
                        <span className="message-time">
                          {formatDate(message.createdAt, { showTime: true, showDate: false })}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))
          )}
          
          {recipient && typingIndicator && (
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </LoadingState>
      </div>

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
            <Button
              className="remove-attachment"
              onClick={handleRemoveAttachment}
              disabled={isUploading}
              icon={<FaTimes />}
              variant="light"
              size="small"
              aria-label="Remove attachment"
            />
          )}
        </div>
      )}

      <form className="message-input" onSubmit={handleSendMessage}>
        <Button
          type="button"
          className="input-emoji"
          onClick={() => setShowEmojis(!showEmojis)}
          icon={<FaSmile />}
          aria-label="Add emoji"
          variant="light"
          size="small"
          disabled={isUploading || sending}
        />
        
        {showEmojis && (
          <div className="emoji-picker">
            <div className="emoji-header">
              <h4>Emojis</h4>
              <Button 
                onClick={() => setShowEmojis(false)} 
                icon={<FaTimes />}
                aria-label="Close emoji picker"
                variant="light"
                size="small"
              />
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
          disabled={sending || isUploading || user?.accountTier === "FREE"}
          aria-label="Message input"
          title={user?.accountTier === "FREE" ? "Upgrade to send text messages" : "Type a message"}
        />
        
        <Button
          type="button"
          className="input-attachment"
          onClick={handleFileAttachment}
          disabled={sending || isUploading || user?.accountTier === "FREE"}
          icon={<FaPaperclip />}
          title={user?.accountTier === "FREE" ? "Upgrade to send files" : "Attach File"}
          aria-label="Attach file"
          variant="light"
          size="small"
        />
        
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
          aria-hidden="true"
          accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,audio/mpeg,audio/wav,video/mp4,video/quicktime"
        />
        
        <Button
          type="button"
          className="input-wink"
          onClick={handleSendWink}
          disabled={sending || isUploading}
          icon={<FaHeart />}
          title="Send Wink"
          aria-label="Send wink"
          variant="light"
          size="small"
        />
        
        <Button
          type="submit"
          className="input-send"
          disabled={(!newMessage.trim() && !attachment) || sending || isUploading}
          icon={sending || isUploading ? <FaSpinner className="fa-spin" /> : <FaPaperPlane />}
          title={sending ? "Sending..." : "Send Message"}
          aria-label={sending ? "Sending message" : "Send message"}
          variant="primary"
          size="small"
        />
      </form>
    </div>
  )
}

// Wrap the component with error boundary HOC
export default withErrorBoundary(EmbeddedChat, {
  FallbackComponent: ({ error, resetErrorBoundary }) => (
    <div className="embedded-chat-error">
      <ErrorMessage 
        title="Chat Error" 
        message={error?.message || 'An error occurred in the chat component'} 
      />
      <Button 
        onClick={resetErrorBoundary} 
        variant="primary"
        className="mt-3"
      >
        Try Again
      </Button>
    </div>
  ),
  onError: (error, info) => {
    // Log error to the logger
    log.error('EmbeddedChat error boundary caught error:', error);
    log.error('Component stack:', info?.componentStack);
    
    // Could also send to an error reporting service here
    toast.error('Something went wrong with the chat. Trying to recover...');
  }
});