"use client"

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
  FaLock,
  FaPhoneSlash,
  FaExclamationCircle,
  FaChevronDown,
  FaChevronUp
} from "react-icons/fa"
import styles from "../styles/embedded-chat.module.css"
import { useAuth } from "../context"
import { useChat } from "../hooks/useChat"
import { toast } from "react-toastify"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { logger } from "../utils"
import VideoCall from "./VideoCall"
import socketService from "../services/socketService.jsx"
import "../styles/video-call.css"

// Create a logger for this component
const log = logger.create("EmbeddedChat")

// Counter for guaranteeing uniqueness within the same timestamp
let idCounter = 0;

// Helper function to generate unique message IDs
const generateUniqueId = () => {
  // Increment the counter for each call to ensure uniqueness
  // even if called multiple times in the same millisecond
  idCounter++; 
  // Use a combination of timestamp, counter, and random string
  return `system-${Date.now()}-${idCounter}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * EmbeddedChat component
 * A fully functional chat interface in a Facebook-style floating window
 */
const EmbeddedChat = ({ recipient, isOpen = true, onClose = () => {}, embedded = true }) => {
  // State for Facebook-style chat window
  const [isMinimized, setIsMinimized] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  
  // Get required hooks and context
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  
  // Use the chat hook with the recipient ID
  const { 
    messages: hookMessages, 
    loading, 
    error, 
    sendMessage: hookSendMessage, 
    typingStatus, 
    sendTyping,
    loadMoreMessages,
    hasMore,
    sending: sendingMessage,
    initialized,
    isConnected,
    refresh
  } = useChat(recipient?._id)

  // Local state
  const [newMessage, setNewMessage] = useState("")
  const [showEmojis, setShowEmojis] = useState(false)
  const [loadingTimeout, setLoadingTimeout] = useState(false) // For handling prolonged loading
  const [attachment, setAttachment] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [messagesData, setMessagesData] = useState([])
  const [pendingPhotoRequests, setPendingPhotoRequests] = useState(0)
  const [isApprovingRequests, setIsApprovingRequests] = useState(false)
  const [requestsData, setRequestsData] = useState([])
  const [incomingCall, setIncomingCall] = useState(null)
  const [isCallActive, setIsCallActive] = useState(false)
  const [isSending, setIsSending] = useState(false)

  // Refs
  const messagesEndRef = useRef(null)
  const chatInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const loadingTimeoutRef = useRef(null)

  // Log component mounting and chat initialization status
  useEffect(() => {
    log.debug("EmbeddedChat mounted with recipient:", recipient?.nickname)
    console.log("Chat initialization state:", {
      recipientId: recipient?._id,
      initialized,
      isConnected,
      currentUserId: user?._id,
      isAuthenticatedUser: isAuthenticated // renamed to avoid conflicts
    })
    
    return () => log.debug("EmbeddedChat unmounted")
  }, [recipient, initialized, isConnected, user, isAuthenticated])

  // Create an axios instance with auth headers
  const authAxios = useCallback(() => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token")

    const instance = axios.create({
      baseURL: "",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token ? `Bearer ${token}` : ""
      },
    })

    return instance
  }, [])

  // Setup loading timeout to show a message if loading takes too long
  useEffect(() => {
    // Clear any existing timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    
    // If we're loading, set a timeout to show a message after 5 seconds
    if (loading && !loadingTimeout) {
      loadingTimeoutRef.current = setTimeout(() => {
        setLoadingTimeout(true);
      }, 5000);
    } else if (!loading) {
      setLoadingTimeout(false);
    }
    
    // Fallback timeout to prevent permanent loading state (force timeout after 15 seconds)
    const fallbackTimeout = setTimeout(() => {
      if (loading) {
        log.warn("Force loading timeout after 15 seconds");
        setLoadingTimeout(true);
        
        // Force loading to false after 20 seconds total if still loading
        setTimeout(() => {
          if (loading) {
            log.error("Forcing exit from loading state after 20s");
            
            // Display error message as a system message
            const errorMessage = {
              _id: generateUniqueId(),
              sender: "system",
              content: "Failed to load messages. Please try refreshing.",
              createdAt: new Date().toISOString(),
              type: "system",
              error: true
            };
            
            setMessagesData(prev => [errorMessage, ...prev]);
            
            // Force refresh button to appear
            if (refresh) {
              refresh();
            }
          }
        }, 5000);
      }
    }, 15000);
    
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      clearTimeout(fallbackTimeout);
    };
  }, [loading, loadingTimeout, refresh]);

  // Handle incoming video calls
  useEffect(() => {
    if (!isOpen || !recipient || !user?._id) return;
    
    // Register for incoming call events
    const handleIncomingCall = (call) => {
      // Ignore calls not from this recipient when chat is open
      if (call.userId !== recipient._id) return;
      
      log.debug(`Received incoming call from ${call.userId}`, call);
      
      // Set the incoming call data
      setIncomingCall({
        callId: call.callId,
        callerName: call.caller?.name || recipient.nickname,
        callerId: call.userId,
        timestamp: call.timestamp
      });
      
      // Add a system message
      const systemMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: `${recipient.nickname} is calling you.`,
        createdAt: new Date().toISOString(),
        type: "system",
      };
      
      setMessagesData((prev) => [...prev, systemMessage]);
    };
    
    // Handle call accepted event
    const handleCallAccepted = (data) => {
      if (data.userId !== recipient._id) return;
      
      log.debug(`Call accepted by ${recipient.nickname}`);
      
      // Add a system message
      const systemMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: `${recipient.nickname} accepted your call.`,
        createdAt: new Date().toISOString(),
        type: "system",
      };
      
      setMessagesData((prev) => [...prev, systemMessage]);
      toast.success(`${recipient.nickname} accepted your call`);
    };
    
    // Handle call declined event
    const handleCallDeclined = (data) => {
      if (data.userId !== recipient._id) return;
      
      log.debug(`Call declined by ${recipient.nickname}`);
      
      // Add a system message
      const systemMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: `${recipient.nickname} declined your call.`,
        createdAt: new Date().toISOString(),
        type: "system",
      };
      
      setMessagesData((prev) => [...prev, systemMessage]);
      setIsCallActive(false);
      toast.info(`${recipient.nickname} declined your call`);
    };
    
    // Handle call hangup event
    const handleCallHangup = (data) => {
      if (data.userId !== recipient._id) return;
      
      log.debug(`Call hung up by ${recipient.nickname}`);
      
      // End the call if it's active
      if (isCallActive) {
        handleEndCall();
      }
    };
    
    // Register call event listeners
    const unsubscribers = [
      socketService.on("incomingCall", handleIncomingCall),
      socketService.on("callAccepted", handleCallAccepted),
      socketService.on("callDeclined", handleCallDeclined),
      socketService.on("videoHangup", handleCallHangup)
    ];
    
    // Cleanup on unmount
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [isOpen, recipient, user?._id, isCallActive]);

  // Update messagesData when hookMessages changes
  useEffect(() => {
    // Update local state based on hook state, filtering out duplicates
    if (Array.isArray(hookMessages)) {
      // Create a map of message IDs we've already seen to filter out duplicates
      const idMap = new Map();
      
      // Filter out messages with duplicate IDs
      const uniqueMessages = hookMessages.filter(message => {
        if (!message || (!message._id && !message.tempId)) return false;
        
        const msgId = message._id || message.tempId;
        
        // If we've seen this ID before, filter it out
        if (idMap.has(msgId)) {
          log.warn(`Filtering out duplicate message with ID: ${msgId}`);
          return false;
        }
        
        // Otherwise, mark it as seen and keep it
        idMap.set(msgId, true);
        return true;
      });
      
      // Only update if the count changed
      if (uniqueMessages.length !== hookMessages.length) {
        log.debug(`Filtered out ${hookMessages.length - uniqueMessages.length} duplicate messages`);
      }
      
      setMessagesData(uniqueMessages);
      log.debug(`Received ${uniqueMessages.length} unique messages from hook`);
    } else {
      log.warn(`Received non-array messages from hook: ${typeof hookMessages}`);
    }
    
    // If loading completes but we have no messages, that's okay - just not an error state
    if (!loading && Array.isArray(hookMessages) && hookMessages.length === 0) {
      log.debug("Loading complete with no messages");
    }
  }, [hookMessages, loading])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messagesData])

  // Check for pending photo access requests when chat opens
  useEffect(() => {
    if (isOpen && recipient?._id && user?._id) {
      checkPendingPhotoRequests()
    }
  }, [isOpen, recipient, user])

  // Focus on the chat input when the chat opens
  useEffect(() => {
    if (isOpen && recipient && !isMinimized && !isCollapsed) {
      setTimeout(() => {
        if (chatInputRef.current) {
          chatInputRef.current.focus()
        }
      }, 300)
    }
  }, [isOpen, recipient, isMinimized, isCollapsed])

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Clear all timeouts
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
      
      // Reset message state to prevent duplication on remount
      setMessagesData([])
    }
  }, [])

  // Don't render if chat is not open
  if (!isOpen) {
    return null
  }

  // Toggle chat minimize - not used anymore with overlay
  const toggleMinimize = (e) => {
    // No longer needed with overlay
    if (e) e.stopPropagation()
  }

  // Toggle chat header collapse - not used anymore with overlay
  const toggleCollapse = (e) => {
    // No longer needed with overlay
    if (e) e.stopPropagation()
  }

  // Handle clicking the header - not used anymore with overlay
  const handleHeaderClick = () => {
    // No longer needed with overlay
  }

  // Scroll to the bottom of the messages
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Check for pending photo access requests
  const checkPendingPhotoRequests = async () => {
    try {
      const http = authAxios()
      const response = await http.get(`/api/users/photos/permissions`, {
        params: { requestedBy: recipient?._id, status: "pending" },
      })

      if (response.data?.success) {
        const requests = response.data.data || []
        setPendingPhotoRequests(requests.length)
        setRequestsData(requests)
      } else {
        setPendingPhotoRequests(0)
      }
    } catch (error) {
      log.error("Error checking photo permissions:", error)
      setPendingPhotoRequests(0)
    }
  }

  // Approve all photo requests
  const handleApproveAllRequests = async (e) => {
    if (e) e.stopPropagation()
    if (pendingPhotoRequests === 0) return

    setIsApprovingRequests(true)

    try {
      const http = authAxios()

      if (requestsData.length > 0) {
        // Process each request individually
        const results = await Promise.allSettled(
          requestsData.map((request) =>
            http.put(`/api/users/photos/permissions/${request._id}`, {
              status: "approved",
            })
          )
        )

        // Count successful approvals
        const successCount = results.filter(
          (result) => result.status === "fulfilled" && result.value.data.success
        ).length

        if (successCount > 0) {
          toast.success(`Approved ${successCount} photo request${successCount !== 1 ? "s" : ""}`)

          // Add system message
          const systemMessage = {
            _id: generateUniqueId(),
            sender: "system",
            content: `Photo access approved for ${successCount} photo${successCount !== 1 ? "s" : ""}.`,
            createdAt: new Date().toISOString(),
            type: "system",
          }

          setMessagesData((prev) => [...prev, systemMessage])

          // Send a message to the recipient
          if (hookSendMessage) {
            await hookSendMessage("I've approved your request to view my private photos.", 'text')
          }

          // Reset requests
          setPendingPhotoRequests(0)
          setRequestsData([])
        } else {
          toast.error("Failed to approve photo requests")
        }
      } else {
        // Fallback approval method
        const response = await http.post(`/api/users/photos/approve-all`, {
          requesterId: recipient._id,
        })

        if (response.data?.success) {
          const approvedCount = response.data.approvedCount || 1
          toast.success(`Approved ${approvedCount} photo request${approvedCount !== 1 ? "s" : ""}`)

          // Add system message
          const systemMessage = {
            _id: generateUniqueId(),
            sender: "system",
            content: `Photo access approved.`,
            createdAt: new Date().toISOString(),
            type: "system",
          }

          setMessagesData((prev) => [...prev, systemMessage])

          if (hookSendMessage) {
            await hookSendMessage("I've approved your request to view my private photos.", 'text')
          }

          setPendingPhotoRequests(0)
        } else {
          throw new Error("Approval failed")
        }
      }
    } catch (error) {
      toast.error("Error approving photo requests. Please try again.")
    } finally {
      setIsApprovingRequests(false)
    }
  }

  // Handle message input changes
  const handleInputChange = (e) => {
    setNewMessage(e.target.value)
    
    // Clear any existing typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Only send typing indicator if there's content
    if (e.target.value.trim() && recipient?._id && sendTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        sendTyping()
      }, 300)
    }
  }

  // Handle message submission
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault()

    // If there's an attachment, send that instead
    if (attachment) {
      return handleSendAttachment()
    }

    // Don't send empty messages or while another message is sending
    if (!newMessage.trim() || isSending || !recipient?._id) {
      return
    }

    // Check if chat is initialized
    if (!initialized) {
      toast.error("Chat system is initializing. Please wait a moment and try again.")
      return
    }

    // Check for connection 
    if (!isConnected) {
      toast.error("You appear to be offline. Please check your connection and try again.")
      return
    }

    // Free account restriction (only winks)
    if (user?.accountTier === "FREE" && newMessage.trim() !== "😉") {
      return toast.error("Free accounts can only send winks. Upgrade to send messages.")
    }

    try {
      // Store the message content before clearing it to prevent double-sends
      const messageToSend = newMessage.trim()
      
      // Clear the message input immediately to prevent duplicate sends
      setNewMessage("")
      
      // Set sending state
      setIsSending(true)
      
      // Use the hook's sendMessage function to send the message
      // It handles optimistic updates internally
      await hookSendMessage(messageToSend, 'text')
      
      // Log success at debug level
      log.debug(`Message sent successfully to ${recipient.nickname || recipient._id}`)
    } catch (err) {
      log.error("Failed to send message:", err)
      toast.error(err.message || "Failed to send message")
    } finally {
      setIsSending(false)
      chatInputRef.current?.focus()
    }
  }

  // Handle sending attachment
  const handleSendAttachment = async () => {
    if (!attachment || !recipient?._id || isUploading) return

    setIsUploading(true)

    try {
      // Create a FormData object to upload the file
      const formData = new FormData();
      formData.append("file", attachment);
      formData.append("recipient", recipient._id);
      formData.append("messageType", "file");
      
      // Create a simulated progress update
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const newProgress = prev + Math.floor(Math.random() * 15);
          return newProgress > 95 ? 95 : newProgress;
        });
      }, 300);
      
      try {
        // This is a placeholder - in a real implementation we would use the
        // actual sendFileMessage function or an API call
        // Mocking successful upload after a delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        clearInterval(progressInterval);
        setUploadProgress(100);
        
        // Create metadata for the message
        const fileMetadata = {
          fileName: attachment.name,
          fileSize: attachment.size,
          fileType: attachment.type,
          fileUrl: URL.createObjectURL(attachment) // In real implementation, this would be the server URL
        };
        
        // Send the message with metadata
        await hookSendMessage("File attachment", 'file', fileMetadata);
        toast.success("File sent successfully");
      } catch (uploadError) {
        clearInterval(progressInterval);
        throw uploadError;
      }
      
      // Clear the attachment
      setAttachment(null);
      setUploadProgress(0);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      log.error("Failed to send file:", error);
      toast.error(error.message || "Failed to send file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  // Handle sending wink
  const handleSendWink = async () => {
    if (isSending || !recipient?._id) return
    
    // Check if chat is initialized
    if (!initialized) {
      toast.error("Chat system is initializing. Please wait a moment and try again.")
      return
    }

    // Check for connection 
    if (!isConnected) {
      toast.error("You appear to be offline. Please check your connection and try again.")
      return
    }

    try {
      setIsSending(true)
      await hookSendMessage("😉", 'wink')
      log.debug(`Wink sent successfully to ${recipient.nickname || recipient._id}`)
    } catch (error) {
      log.error("Failed to send wink:", error)
      toast.error(error.message || "Failed to send wink")
    } finally {
      setIsSending(false)
    }
  }

  // Handle file selection
  const handleFileAttachment = () => {
    if (user?.accountTier === "FREE") {
      return toast.error("Free accounts cannot send files. Upgrade to send files.")
    }

    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // Handle file change
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]

    if (!file) return

    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 5MB.")
      e.target.value = null
      return
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg", "image/jpg", "image/png", "image/gif",
      "application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain", "audio/mpeg", "audio/wav", "video/mp4", "video/quicktime",
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

  // Handle removing attachment
  const handleRemoveAttachment = () => {
    setAttachment(null)
    setUploadProgress(0)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Handle emoji selection
  const commonEmojis = ["😊", "😂", "😍", "❤️", "👍", "🙌", "🔥", "✨", "🎉", "🤔", "😉", "🥰"]

  const handleEmojiClick = (emoji) => {
    setNewMessage((prev) => prev + emoji)
    setShowEmojis(false)

    if (chatInputRef.current) {
      chatInputRef.current.focus()
    }
  }

  // Handle video call
  const handleVideoCall = async (e) => {
    if (e) e.stopPropagation()
    
    // Check if socket is connected
    if (!socketService.isConnected()) {
      // Add a system message instead of toast
      const errorMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: "Cannot start call: socket is not connected. Please refresh the page and try again.",
        createdAt: new Date().toISOString(),
        type: "system",
        error: true
      }
      setMessagesData((prev) => [...prev, errorMessage])
      log.error("Cannot initiate call - socket not connected")
      return
    }
    
    if (!recipient?.isOnline) {
      // Add a system message instead of toast
      const errorMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: `${recipient.nickname} is currently offline. You can only call users who are online.`,
        createdAt: new Date().toISOString(),
        type: "system",
        error: true
      }
      setMessagesData((prev) => [...prev, errorMessage])
      return
    }

    if (user?.accountTier === "FREE") {
      // Add a system message instead of toast
      const errorMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: "Free accounts cannot make video calls. Upgrade for video calls.",
        createdAt: new Date().toISOString(),
        type: "system",
        error: true
      }
      setMessagesData((prev) => [...prev, errorMessage])
      return
    }

    try {
      // Add a system message instead of toast
      const infoMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: `Initiating call to ${recipient.nickname}...`,
        createdAt: new Date().toISOString(),
        type: "system"
      }
      setMessagesData((prev) => [...prev, infoMessage])
      
      // Initialize call
      log.debug(`Initiating video call to ${recipient._id}`)
      
      // For testing - hardcode a call ID and proceed without waiting for server
      const tempCallId = `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      setIsCallActive(true)
      
      // Add a system message with unique ID
      const systemMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: `You started a video call with ${recipient.nickname}.`,
        createdAt: new Date().toISOString(),
        type: "system",
      }

      setMessagesData((prev) => [...prev, systemMessage])
      
      // Try to initiate call in the background
      socketService.initiateVideoCall(recipient._id)
        .then(data => {
          log.debug("Call initiation successful:", data)
        })
        .catch(err => {
          log.error("Background call initiation error:", err)
          // Don't close the call UI, it's already opened
        })
    } catch (error) {
      log.error("Video call initiation error:", error)
      
      // Add error message to chat instead of toast
      const errorMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: error.message || "Could not start video call. Please try again.",
        createdAt: new Date().toISOString(),
        type: "system",
        error: true
      }
      setMessagesData((prev) => [...prev, errorMessage])
    }
  }

  // Handle ending call
  const handleEndCall = (e) => {
    if (e) e.stopPropagation()
    
    // Send hangup signal if we have an active call
    if (isCallActive) {
      socketService.emit("videoHangup", {
        recipientId: recipient._id
      });
    }
    
    // Reset call states
    setIsCallActive(false)
    setIncomingCall(null)

    // Add a system message instead of toast
    const systemMessage = {
      _id: generateUniqueId(),
      sender: "system",
      content: `Video call with ${recipient.nickname} ended.`,
      createdAt: new Date().toISOString(),
      type: "system",
    }

    setMessagesData((prev) => [...prev, systemMessage])
  }

  // Handle enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Format timestamp for message
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return ""
    
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch (e) {
      return ""
    }
  }

  // Format message date
  const formatMessageDate = (timestamp) => {
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
  }

  // Group messages by date
  const groupMessagesByDate = () => {
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
  }

  // Get file icon based on type
  const getFileIcon = (file) => {
    if (!file) return <FaFile />

    const fileType = file.type || ""

    if (fileType.startsWith("image/")) return <FaImage />
    if (fileType.startsWith("video/")) return <FaFileVideo />
    if (fileType.startsWith("audio/")) return <FaFileAudio />
    if (fileType === "application/pdf") return <FaFilePdf />

    return <FaFileAlt />
  }

  // Render file message
  const renderFileMessage = (message) => {
    const { metadata } = message

    if (!metadata || !metadata.fileUrl) {
      return <p className={styles.messageContent}>Attachment unavailable</p>
    }

    const isImage = metadata.fileType?.startsWith("image/")

    if (message.type === "system") {
      return (
        <div className={styles.systemMessageContent}>
          <p>{message.content}</p>
          <span className={styles.messageTime}>{formatMessageTime(message.createdAt)}</span>
        </div>
      )
    }

    return (
      <div className={styles.fileMessage}>
        {isImage ? (
          <img
            src={metadata.fileUrl || "/placeholder.svg"}
            alt={metadata.fileName || "Image"}
            className={styles.imageAttachment}
            onError={(e) => {
              e.target.onerror = null
              e.target.src = "/placeholder.svg"
            }}
          />
        ) : (
          <div className={styles.fileAttachment}>
            {metadata.fileType?.startsWith("video/") ? (
              <FaFileVideo className={styles.fileIcon} />
            ) : metadata.fileType?.startsWith("audio/") ? (
              <FaFileAudio className={styles.fileIcon} />
            ) : metadata.fileType === "application/pdf" ? (
              <FaFilePdf className={styles.fileIcon} />
            ) : (
              <FaFileAlt className={styles.fileIcon} />
            )}
            <span className={styles.fileName}>{metadata.fileName || "File"}</span>
            <span className={styles.fileSize}>
              {metadata.fileSize ? `(${Math.round(metadata.fileSize / 1024)} KB)` : ""}
            </span>
            <a
              href={metadata.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.downloadLink}
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
    <div 
      className={`${styles.chatContainer} ${isOpen ? styles.opening : ''}`}
    >
      <div className={styles.chatHeader}>
        <div className={styles.chatUser}>
          {recipient?.photos?.length ? (
            <img
              src={recipient.photos[0].url || "/placeholder.svg"}
              alt={recipient.nickname}
              className={styles.chatAvatar}
              onError={(e) => {
                e.target.onerror = null
                e.target.src = "/placeholder.svg"
              }}
            />
          ) : (
            <div className={styles.chatAvatarPlaceholder} />
          )}
          <div className={styles.chatUserInfo}>
            <h3>{recipient.nickname}</h3>
            <div className={styles.statusContainer}>
              <span className={recipient.isOnline ? styles.statusOnline : styles.statusOffline}>
                {recipient.isOnline ? "Online" : "Offline"}
              </span>
              {!isConnected && (
                <span className={styles.connectionStatus}>
                  <FaExclamationCircle className={styles.statusIcon} />
                  <span>Disconnected</span>
                </span>
              )}
            </div>
          </div>
        </div>
        <div className={styles.chatHeaderActions}>
          {pendingPhotoRequests > 0 && (
            <button
              className={styles.chatHeaderBtn}
              onClick={handleApproveAllRequests}
              title="Approve photo requests"
              aria-label="Approve photo requests"
              disabled={isApprovingRequests}
            >
              {isApprovingRequests ? <FaSpinner className="fa-spin" /> : <FaLock />}
            </button>
          )}

          {user?.accountTier !== "FREE" && (
            <>
              {isCallActive ? (
                <button
                  className={styles.chatHeaderBtn}
                  onClick={handleEndCall}
                  title="End call"
                  aria-label="End call"
                >
                  <FaPhoneSlash />
                </button>
              ) : (
                <button
                  className={styles.chatHeaderBtn}
                  onClick={handleVideoCall}
                  title={recipient.isOnline ? "Start Video Call" : `${recipient.nickname} is offline`}
                  aria-label="Start video call"
                  disabled={isUploading || isSending || !recipient.isOnline}
                >
                  <FaVideo />
                </button>
              )}
            </>
          )}


          <button
            className={styles.chatHeaderBtn}
            onClick={onClose}
            aria-label="Close chat"
            title="Close chat"
          >
            <FaTimes />
          </button>
        </div>
      </div>

      {user?.accountTier === "FREE" && !isMinimized && (
        <div className={styles.premiumBanner}>
          <div>
            <FaCrown className={styles.premiumIcon} />
            <span>Upgrade to send messages and make calls</span>
          </div>
          <button
            className={styles.upgradeBtn}
            onClick={() => navigate("/subscription")}
            aria-label="Upgrade to premium"
          >
            Upgrade
          </button>
        </div>
      )}

      {isCallActive && !isMinimized && (
        <div className={styles.activeCallBanner}>
          <div>
            <FaVideo className={styles.callIcon} />
            <span>Call with {recipient.nickname}</span>
          </div>
          <button
            className={styles.endCallBtn}
            onClick={handleEndCall}
            aria-label="End call"
          >
            <FaPhoneSlash /> End
          </button>
        </div>
      )}

      <div className={styles.messagesContainer} ref={messagesContainerRef}>
          {/* Incoming Call Banner */}
          {incomingCall && !isCallActive && (
            <div className={styles.incomingCallBanner}>
              <div className={styles.incomingCallInfo}>
                <FaVideo className={`${styles.callIcon} pulse`} />
                <span>{recipient.nickname} is calling you</span>
              </div>
              <div className={styles.incomingCallActions}>
                <button
                  className={styles.declineCallBtnSmall}
                  onClick={() => {
                    // Decline the call
                    socketService.answerVideoCall(
                      incomingCall.callerId, 
                      false, 
                      incomingCall.callId
                    );
                    
                    // Add a system message
                    const systemMessage = {
                      _id: generateUniqueId(),
                      sender: "system",
                      content: `You declined a video call from ${recipient.nickname}.`,
                      createdAt: new Date().toISOString(),
                      type: "system",
                    };
                    
                    setMessagesData((prev) => [...prev, systemMessage]);
                    setIncomingCall(null);
                  }}
                  aria-label="Decline call"
                >
                  <FaTimes />
                </button>
                <button
                  className={styles.acceptCallBtnSmall}
                  onClick={() => {
                    // Accept the call
                    socketService.answerVideoCall(
                      incomingCall.callerId, 
                      true, 
                      incomingCall.callId
                    );
                    
                    // Add a system message
                    const systemMessage = {
                      _id: generateUniqueId(),
                      sender: "system",
                      content: `You accepted a video call from ${recipient.nickname}.`,
                      createdAt: new Date().toISOString(),
                      type: "system",
                    };
                    
                    setMessagesData((prev) => [...prev, systemMessage]);
                    
                    // Activate the call
                    setIsCallActive(true);
                  }}
                  aria-label="Accept call"
                >
                  <FaVideo />
                </button>
              </div>
            </div>
          )}
          
          {loading ? (
            <div className={styles.loadingMessages}>
              <div className={styles.spinner}></div>
              <p>
                {loadingTimeout 
                  ? "This is taking longer than expected. Please wait..." 
                  : "Loading messages..."}
              </p>
              {loadingTimeout && (
                <div className={styles.loadingActions}>
                  <button 
                    className={styles.refreshButton} 
                    onClick={() => refresh()}
                    aria-label="Retry loading messages"
                  >
                    Retry
                  </button>
                  <button 
                    className={styles.resetButton} 
                    onClick={() => {
                      // Force refresh the entire chat
                      if (socketService && socketService.reconnect) {
                        socketService.reconnect();
                        toast.info("Reconnecting...");
                        setTimeout(() => {
                          refresh();
                        }, 1000);
                      } else {
                        refresh();
                      }
                    }}
                    aria-label="Force reconnect"
                  >
                    Reconnect
                  </button>
                </div>
              )}
            </div>
          ) : error ? (
            <div className={styles.messageError}>
              <FaExclamationCircle />
              <p>{error}</p>
              <div className={styles.errorActions}>
                <button 
                  onClick={() => refresh()} 
                  className={styles.retryButton}
                  aria-label="Retry loading messages"
                >
                  Retry Loading
                </button>
                {!initialized && (
                  <button 
                    onClick={() => {
                      // Force re-initialization of chat service
                      if (user && isAuthenticated) {
                        console.log("Forcing chat service re-initialization...");
                        // First try to fix user ID if needed
                        const updatedUser = { 
                          ...user, 
                          _id: user._id || user.id,
                          id: user.id || user._id
                        };
                        
                        // Initialize the chat service directly
                        import('../services/ChatService').then(module => {
                          const chatService = module.default;
                          chatService.initialize(updatedUser)
                            .then(() => {
                              console.log("Chat service manually initialized");
                              refresh();
                            })
                            .catch(err => {
                              console.error("Manual initialization failed:", err);
                              toast.error("Chat initialization failed. Please refresh the page.");
                            });
                        });
                      } else {
                        toast.error("Cannot initialize chat: not authenticated. Please log in again.");
                      }
                    }}
                    className={styles.initButton}
                    aria-label="Force initialization"
                  >
                    Force Init
                  </button>
                )}
              </div>
            </div>
          ) : !initialized ? (
            <div className={styles.loadingMessages}>
              <div className={styles.spinner}></div>
              <p>Initializing chat...</p>
            </div>
          ) : !messagesData || messagesData.length === 0 ? (
            <div className={styles.noMessages}>
              <p>No messages yet. Say hello!</p>
            </div>
          ) : (
            Object.entries(groupMessagesByDate()).map(([date, msgs]) => (
              <React.Fragment key={date}>
                <div className={styles.messageDate}>{date}</div>
                {msgs.map((message) => (
                  <div
                    key={message._id || message.tempId}
                    className={`${styles.message} ${
                      message.sender === user?._id ? styles.sent : styles.received
                    } ${message.type === "system" ? styles.systemMessage : ""} ${
                      message.error ? styles.error : ""
                    } ${message.pending ? styles.pending : ""}`}
                  >
                    {message.type === "text" && (
                      <>
                        <p className={styles.messageContent}>{message.content}</p>
                        <span className={styles.messageTime}>
                          {formatMessageTime(message.createdAt)}
                          {message.sender === user?._id && (
                            message.pending ? (
                              <span className={styles.pendingIndicator}>●</span>
                            ) : message.error ? (
                              <span className={styles.errorIndicator}>!</span>
                            ) : message.read ? (
                              <FaCheckDouble className={styles.readIndicator} />
                            ) : (
                              <FaCheck className={styles.readIndicator} />
                            )
                          )}
                        </span>
                      </>
                    )}

                    {message.type === "wink" && (
                      <div className={styles.winkMessage}>
                        <p className={styles.messageContent}>😉</p>
                        <span className={styles.messageLabel}>Wink</span>
                      </div>
                    )}

                    {message.type === "video" && (
                      <div className={styles.videoCallMessage}>
                        <FaVideo className={styles.videoIcon} />
                        <p className={styles.messageContent}>Video Call</p>
                        <span className={styles.messageTime}>{formatMessageTime(message.createdAt)}</span>
                      </div>
                    )}

                    {message.type === "file" && renderFileMessage(message)}

                    {message.type === "system" && (
                      <div className={`${styles.systemMessageContent} ${message.error ? styles.errorContent : ''}`}>
                        <p>{message.content}</p>
                        <span className={styles.messageTime}>{formatMessageTime(message.createdAt)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </React.Fragment>
            ))
          )}

          {typingStatus && (
            <div className={styles.typingIndicator}>
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

      {attachment && (
        <div className={styles.attachmentPreview}>
          <div className={styles.attachmentInfo}>
            {getFileIcon(attachment)}
            <span className={styles.attachmentName}>{attachment.name}</span>
            <span className={styles.attachmentSize}>({Math.round(attachment.size / 1024)} KB)</span>
          </div>

          {isUploading ? (
            <div className={styles.uploadProgressContainer}>
              <div
                className={styles.uploadProgressBar}
                style={{ width: `${uploadProgress}%` }}
              ></div>
              <span className={styles.uploadProgressText}>{uploadProgress}%</span>
            </div>
          ) : (
            <button
              className={styles.removeAttachment}
              onClick={handleRemoveAttachment}
              disabled={isUploading}
            >
              <FaTimes />
            </button>
          )}
        </div>
      )}

      <form className={styles.messageInput} onSubmit={handleSendMessage}>
          <button
            type="button"
            className={styles.inputEmoji}
            onClick={() => setShowEmojis(!showEmojis)}
            title="Add Emoji"
            aria-label="Add emoji"
            disabled={isUploading || isSending}
          >
            <FaSmile />
          </button>

          {showEmojis && (
            <div className={styles.emojiPicker}>
              <div className={styles.emojiHeader}>
                <h4>Emojis</h4>
                <button onClick={() => setShowEmojis(false)} aria-label="Close emoji picker">
                  <FaTimes />
                </button>
              </div>
              <div className={styles.emojiList}>
                {commonEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleEmojiClick(emoji)}
                    aria-label={`Emoji ${emoji}`}
                  >
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
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            ref={chatInputRef}
            disabled={isSending || isUploading || user?.accountTier === "FREE"}
            aria-label="Message input"
            title={user?.accountTier === "FREE" ? "Upgrade to send text messages" : "Type a message"}
          />

          <button
            type="button"
            className={styles.inputAttachment}
            onClick={handleFileAttachment}
            disabled={isSending || isUploading || user?.accountTier === "FREE"}
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
            className={styles.inputWink}
            onClick={handleSendWink}
            disabled={isSending || isUploading}
            title="Send Wink"
            aria-label="Send wink"
          >
            <FaHeart />
          </button>

          <button
            type="submit"
            className={styles.inputSend}
            disabled={(!newMessage.trim() && !attachment) || isSending || isUploading}
            title="Send Message"
            aria-label="Send message"
          >
            {isSending || isUploading ? <FaSpinner className="fa-spin" /> : <FaPaperPlane />}
          </button>
        </form>

      {/* Video Call UI */}
      {isCallActive && (
        <div className={`${styles.videoCallOverlay} ${isCallActive ? styles.active : ''}`}>
          <VideoCall 
            isActive={isCallActive}
            userId={user?._id}
            recipientId={recipient?._id}
            onEndCall={handleEndCall}
            isIncoming={incomingCall !== null}
            callId={incomingCall?.callId}
          />
        </div>
      )}

      {/* We've removed the Incoming Call overlay and now only use the in-chat banner */}
    </div>
  )
}

export default EmbeddedChat