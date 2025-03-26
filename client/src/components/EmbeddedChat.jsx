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
} from "react-icons/fa"
import { useAuth, useChat } from "../context"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import VideoCall from "./VideoCall"
import "../styles/video-call.css"
import socketService from "../services/socketService.jsx"
import { toast } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"

// Add this CSS style for the pulse animation
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

// Console logger for debugging
const debug = (msg, ...args) => {
  console.log(`[EmbeddedChat] ${msg}`, ...args)
}

const EmbeddedChat = ({ recipient, isOpen, onClose, embedded = true }) => {
  const { user, token } = useAuth()
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
  const [pendingPhotoRequests, setPendingPhotoRequests] = useState(0)
  const [isApprovingRequests, setIsApprovingRequests] = useState(false)
  const [requestsData, setRequestsData] = useState([])

  // Video call state
  const [activeCall, setActiveCall] = useState(false)
  const [isCallInitiator, setIsCallInitiator] = useState(false)
  const [incomingCall, setIncomingCall] = useState(null)
  const [callError, setCallError] = useState(null)

  const messagesEndRef = useRef(null)
  const chatInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const socketRef = useRef(null)

  // Retrieve latest token from context or localStorage.
  const getAuthToken = () => token || localStorage.getItem("token")

  // Create an axios instance with auth headers; memoized to avoid re-creation.
  const authAxios = useMemo(() => {
    const instance = axios.create({
      baseURL: "",
      headers: { "Content-Type": "application/json" },
    })
    instance.interceptors.request.use(
      (config) => {
        const authToken = getAuthToken()
        if (authToken) {
          config.headers.Authorization = `Bearer ${authToken}`
        }
        return config
      },
      (error) => Promise.reject(error),
    )
    return instance
  }, [token])

  // Access socket directly from socketService
  useEffect(() => {
    if (socketService.socket) {
      debug("Socket reference obtained")
      socketRef.current = socketService.socket

      // Set up call answered handler
      const handleCallAnswered = (data) => {
        console.log("Call answer received:", data)
        if (data.accept) {
          console.log("Call was accepted")
        } else {
          console.log("Call was rejected")
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
      debug("Socket connection not available", socketService)
    }
  }, [])

  // Production-level incoming call handler without toast notifications.
  const handleIncomingCall = useCallback(
    (data) => {
      try {
        if (!data) {
          console.error("Received empty call data")
          return
        }

        console.log("Incoming call received:", data)

        // Determine callerId by checking various possible formats
        const callerId =
          (data.caller && (data.caller.userId || data.caller._id)) || data.userId || (data.from && data.from.userId)

        if (!callerId) {
          console.error("Caller ID not found in incoming call data", data)
          return
        }

        // Check if this call is for the current chat recipient
        if (recipient && recipient._id === callerId) {
          console.log(`Incoming call from current chat recipient: ${callerId}`)
          setIncomingCall(data)
        } else if (recipient && recipient._id !== callerId) {
          console.log(`Incoming call from ${callerId} but current chat is with ${recipient._id}`)
          // Still set the incoming call even if from a different user
          setIncomingCall(data)
        } else {
          console.log(`Incoming call from ${callerId} but no active chat`)
          setIncomingCall(data)
        }

        debug("Incoming call state set", data)
      } catch (error) {
        console.error("Error handling incoming call:", error)
      }
    },
    [recipient],
  )

  // Listen for incoming calls via the socket without triggering any toast.
  useEffect(() => {
    if (!socketRef.current) {
      debug("No socket available for incoming call handling")
      return
    }

    console.log("Setting up incoming call listener")

    const handleIncomingCallEvent = (data) => {
      console.log("Incoming call event received:", data)
      handleIncomingCall(data)
    }

    socketRef.current.on("incomingCall", handleIncomingCallEvent)

    return () => {
      if (socketRef.current) {
        socketRef.current.off("incomingCall", handleIncomingCallEvent)
      }
    }
  }, [recipient, handleIncomingCall])

  // Monitor typing events for debugging
  useEffect(() => {
    if (recipient && typingUsers) {
      // This example simply calculates a flag; you may add additional logging if needed.
      const isUserTyping = recipient._id && typingUsers[recipient._id] && Date.now() - typingUsers[recipient._id] < 3000
    }
  }, [typingUsers, recipient])

  // Load messages and check pending photo requests when chat opens.
  useEffect(() => {
    let isMounted = true
    if (recipient && isOpen) {
      setIsLoading(true)
      getMessages(recipient._id)
        .then((fetchedMessages) => {
          if (isMounted && Array.isArray(fetchedMessages)) {
            setMessagesData(fetchedMessages)
          }
          setIsLoading(false)
        })
        .catch((err) => {
          setIsLoading(false)
          console.error("Failed to load messages. Please try again.", err)
        })
      if (user) checkPendingPhotoRequests()
    }
    return () => {
      isMounted = false
    }
  }, [recipient, isOpen, user, getMessages])

  // Update messagesData if context messages change.
  useEffect(() => {
    if (Array.isArray(messages)) {
      setMessagesData(messages)
    }
  }, [messages])

  // Auto-scroll to the latest message.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messagesData])

  // Focus on the chat input when the chat opens.
  useEffect(() => {
    if (isOpen && recipient) {
      setTimeout(() => chatInputRef.current?.focus(), 300)
    }
  }, [isOpen, recipient])

  // Cleanup on component unmount.
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

  // Mock function to force show incoming call for testing
  const mockIncomingCall = () => {
    console.log("Setting mock incoming call")
    setIncomingCall({
      caller: { userId: recipient._id, name: recipient.nickname },
      callId: "test-call-" + Date.now(),
    })
  }

  // Check for pending photo access requests.
  const checkPendingPhotoRequests = async () => {
    try {
      const response = await authAxios.get(`/api/users/photos/permissions`, {
        params: { requestedBy: recipient?._id, status: "pending" },
      })
      if (response.data?.success) {
        const requests = response.data.data || []
        setPendingPhotoRequests(requests.length)
        setRequestsData(requests)
      } else {
        setPendingPhotoRequests(1)
      }
    } catch (error) {
      setPendingPhotoRequests(1)
    }
  }

  // Approve all photo requests.
  const handleApproveAllRequests = async () => {
    setIsApprovingRequests(true)
    try {
      if (requestsData.length > 0) {
        const results = await Promise.allSettled(
          requestsData.map((request) =>
            authAxios.put(`/api/users/photos/permissions/${request._id}`, {
              status: "approved",
            }),
          ),
        )
        const successCount = results.filter(
          (result) => result.status === "fulfilled" && result.value.data.success,
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
          setMessagesData((prev) => [...prev, systemMessage])
          if (sendMessage) {
            await sendMessage(recipient._id, "text", `I've approved your request to view my private photos.`)
          }
          setPendingPhotoRequests(0)
          setRequestsData([])
        } else {
          console.error("Failed to approve photo requests")
        }
      } else {
        // Fallback approval method.
        const response = await authAxios.post(`/api/users/photos/approve-all`, {
          requesterId: recipient._id,
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
          setMessagesData((prev) => [...prev, systemMessage])
          if (sendMessage) {
            await sendMessage(recipient._id, "text", `I've approved your request to view my private photos.`)
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
      setMessagesData((prev) => [...prev, systemMessage])
    } finally {
      setIsApprovingRequests(false)
    }
  }

  // Utility functions for file icon and message time formatting.
  const getFileIcon = useCallback((file) => {
    if (!file) return <FaFile />
    const fileType = file.type || ""
    if (fileType.startsWith("image/")) return <FaImage />
    if (fileType.startsWith("video/")) return <FaFileVideo />
    if (fileType.startsWith("audio/")) return <FaFileAudio />
    if (fileType === "application/pdf") return <FaFilePdf />
    return <FaFileAlt />
  }, [])

  const formatMessageTime = useCallback((timestamp) => {
    if (!timestamp) return ""
    try {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch (e) {
      return ""
    }
  }, [])

  const formatMessageDate = useCallback((timestamp) => {
    if (!timestamp) return "Unknown date"
    try {
      const date = new Date(timestamp)
      const today = new Date()
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      if (date.toDateString() === today.toDateString()) return "Today"
      if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
      return date.toLocaleDateString()
    } catch (e) {
      return "Unknown date"
    }
  }, [])

  const groupMessagesByDate = useCallback(() => {
    const groups = {}
    if (!Array.isArray(messagesData)) return groups
    messagesData.forEach((message) => {
      if (message && message.createdAt) {
        const date = formatMessageDate(message.createdAt)
        groups[date] = groups[date] || []
        groups[date].push(message)
      }
    })
    return groups
  }, [messagesData, formatMessageDate])

  // Emoji handling.
  const commonEmojis = ["😊", "😂", "😍", "❤️", "👍", "🙌", "🔥", "✨", "🎉", "🤔", "😉", "🥰"]

  const handleEmojiClick = (emoji) => {
    setNewMessage((prev) => prev + emoji)
    setShowEmojis(false)
    chatInputRef.current?.focus()
  }

  // Input event handlers.
  const handleTyping = (e) => {
    setNewMessage(e.target.value)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      if (e.target.value.trim() && recipient && sendTyping) {
        sendTyping(recipient._id)
      }
    }, 300)
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (attachment) return handleSendAttachment()
    if (newMessage.trim() && !sendingMessage && recipient) {
      if (user?.accountTier === "FREE" && newMessage.trim() !== "😉") {
        console.error("Free accounts can only send winks. Upgrade to send messages.")
        return
      }
      try {
        await sendMessage(recipient._id, "text", newMessage.trim())
        setNewMessage("")
      } catch (error) {
        console.error(error.message || "Failed to send message")
      }
    }
  }

  const handleSendAttachment = async () => {
    if (!attachment || !recipient || isUploading) return
    setIsUploading(true)
    try {
      await sendFileMessage(recipient._id, attachment, (progress) => setUploadProgress(progress))
      console.log("File sent successfully")
      setAttachment(null)
      setUploadProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ""
    } catch (error) {
      console.error(error.message || "Failed to send file. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleSendWink = async () => {
    if (!sendingMessage && recipient) {
      try {
        await sendMessage(recipient._id, "wink", "😉")
      } catch (error) {
        console.error(error.message || "Failed to send wink")
      }
    }
  }

  const handleFileAttachment = () => {
    if (user?.accountTier === "FREE") {
      console.error("Free accounts cannot send files. Upgrade to send files.")
      return
    }
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      console.error("File is too large. Maximum size is 5MB.")
      e.target.value = null
      return
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
      console.error("File type not supported.")
      e.target.value = null
      return
    }
    setAttachment(file)
    console.log(`Selected file: ${file.name}`)
    e.target.value = null
  }

  const handleRemoveAttachment = () => {
    setAttachment(null)
    setUploadProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // Handle initiating a video call
  const handleVideoCall = () => {
    if (user?.accountTier === "FREE") {
      console.error("Free accounts cannot make video calls. Upgrade for video calls.")
      return
    }

    if (!socketRef.current) {
      console.error("Cannot start call: No connection available")
      return
    }

    if (activeCall) {
      console.log("Call already in progress")
      return
    }

    if (recipient?._id) {
      // Create a unique call ID
      const callId = `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

      console.log(`Starting video call with ${recipient.nickname}...`)

      // Set up the call on our end first
      setIsCallInitiator(true)
      setActiveCall(true)

      // Then emit the call event
      socketRef.current.emit("initiateCall", {
        recipientId: recipient._id,
        callType: "video",
        userId: user._id,
        callId: callId,
        caller: {
          userId: user._id,
          name: user.nickname || "User",
        },
      })

      // Also send a message to notify about the call
      sendMessage(recipient._id, "video", "Video Call").catch((error) => {
        console.error("Failed to send video call message:", error)
      })
    } else {
      console.error("Cannot start call: recipient information is missing")
    }
  }

  // Handle accepting an incoming call
  const handleAcceptCall = () => {
    debug("Accepting incoming call", incomingCall)

    if (!incomingCall) {
      console.error("No incoming call to accept")
      return
    }

    if (!socketRef.current) {
      console.error("Cannot accept call: No socket connection available")
      return
    }

    const callerId = incomingCall.caller?.userId || incomingCall.userId

    if (!callerId) {
      console.error("Cannot accept call: No caller ID found")
      return
    }

    // Send acceptance to the caller
    socketRef.current.emit("answerCall", {
      callerId: callerId,
      accept: true,
      callId: incomingCall.callId,
      timestamp: Date.now(),
    })

    console.log(`Accepting call from ${incomingCall.caller?.name || "caller"} with ID ${callerId}`)

    // Set up the call
    setActiveCall(true)
    setIsCallInitiator(false)
    setIncomingCall(null)
  }

  // Handle ending a call
  const handleEndCall = () => {
    setActiveCall(false)
    setIncomingCall(null)
  }

  // Handle call errors
  const handleCallError = (error) => {
    setCallError(error.message || "Call failed")
    console.error(`Call error: ${error.message || "Unknown error"}`)
    setActiveCall(false)
  }

  const isTyping =
    recipient && typingUsers && typingUsers[recipient._id] && Date.now() - typingUsers[recipient._id] < 3000

  const handleClose = () => {
    if (activeCall) {
      console.log("Please end the call before closing the chat.")
      return
    }
    if (typeof onClose === "function") onClose()
  }

  // Add a useEffect to handle call hangup events
  useEffect(() => {
    if (!socketRef.current) return

    const handleVideoHangup = (data) => {
      console.log("Received hangup signal:", data)

      if (activeCall) {
        console.log("Call ended by remote user")
        setActiveCall(false)
        toast.info("Call ended by the other user")
      }
    }

    socketRef.current.on("videoHangup", handleVideoHangup)

    return () => {
      if (socketRef.current) {
        socketRef.current.off("videoHangup", handleVideoHangup)
      }
    }
  }, [activeCall])

  // Add a useEffect to handle visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("Tab hidden, but maintaining call connection")
      } else {
        console.log("Tab visible again, checking call status")
        // Don't do anything that would disrupt the call
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  // Handle rejecting an incoming call
  const handleRejectCall = () => {
    debug("Rejecting incoming call", incomingCall)

    if (!incomingCall) {
      console.error("No incoming call to reject")
      return
    }

    if (!socketRef.current) {
      console.error("Cannot reject call: No socket connection available")
      return
    }

    const callerId = incomingCall.caller?.userId || incomingCall.userId

    if (!callerId) {
      console.error("Cannot reject call: No caller ID found")
      return
    }

    // Send rejection to the caller
    socketRef.current.emit("answerCall", {
      callerId: callerId,
      accept: false,
      callId: incomingCall.callId,
      timestamp: Date.now(),
    })

    console.log(`Rejecting call from ${incomingCall.caller?.name || "caller"} with ID ${callerId}`)

    // Clear the incoming call state
    setIncomingCall(null)
  }

  if (!isOpen) return null

  const renderFileMessage = (message) => {
    const { metadata } = message
    if (!metadata || !metadata.fileUrl) {
      return <p className="message-content">Attachment unavailable</p>
    }
    const isImage = metadata.fileType?.startsWith("image/")
    if (message.type === "system") {
      return (
        <div className="system-message-content">
          <p>{message.content}</p>
          <span className="message-time">{formatMessageTime(message.createdAt)}</span>
        </div>
      )
    }
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
            {metadata.fileType?.startsWith("video/") ? (
              <FaFileVideo className="file-icon" />
            ) : metadata.fileType?.startsWith("audio/") ? (
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

  // Debug log for incoming call state
  useEffect(() => {
    if (incomingCall) {
      console.log("Rendering with active incoming call:", incomingCall)
    }
  }, [incomingCall])

  return (
    <div className={`embedded-chat ${embedded ? "embedded" : "standalone"}`}>
      {/* Uncomment the test button below for debugging incoming calls */}
      {/* <button
        onClick={mockIncomingCall}
        style={{position: 'absolute', top: '5px', right: '5px', zIndex: 9999, background: 'red', color: 'white'}}
      >
        Test Call
      </button> */}

      {/* Render the VideoCall component if a call is active */}
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
          <button onClick={handleEndCall} className="error-close-btn">
            Close
          </button>
        </div>
      ) : null}

      <div className="chat-header">
        <div className="chat-user">
          {recipient?.photos?.length ? (
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
          <button
            className="photo-request-btn"
            onClick={handleApproveAllRequests}
            title="Approve photo requests"
            aria-label="Approve photo requests"
            disabled={isApprovingRequests}
          >
            {isApprovingRequests ? <FaSpinner className="fa-spin" /> : <FaLock />}
            <span className="request-badge">!</span>
          </button>
          {user?.accountTier !== "FREE" && !activeCall && (
            <button
              className="video-call-btn"
              onClick={handleVideoCall}
              title="Start Video Call"
              aria-label="Start video call"
              disabled={isUploading || sendingMessage || activeCall}
            >
              <FaVideo />
            </button>
          )}
          <button className="close-chat-btn" onClick={handleClose} aria-label="Close chat" title="Close chat">
            <FaTimes />
          </button>
        </div>
      </div>

      {/* Incoming call notification banner */}
      {incomingCall && (
        <div
          className="incoming-call-banner"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 15px",
            backgroundColor: "#4a1d96",
            color: "white",
            borderRadius: "4px",
            margin: "5px 0",
            zIndex: 100,
          }}
        >
          <div className="incoming-call-info">
            <FaVideo className="call-icon pulse" style={{ marginRight: "10px", animation: "pulse 1s infinite" }} />
            <span>{recipient?.nickname || "Someone"} is calling you</span>
          </div>
          <div className="incoming-call-actions">
            <button
              className="decline-call-btn"
              onClick={handleRejectCall}
              title="Decline"
              style={{
                backgroundColor: "#dc2626",
                border: "none",
                borderRadius: "50%",
                padding: "8px",
                marginRight: "10px",
                cursor: "pointer",
              }}
            >
              <FaPhoneSlash />
            </button>
            <button
              className="accept-call-btn"
              onClick={handleAcceptCall}
              title="Accept"
              style={{
                backgroundColor: "#16a34a",
                border: "none",
                borderRadius: "50%",
                padding: "8px",
                cursor: "pointer",
              }}
            >
              <FaPhone />
            </button>
          </div>
        </div>
      )}

      {user?.accountTier === "FREE" && (
        <div className="premium-banner">
          <FaCrown className="premium-icon" />
          <span>Upgrade to send messages and make video calls (you can still send heart)</span>
          <button className="upgrade-btn" onClick={() => navigate("/subscription")} aria-label="Upgrade to premium">
            Upgrade
          </button>
        </div>
      )}

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
                <div
                  key={message._id}
                  className={`message ${
                    message.sender === user?._id ? "sent" : "received"
                  } ${message.type === "system" ? "system-message" : ""}`}
                >
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
                  {message.type === "system" && (
                    <div className="system-message-content">
                      <p>{message.content}</p>
                      <span className="message-time">{formatMessageTime(message.createdAt)}</span>
                    </div>
                  )}
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
