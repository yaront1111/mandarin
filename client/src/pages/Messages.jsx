"use client";

import React, { useState, useEffect, useRef, useContext, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import chatService from "../services/ChatService";
import { formatMessagePreview, groupMessagesByDate, formatDate, classNames } from "../utils";
import LoadingSpinner from "../components/common/LoadingSpinner";
import Avatar from "../components/common/Avatar";
import AuthContext from "../context/AuthContext";
import { Navbar } from "../components/LayoutComponents";
import {
  FaEnvelope,
  FaPaperPlane,
  FaCircle,
  FaEllipsisH,
  FaCheckDouble,
  FaCheck,
  FaVideo,
  FaPhoneSlash,
  FaSmile,
  FaHeart,
  FaPaperclip,
  FaTimes,
  FaSpinner,
  FaCrown,
  FaFile,
  FaImage,
  FaFileAlt,
  FaFilePdf,
  FaFileVideo,
  FaFileAudio,
} from "react-icons/fa";
import VideoCall from "../components/VideoCall";
import socketService from "../services/socketService";
import styles from "../styles/Messages.module.css";

// Counter to guarantee unique system message IDs
let idCounter = 0;
const generateUniqueId = () => {
  idCounter++;
  return `system-${Date.now()}-${idCounter}-${Math.random().toString(36).substring(2, 15)}`;
};

const Messages = () => {
  // Context and router hooks
  const { userId: targetUserIdParam } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, loading: authLoading, isAuthenticated } = useContext(AuthContext);

  // Local state
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [componentLoading, setComponentLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [typingUser, setTypingUser] = useState(null);
  const [mobileView, setMobileView] = useState(window.innerWidth < 768);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showEmojis, setShowEmojis] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSending, setIsSending] = useState(false);

  // Refs
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const chatInitializedRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  // NEW: Ref to store the conversation ID whose messages are currently loaded
  const loadedConversationRef = useRef(null);

  // Common emojis for the emoji picker
  const commonEmojis = ["😊", "😂", "😍", "❤️", "👍", "🙌", "🔥", "✨", "🎉", "🤔", "😉", "🥰"];

  // Responsive sidebar handling
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      setMobileView(isMobile);
      if (!isMobile) setShowSidebar(true);
      else if (activeConversation) setShowSidebar(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeConversation]);

  // Initialize chat service and fetch conversations
  useEffect(() => {
    if (authLoading || !isAuthenticated || !currentUser?._id || chatInitializedRef.current) {
      if (!authLoading && !isAuthenticated) {
        setComponentLoading(false);
        setError("Please log in to view messages.");
      }
      return;
    }
    const initChat = async () => {
      try {
        setComponentLoading(true);
        setError(null);
        await chatService.initialize(currentUser);
        chatInitializedRef.current = true;
        await fetchConversations();
      } catch (err) {
        console.error("Chat initialization error:", err);
        const errorMessage = err.message || "Failed to initialize chat service.";
        setError(errorMessage + " Please refresh the page.");
        toast.error(errorMessage);
        chatInitializedRef.current = false;
      } finally {
        setComponentLoading(false);
      }
    };
    initChat();
  }, [currentUser, isAuthenticated, authLoading]);

  // Socket and notification event listeners
  useEffect(() => {
    if (!chatInitializedRef.current || !currentUser?._id) return;
    const handleMessageReceived = (newMessage) => {
      console.log("Message received:", newMessage);
      
      // IMPORTANT: Enhanced duplicate detection with file awareness
      // Check if this is a message with the same file we just uploaded
      if (newMessage.type === 'file' && window.__lastUploadedFile) {
        const lastFile = window.__lastUploadedFile;
        const msgUrl = newMessage.metadata?.url || newMessage.metadata?.fileUrl;
        
        // If this is the same file we just uploaded, mark it as processed
        if (msgUrl && msgUrl === lastFile.url) {
          console.log("Identified message for the file we just uploaded", lastFile.id);
          window.__lastUploadedFile = null; // Clear it so we don't check again
        }
      }
      
      const partnerId = newMessage.sender === currentUser._id ? newMessage.recipient : newMessage.sender;
      
      if (activeConversation && activeConversation.user._id === partnerId) {
        setMessages((prev) => {
          // Enhanced duplicate detection with special handling for file messages
          let isDuplicate = false;
          
          // First, check for standard duplicates by ID
          isDuplicate = prev.some(msg => 
            msg._id === newMessage._id || 
            (newMessage.tempId && msg.tempId === newMessage.tempId)
          );
          
          // For file messages, do special deduplication
          if (!isDuplicate && newMessage.type === 'file' && newMessage.metadata?.url) {
            // Check if we have any message with this same file URL
            isDuplicate = prev.some(msg => 
              msg.type === 'file' && 
              msg.metadata?.url === newMessage.metadata.url &&
              // Only consider it a duplicate if from same sender and approximately same time
              msg.sender === newMessage.sender &&
              Math.abs(new Date(msg.createdAt) - new Date(newMessage.createdAt)) < 10000
            );
            
            // If we found a duplicate and it's a placeholder, replace it with the real message
            if (isDuplicate) {
              const placeholderIndex = prev.findIndex(msg => 
                msg.type === 'file' && 
                msg.metadata?.url === newMessage.metadata.url &&
                msg.metadata?.__localPlaceholder === true
              );
              
              if (placeholderIndex >= 0) {
                console.log("Replacing placeholder with real message:", newMessage._id);
                const updatedMessages = [...prev];
                updatedMessages[placeholderIndex] = {
                  ...newMessage,
                  metadata: {
                    ...newMessage.metadata,
                    // Keep any client-side enhancements from our placeholder
                    fileUrl: newMessage.metadata.url || newMessage.metadata.fileUrl,
                    // Ensure the URL is always set for both client and server use
                    url: newMessage.metadata.url || newMessage.metadata.fileUrl
                  }
                };
                return updatedMessages;
              }
            }
          }
          
          // Skip if it's a true duplicate
          if (isDuplicate) {
            console.log("Skipping duplicate message:", newMessage._id);
            return prev;
          }
          
          // Add new message with proper sorting
          console.log("Adding new message to chat:", newMessage._id);
          return [...prev, newMessage].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });
        
        // Mark as read since we're looking at the conversation
        chatService.markConversationRead(activeConversation.user._id);
      } else {
        toast.info(`New message from ${newMessage.senderName || "a user"}`);
      }
      
      // Update conversation list regardless
      updateConversationList(newMessage);
    };

    const handleUserTyping = (data) => {
      if (activeConversation && data.userId === activeConversation.user._id) {
        setTypingUser(data.userId);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
      }
    };

    const handleConnectionChanged = (data) => {
      if (data.connected) {
        toast.success("Reconnected to chat server", { autoClose: 2000 });
      } else {
        toast.warning("Disconnected from chat server. Trying to reconnect...");
      }
    };

    // Video call listeners
    const handleIncomingCall = (call) => {
      if (!activeConversation || call.userId !== activeConversation.user._id) return;
      console.debug(`Received incoming call from ${call.userId}`);
      setIncomingCall({
        callId: call.callId,
        callerName: activeConversation.user.nickname,
        callerId: call.userId,
        timestamp: call.timestamp,
      });
      const systemMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: `${activeConversation.user.nickname} is calling you.`,
        createdAt: new Date().toISOString(),
        type: "system",
      };
      setMessages((prev) => [...prev, systemMessage]);
    };

    const handleCallAccepted = (data) => {
      if (!activeConversation || data.userId !== activeConversation.user._id) return;
      console.debug(`Call accepted by ${activeConversation.user.nickname}`);
      const systemMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: `${activeConversation.user.nickname} accepted your call.`,
        createdAt: new Date().toISOString(),
        type: "system",
      };
      setMessages((prev) => [...prev, systemMessage]);
      toast.success(`${activeConversation.user.nickname} accepted your call`);
    };

    const handleCallDeclined = (data) => {
      if (!activeConversation || data.userId !== activeConversation.user._id) return;
      console.debug(`Call declined by ${activeConversation.user.nickname}`);
      const systemMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: `${activeConversation.user.nickname} declined your call.`,
        createdAt: new Date().toISOString(),
        type: "system",
      };
      setMessages((prev) => [...prev, systemMessage]);
      setIsCallActive(false);
      toast.info(`${activeConversation.user.nickname} declined your call`);
    };

    const handleCallHangup = (data) => {
      if (!activeConversation || data.userId !== activeConversation.user._id) return;
      console.debug(`Call hung up by ${activeConversation.user.nickname}`);
      if (isCallActive) handleEndCall();
    };

    const unsubscribeMessage = chatService.on("messageReceived", handleMessageReceived);
    const unsubscribeTyping = chatService.on("userTyping", handleUserTyping);
    const unsubscribeConnection = chatService.on("connectionChanged", handleConnectionChanged);
    const unsubscribeIncomingCall = socketService.on("incomingCall", handleIncomingCall);
    const unsubscribeCallAccepted = socketService.on("callAccepted", handleCallAccepted);
    const unsubscribeCallDeclined = socketService.on("callDeclined", handleCallDeclined);
    const unsubscribeVideoHangup = socketService.on("videoHangup", handleCallHangup);

    return () => {
      unsubscribeMessage();
      unsubscribeTyping();
      unsubscribeConnection();
      unsubscribeIncomingCall();
      unsubscribeCallAccepted();
      unsubscribeCallDeclined();
      unsubscribeVideoHangup();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [activeConversation, currentUser?._id, isCallActive]);

  // Load conversation based on URL parameter (if provided)
  useEffect(() => {
    if (chatInitializedRef.current && targetUserIdParam && conversations.length > 0) {
      const conversation = conversations.find((c) => c.user._id === targetUserIdParam);
      if (conversation && (!activeConversation || activeConversation.user._id !== conversation.user._id)) {
        selectConversation(conversation);
      } else if (!conversation && targetUserIdParam !== currentUser?._id) {
        loadUserDetails(targetUserIdParam);
      }
    }
  }, [targetUserIdParam, conversations, currentUser?._id, activeConversation, navigate]);

  // Load messages for the active conversation with a guard
  useEffect(() => {
    if (!activeConversation?.user?._id || !currentUser?._id) {
      setMessages([]);
      return;
    }
    // Only load messages if the conversation ID has changed
    if (loadedConversationRef.current === activeConversation.user._id) return;
    loadedConversationRef.current = activeConversation.user._id;

    // Do not clear messages immediately—keep old ones visible until new ones arrive
    setMessagesLoading(true);
    (async () => {
      try {
        await loadMessages(activeConversation.user._id);
        if (targetUserIdParam !== activeConversation.user._id) {
          navigate(`/messages/${activeConversation.user._id}`, { replace: true });
        }
        markConversationAsRead(activeConversation.user._id);
        messageInputRef.current?.focus();
        if (mobileView) setShowSidebar(false);
      } catch (err) {
        console.error("Error in loading messages:", err);
      } finally {
        setMessagesLoading(false);
      }
    })();
  }, [activeConversation, currentUser?._id, targetUserIdParam, mobileView, navigate]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Helper Functions ---

  const fetchConversations = async () => {
    if (!currentUser?._id) return;
    try {
      const conversationsData = await chatService.getConversations();
      const filteredConversations = conversationsData.filter(
        (conversation) => conversation.user._id !== currentUser._id
      );
      setConversations(filteredConversations);
      if (
        targetUserIdParam &&
        !filteredConversations.find((c) => c.user._id === targetUserIdParam) &&
        targetUserIdParam !== currentUser._id
      ) {
        loadUserDetails(targetUserIdParam);
      }
    } catch (err) {
      console.error("Error fetching conversations:", err);
      setError("Failed to load conversations");
      toast.error("Failed to load conversations");
    }
  };

  const loadUserDetails = async (idToLoad) => {
    if (!idToLoad || idToLoad === currentUser?._id) {
      console.warn("Attempted to load own user details or null ID");
      return;
    }
    try {
      setMessagesLoading(true);
      const isValidId = /^[0-9a-fA-F]{24}$/.test(idToLoad);
      if (!isValidId) {
        console.error("Invalid user ID format:", idToLoad);
        toast.error("Invalid User ID provided.");
        navigate("/messages", { replace: true });
        throw new Error("Invalid user ID format");
      }
      const token =
        chatService.getAuthToken?.() ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("authToken");
      if (!token) {
        console.warn("No authentication token found");
      }
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch(`/api/users/${idToLoad}`, { headers });
      if (!response.ok) {
        console.warn(`API error ${response.status} fetching user ${idToLoad}.`);
        toast.error(`Could not find or load user details (Error: ${response.status}).`);
        navigate("/messages", { replace: true });
        throw new Error(`User API request failed with status ${response.status}`);
      }
      const result = await response.json();
      const userDetail = result.data?.user || result.user || result;
      if (userDetail?._id) {
        const newConvo = {
          user: {
            _id: userDetail._id,
            nickname: userDetail.nickname || userDetail.name || "Unknown User",
            photo: userDetail.photos?.[0]?.url || userDetail.photo || null,
            isOnline: userDetail.isOnline || false,
            accountTier: userDetail.accountTier || "FREE",
          },
          lastMessage: null,
          unreadCount: 0,
        };
        setConversations((prev) =>
          prev.find((c) => c.user._id === idToLoad) ? prev : [newConvo, ...prev]
        );
        setActiveConversation(newConvo);
        setMessages([]);
      } else {
        throw new Error("User data not found in API response");
      }
    } catch (err) {
      console.error(`Error loading user details for ${idToLoad}:`, err);
      let errorMessage = "Could not load user details.";
      if (err.message === "Invalid user ID format") {
        errorMessage = "Invalid user ID provided.";
      } else if (err.message.includes("failed with status")) {
        errorMessage = `Could not retrieve user information. ${err.message}`;
      }
      setError(errorMessage);
      if (
        !err.message.includes("Invalid user ID format") &&
        !err.message.includes("failed with status")
      ) {
        navigate("/messages", { replace: true });
      }
    } finally {
      setMessagesLoading(false);
    }
  };

  const loadMessages = async (partnerUserId) => {
    if (!currentUser?._id || !partnerUserId || partnerUserId === currentUser._id) {
      console.warn("Attempted to load messages with self or invalid partner ID");
      setMessages([]);
      setMessagesLoading(false);
      return;
    }
    const isValidId = /^[0-9a-fA-F]{24}$/.test(partnerUserId);
    if (!isValidId) {
      console.error(`Invalid partner user ID format: ${partnerUserId}`);
      toast.error("Cannot load messages: Invalid user ID format");
      setMessages([]);
      setMessagesLoading(false);
      setError("Cannot load messages for this user (Invalid ID).");
      return;
    }
    setMessagesLoading(true);
    try {
      const messagesData = await chatService.getMessages(partnerUserId);
      setMessages(
        messagesData.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      );
      setError(null);
    } catch (err) {
      console.error("Error fetching messages:", err);
      toast.error(`Failed to load messages: ${err.message || "Server error"}`);
      setError(`Failed to load messages. ${err.message || ""}`);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSendMessage = async () => {
    const trimmedMessage = messageInput.trim();
    if (!trimmedMessage || !activeConversation || !currentUser?._id) return;
    if (activeConversation.user._id === currentUser._id) {
      toast.error("Cannot send messages to yourself");
      return;
    }
    const partnerId = activeConversation.user._id;
    if (!/^[0-9a-fA-F]{24}$/.test(partnerId)) {
      toast.error("Cannot send message: Invalid recipient ID format.");
      console.error("Attempted to send message to invalid ID format:", partnerId);
      return;
    }
    if (currentUser?.accountTier === "FREE" && trimmedMessage !== "😉") {
      toast.error("Free accounts can only send winks. Upgrade to send messages.");
      return;
    }
    setMessageInput("");
    setIsSending(true);
    try {
      const sentMessage = await chatService.sendMessage(partnerId, trimmedMessage);
      setMessages((prev) =>
        prev
          .map((msg) => (msg._id === sentMessage.tempId ? sentMessage : msg))
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      );
      updateConversationList(sentMessage);
    } catch (err) {
      console.error("Error sending message:", err);
      toast.error(`Failed to send message: ${err.message || "Please try again."}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendWink = async () => {
    if (!activeConversation || !currentUser?._id || isSending) return;
    if (activeConversation.user._id === currentUser._id) {
      toast.error("Cannot send winks to yourself");
      return;
    }
    const partnerId = activeConversation.user._id;
    if (!/^[0-9a-fA-F]{24}$/.test(partnerId)) {
      toast.error("Cannot send wink: Invalid recipient ID format.");
      console.error("Attempted to send wink to invalid ID format:", partnerId);
      return;
    }
    setIsSending(true);
    try {
      const sentMessage = await chatService.sendMessage(partnerId, "😉", "wink");
      setMessages((prev) =>
        prev
          .map((msg) => (msg._id === sentMessage.tempId ? sentMessage : msg))
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      );
      updateConversationList(sentMessage);
    } catch (err) {
      console.error("Error sending wink:", err);
      toast.error(`Failed to send wink: ${err.message || "Please try again."}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileAttachment = () => {
    if (currentUser?.accountTier === "FREE") {
      return toast.error("Free accounts cannot send files. Upgrade to send files.");
    }
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 5MB.");
      e.target.value = null;
      return;
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
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error("File type not supported.");
      e.target.value = null;
      return;
    }
    setAttachment(file);
    toast.info(`Selected file: ${file.name}`);
    e.target.value = null;
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSendAttachment = async () => {
    if (!attachment || !activeConversation?.user?._id || isUploading) return;
    if (activeConversation.user._id === currentUser._id) {
      toast.error("Cannot send files to yourself");
      return;
    }
    const partnerId = activeConversation.user._id;
    if (!/^[0-9a-fA-F]{24}$/.test(partnerId)) {
      toast.error("Cannot send file: Invalid recipient ID format.");
      console.error("Attempted to send file to invalid ID format:", partnerId);
      return;
    }
    if (currentUser?.accountTier === "FREE") {
      toast.error("Free accounts cannot send files. Upgrade to send files.");
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(10); // Start progress at 10%
    
    try {
      // Direct approach with manual XHR for better control
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("file", attachment);
      formData.append("recipient", partnerId);
      
      // Set up upload progress tracking
      xhr.upload.addEventListener("progress", event => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 90) + 10;
          setUploadProgress(percentComplete);
        }
      });
      
      // Promise-based XHR
      const uploadFile = () => {
        return new Promise((resolve, reject) => {
          xhr.open("POST", "/api/messages/attachments");
          
          // Add auth token - ensure it's defined in this scope
          const authToken = localStorage.getItem("token") || 
                           sessionStorage.getItem("token") || 
                           localStorage.getItem("authToken") || 
                           sessionStorage.getItem("authToken");
                           
          if (authToken) {
            xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);
          }
          
          xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const result = JSON.parse(xhr.responseText);
                resolve(result);
              } catch (e) {
                reject(new Error("Invalid response format"));
              }
            } else {
              reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
            }
          };
          
          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.send(formData);
        });
      };
      
      // Upload the file
      const uploadResult = await uploadFile();
      
      // Set upload complete
      setUploadProgress(100);
      
      if (!uploadResult.success || !uploadResult.data) {
        throw new Error(uploadResult.error || "File upload failed");
      }
      
      // Create message metadata with URLs
      const fileData = uploadResult.data;
      const messageData = {
        recipient: partnerId,
        type: "file",
        content: fileData.fileName || "File attachment",
        metadata: {
          url: fileData.url,
          fileUrl: fileData.url,
          fileName: fileData.fileName,
          fileType: fileData.mimeType,
          mimeType: fileData.mimeType,
          fileSize: fileData.fileSize,
          thumbnail: fileData.metadata?.thumbnail
        }
      };
      
      // Use the same authToken approach consistently for all requests
      const messageAuthToken = localStorage.getItem("token") || 
                              sessionStorage.getItem("token") || 
                              localStorage.getItem("authToken") || 
                              sessionStorage.getItem("authToken");
      
      // Log the token presence for debugging (not the actual token for security)
      console.log("Message send auth token available:", !!messageAuthToken);
      
      // Use direct API call to avoid any event issues
      const messageResponse = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": messageAuthToken ? `Bearer ${messageAuthToken}` : ""
        },
        body: JSON.stringify(messageData)
      });
      
      if (!messageResponse.ok) {
        throw new Error(`Message send failed: ${messageResponse.status}`);
      }
      
      const messageResult = await messageResponse.json();
      
      if (!messageResult.success) {
        throw new Error(messageResult.error || "Failed to send message");
      }
      
      // Add the message directly to our UI
      const finalMessage = messageResult.data;
      finalMessage.metadata = {
        ...finalMessage.metadata,
        url: fileData.url,
        fileUrl: fileData.url,
        fileType: fileData.mimeType || "image/jpeg",
        mimeType: fileData.mimeType || "image/jpeg"
      };
      
      // Manually load the latest messages
      await loadMessages(partnerId);
      
      toast.success("File sent successfully");
      
      // Reset state
      setAttachment(null);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Failed to send file:", error);
      toast.error(error.message || "Failed to send file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleEmojiClick = (emoji) => {
    setMessageInput((prev) => prev + emoji);
    setShowEmojis(false);
    if (messageInputRef.current) {
      messageInputRef.current.focus();
    }
  };

  const handleVideoCall = async () => {
    if (!activeConversation || !currentUser?._id) return;
    if (!socketService.isConnected || !socketService.isConnected()) {
      const errorMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: "Cannot start call: connection issue. Please refresh and try again.",
        createdAt: new Date().toISOString(),
        type: "system",
        error: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
      console.error("Cannot initiate call - socket not connected");
      return;
    }
    if (!activeConversation.user.isOnline) {
      const errorMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: `${activeConversation.user.nickname} is currently offline. You can only call users who are online.`,
        createdAt: new Date().toISOString(),
        type: "system",
        error: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }
    if (currentUser?.accountTier === "FREE") {
      const errorMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: "Free accounts cannot make video calls. Upgrade for video calls.",
        createdAt: new Date().toISOString(),
        type: "system",
        error: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }
    const partnerId = activeConversation.user._id;
    if (!/^[0-9a-fA-F]{24}$/.test(partnerId)) {
      const errorMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: "Cannot start call: Invalid recipient ID.",
        createdAt: new Date().toISOString(),
        type: "system",
        error: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
      console.error("Cannot initiate call - invalid recipient ID:", partnerId);
      return;
    }
    try {
      const infoMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: `Initiating call to ${activeConversation.user.nickname}...`,
        createdAt: new Date().toISOString(),
        type: "system",
      };
      setMessages((prev) => [...prev, infoMessage]);
      setIsCallActive(true);
      const systemMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: `You started a video call with ${activeConversation.user.nickname}.`,
        createdAt: new Date().toISOString(),
        type: "system",
      };
      setMessages((prev) => [...prev, systemMessage]);
      socketService
        .initiateVideoCall(activeConversation.user._id)
        .then((data) => {
          console.debug("Call initiation successful:", data);
        })
        .catch((err) => {
          console.error("Call initiation error:", err);
          const errorMessage = {
            _id: generateUniqueId(),
            sender: "system",
            content: `Call failed to initiate: ${err.message || "Unknown error"}`,
            createdAt: new Date().toISOString(),
            type: "system",
            error: true,
          };
          setMessages((prev) => [...prev, errorMessage]);
        });
    } catch (error) {
      console.error("Video call initiation error:", error);
      const errorMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: error.message || "Could not start video call. Please try again.",
        createdAt: new Date().toISOString(),
        type: "system",
        error: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsCallActive(false);
    }
  };

  const handleEndCall = () => {
    if (isCallActive && activeConversation) {
      const partnerId = activeConversation.user._id;
      if (/^[0-9a-fA-F]{24}$/.test(partnerId)) {
        socketService.emit("videoHangup", { recipientId: partnerId });
      } else {
        console.warn("Cannot emit hangup for invalid partner ID:", partnerId);
      }
    }
    setIsCallActive(false);
    setIncomingCall(null);
    if (activeConversation) {
      const systemMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: `Video call with ${activeConversation.user.nickname} ended.`,
        createdAt: new Date().toISOString(),
        type: "system",
      };
      setMessages((prev) => [...prev, systemMessage]);
    }
  };

  const updateConversationList = (newMessage) => {
    if (!currentUser?._id) return;
    const partnerId = newMessage.sender === currentUser._id ? newMessage.recipient : newMessage.sender;
    if (partnerId === currentUser._id) return;
    if (!/^[0-9a-fA-F]{24}$/.test(partnerId)) {
      console.warn("Received message with invalid partner ID format, not updating conversation list:", partnerId);
      return;
    }
    setConversations((prev) => {
      let updatedConvo = prev.find((c) => c.user._id === partnerId);
      if (updatedConvo) {
        updatedConvo = { ...updatedConvo, lastMessage: newMessage };
        if (newMessage.sender !== currentUser._id && (!activeConversation || activeConversation.user._id !== partnerId))
          updatedConvo.unreadCount = (updatedConvo.unreadCount || 0) + 1;
        else if (activeConversation && activeConversation.user._id === partnerId)
          updatedConvo.unreadCount = 0;
        return [updatedConvo, ...prev.filter((c) => c.user._id !== partnerId)];
      } else {
        const newConvo = {
          user: {
            _id: partnerId,
            nickname: newMessage.senderName || `User ${partnerId.substring(0, 6)}`,
            photo: newMessage.senderPhoto || null,
            isOnline: false,
            accountTier: "FREE",
          },
          lastMessage: newMessage,
          unreadCount: newMessage.sender !== currentUser._id ? 1 : 0,
        };
        return [newConvo, ...prev];
      }
    });
  };

  const markConversationAsRead = (partnerUserId) => {
    if (partnerUserId === currentUser?._id) return;
    if (!/^[0-9a-fA-F]{24}$/.test(partnerUserId)) {
      console.warn("Attempted to mark conversation read for invalid ID format:", partnerUserId);
      return;
    }
    const convoIndex = conversations.findIndex((c) => c.user._id === partnerUserId);
    if (convoIndex !== -1 && conversations[convoIndex].unreadCount > 0) {
      chatService.markConversationRead(partnerUserId);
      setConversations((prev) =>
        prev.map((c, index) => (index === convoIndex ? { ...c, unreadCount: 0 } : c))
      );
    }
  };

  const sendTypingIndicator = useCallback(() => {
    if (activeConversation && chatService.isConnected && chatService.isConnected() && currentUser?._id) {
      const partnerId = activeConversation.user._id;
      if (/^[0-9a-fA-F]{24}$/.test(partnerId)) {
        chatService.sendTypingIndicator(partnerId);
      } else {
        console.warn("Cannot send typing indicator for invalid partner ID:", partnerId);
      }
    }
  }, [activeConversation, currentUser?._id]);

  const handleMessageInputChange = (e) => {
    setMessageInput(e.target.value);
    if (e.target.value.trim() && activeConversation) {
      if (/^[0-9a-fA-F]{24}$/.test(activeConversation.user._id)) {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => sendTypingIndicator(), 300);
      }
    }
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (attachment) {
        handleSendAttachment();
      } else {
        handleSendMessage();
      }
      if (e.target) e.target.style.height = "auto";
    }
  };

  const selectConversation = (conversation) => {
    if (!conversation?.user?._id || (activeConversation && activeConversation.user._id === conversation.user._id))
      return;
    if (conversation.user._id === currentUser?._id) {
      toast.warning("You cannot message yourself");
      return;
    }
    if (!/^[0-9a-fA-F]{24}$/.test(conversation.user._id)) {
      toast.error("Cannot select conversation: Invalid user ID.");
      console.error("Attempted to select conversation with invalid ID:", conversation.user._id);
      return;
    }
    setActiveConversation(conversation);
    setError(null);
    markConversationAsRead(conversation.user._id);
  };

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  const groupedMessages = groupMessagesByDate(messages);

  const getFileIcon = (fileType) => {
    if (!fileType) return <FaFile />;
    if (fileType.startsWith("image/")) return <FaImage />;
    if (fileType.startsWith("video/")) return <FaFileVideo />;
    if (fileType.startsWith("audio/")) return <FaFileAudio />;
    if (fileType === "application/pdf") return <FaFilePdf />;
    return <FaFileAlt />;
  };

  if (componentLoading || authLoading) {
    return (
      <div className={styles.appWrapper}>
        <Navbar />
        <div className={styles.loadingContainer}>
          <LoadingSpinner size="large" text={authLoading ? "Authenticating..." : "Loading chats..."} centered />
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !authLoading) {
    return (
      <div className={styles.appWrapper}>
        <Navbar />
        <div className={styles.errorContainer}>
          <p>Please log in to view and send messages.</p>
          <button onClick={() => navigate("/login")} className={styles.btnPrimary}>Login</button>
        </div>
      </div>
    );
  }

  if (error && !activeConversation) {
    return (
      <div className={styles.appWrapper}>
        <Navbar />
        <div className={styles.errorContainer}>
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className={styles.btnPrimary}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.appWrapper}>
      <Navbar />
      <div className={styles.messagesContainer}>
        <div className={`${styles.sidebar} ${showSidebar ? styles.show : styles.hide}`}>
          <div className={styles.sidebarHeader}>
            <h2>Messages</h2>
            {mobileView && activeConversation && (
              <button className={styles.backButton} onClick={toggleSidebar}>
                &times;
              </button>
            )}
          </div>
          {conversations.length === 0 && !componentLoading ? (
            <div className={styles.noConversations}>
              <FaEnvelope size={32} />
              <p>No conversations yet.</p>
            </div>
          ) : (
            <div className={styles.conversationsList}>
              {conversations.map((convo) => {
                if (!convo || !convo.user || !convo.user._id) {
                  console.warn("Skipping rendering invalid conversation item:", convo);
                  return null;
                }
                return (
                  <div
                    key={convo.user._id}
                    className={`${styles.conversationItem} ${activeConversation?.user._id === convo.user._id ? styles.active : ""} ${convo.unreadCount > 0 ? styles.unread : ""}`}
                    onClick={() => selectConversation(convo)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={styles.avatarContainer}>
                      <Avatar src={convo.user.photo} alt={convo.user.nickname} size="medium" />
                      {convo.user.isOnline && <span className={`${styles.statusIndicator} ${styles.online}`}></span>}
                    </div>
                    <div className={styles.conversationInfo}>
                      <div className={styles.conversationName}>
                        <span>{convo.user.nickname || "Unknown User"}</span>
                        {convo.unreadCount > 0 && <span className={styles.unreadBadge}>{convo.unreadCount}</span>}
                      </div>
                      <div className={styles.conversationPreview}>
                        {convo.lastMessage ? formatMessagePreview(convo.lastMessage, currentUser._id) : "No messages yet"}
                      </div>
                    </div>
                    {convo.lastMessage?.createdAt && (
                      <div className={styles.conversationTime}>
                        {formatDate(convo.lastMessage.createdAt, { showRelative: true })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className={`${styles.chatArea} ${!showSidebar && mobileView ? styles.fullWidth : ""}`}>
          {activeConversation ? (
            <>
              <div className={styles.chatHeader}>
                {activeConversation.user && activeConversation.user._id ? (
                  <div className={styles.chatUser}>
                    {mobileView && (
                      <button className={styles.backButton} onClick={toggleSidebar}>
                        &larr;
                      </button>
                    )}
                    <div className={styles.avatarContainer}>
                      <Avatar src={activeConversation.user.photo} alt={activeConversation.user.nickname} size="medium" />
                      {activeConversation.user.isOnline && <span className={`${styles.statusIndicator} ${styles.online}`}></span>}
                    </div>
                    <div className={styles.chatUserDetails}>
                      <h3>{activeConversation.user.nickname || "Unknown User"}</h3>
                      <span className={activeConversation.user.isOnline ? `${styles.statusText} ${styles.online}` : `${styles.statusText} ${styles.offline}`}>
                        {activeConversation.user.isOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                    <div className={styles.chatActions}>
                      {currentUser?.accountTier !== "FREE" && (
                        <>
                          {isCallActive ? (
                            <button className={styles.actionButton} onClick={handleEndCall} title="End call">
                              <FaPhoneSlash />
                            </button>
                          ) : (
                            <button
                              className={styles.actionButton}
                              onClick={handleVideoCall}
                              title={activeConversation.user.isOnline ? "Start Video Call" : `${activeConversation.user.nickname} is offline`}
                              disabled={!activeConversation.user.isOnline || !/^[0-9a-fA-F]{24}$/.test(activeConversation.user._id)}
                            >
                              <FaVideo />
                            </button>
                          )}
                        </>
                      )}
                      <button className={styles.actionButton}>
                        <FaEllipsisH />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.chatUser}>Loading user...</div>
                )}
              </div>
              {currentUser?.accountTier === "FREE" && (
                <div className={styles.premiumBanner}>
                  <div>
                    <FaCrown className={styles.premiumIcon} />
                    <span>Upgrade to send messages and make calls</span>
                  </div>
                  <button className={styles.upgradeBtn} onClick={() => navigate("/subscription")}>
                    Upgrade
                  </button>
                </div>
              )}
              {isCallActive && (
                <div className={styles.activeCallBanner}>
                  <div>
                    <FaVideo className={styles.callIcon} />
                    <span>Call with {activeConversation.user.nickname}</span>
                  </div>
                  <button className={styles.endCallBtn} onClick={handleEndCall}>
                    <FaPhoneSlash /> End
                  </button>
                </div>
              )}
              {incomingCall && !isCallActive && (
                <div className={styles.incomingCallBanner}>
                  <div className={styles.incomingCallInfo}>
                    <FaVideo className={styles.callIcon} />
                    <span>{activeConversation.user.nickname} is calling you</span>
                  </div>
                  <div className={styles.incomingCallActions}>
                    <button
                      className={styles.declineCallBtn}
                      onClick={() => {
                        if (incomingCall.callerId && /^[0-9a-fA-F]{24}$/.test(incomingCall.callerId)) {
                          socketService.answerVideoCall(incomingCall.callerId, false, incomingCall.callId);
                          const systemMessage = {
                            _id: generateUniqueId(),
                            sender: "system",
                            content: `You declined a video call from ${activeConversation.user.nickname}.`,
                            createdAt: new Date().toISOString(),
                            type: "system",
                          };
                          setMessages((prev) => [...prev, systemMessage]);
                        } else {
                          console.error("Cannot decline call: Invalid caller ID format", incomingCall.callerId);
                          toast.error("Error declining call (Invalid ID).");
                        }
                        setIncomingCall(null);
                      }}
                    >
                      <FaTimes /> Decline
                    </button>
                    <button
                      className={styles.acceptCallBtn}
                      onClick={() => {
                        if (incomingCall.callerId && /^[0-9a-fA-F]{24}$/.test(incomingCall.callerId)) {
                          socketService.answerVideoCall(incomingCall.callerId, true, incomingCall.callId);
                          const systemMessage = {
                            _id: generateUniqueId(),
                            sender: "system",
                            content: `You accepted a video call from ${activeConversation.user.nickname}.`,
                            createdAt: new Date().toISOString(),
                            type: "system",
                          };
                          setMessages((prev) => [...prev, systemMessage]);
                          setIsCallActive(true);
                          setIncomingCall(null);
                        } else {
                          console.error("Cannot accept call: Invalid caller ID format", incomingCall.callerId);
                          toast.error("Error accepting call (Invalid ID).");
                          setIncomingCall(null);
                        }
                      }}
                    >
                      <FaVideo /> Accept
                    </button>
                  </div>
                </div>
              )}
              <div className={styles.messagesArea}>
                {messagesLoading ? (
                  <div className={styles.messagesLoading}>
                    <LoadingSpinner size="medium" text="Loading messages..." centered />
                  </div>
                ) : error ? (
                  <div className={styles.noMessages}>
                    <div className={`${styles.noMessagesContent} ${styles.errorContent}`}>
                      <p>Error:</p>
                      <p>{error}</p>
                      <button onClick={() => loadMessages(activeConversation.user._id)} className={styles.btnSecondary}>
                        Retry Loading Messages
                      </button>
                    </div>
                  </div>
                ) : Object.entries(groupedMessages).length === 0 ? (
                  <div className={styles.noMessages}>
                    <div className={styles.noMessagesContent}>
                      <FaEnvelope size={40} />
                      <p>No messages in this conversation yet.</p>
                      <p className={styles.hint}>Say hello to start the conversation!</p>
                    </div>
                  </div>
                ) : (
                  Object.entries(groupedMessages).map(([date, msgs]) => (
                    <div key={date} className={styles.messageGroup}>
                      <div className={styles.dateSeparator}>
                        <span>{date}</span>
                      </div>
                      {msgs.map((msg) => {
                        if (!msg || (!msg._id && !msg.tempId)) {
                          console.warn("Skipping rendering invalid message:", msg);
                          return null;
                        }
                        const isFromMe = msg.sender === currentUser._id;
                        let statusIndicator = null;
                        if (isFromMe) {
                          statusIndicator = msg.read ? <FaCheckDouble size={12} /> : <FaCheck size={12} />;
                        }
                        return (
                          <div
                            key={msg._id || msg.tempId}
                            className={`${styles.messageBubble} ${isFromMe ? styles.sent : styles.received} ${msg.type === "system" ? styles.systemMessage : ""} ${msg.error ? styles.error : ""} ${msg.type === "wink" ? styles.winkMessage : ""}`}
                          >
                            {msg.type === "system" ? (
                              <div className={`${styles.systemMessageContent} ${msg.error ? styles.errorContent : ""}`}>
                                <p>{msg.content}</p>
                                <span className={styles.messageTime}>
                                  {formatDate(msg.createdAt, { showTime: true, showDate: false })}
                                </span>
                              </div>
                            ) : msg.type === "wink" ? (
                              <div className={styles.winkContent}>
                                <p className={styles.messageContent}>😉</p>
                                <span className={styles.messageLabel}>Wink</span>
                                <span className={styles.messageTime}>
                                  {formatDate(msg.createdAt, { showTime: true, showDate: false })}
                                  {isFromMe && <span className={styles.statusIndicator}>{statusIndicator}</span>}
                                </span>
                              </div>
                            ) : msg.type === "file" && msg.metadata ? (
                              <div className={styles.fileMessage}>
                                {msg.metadata.fileType?.startsWith("image/") ? (
                                  <div className={styles.imageContainer}>
                                    <a 
                                      href={msg.metadata.fileUrl || msg.metadata.url || "/placeholder.svg"} 
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={styles.imageLink}
                                      onClick={(e) => {
                                        // Prevent the message bubble click event
                                        e.stopPropagation();
                                      }}
                                    >
                                      <img
                                        src={msg.metadata.fileUrl || msg.metadata.url || "/placeholder.svg"}
                                        alt={msg.metadata.fileName || "Image"}
                                        className={`${styles.imageAttachment} ${styles.loading}`}
                                        loading="lazy" /* Add lazy loading for better performance */
                                        onLoad={(e) => {
                                          console.log("Image loaded successfully:", msg.metadata.fileName || "image");
                                          // Remove loading class once image is loaded
                                          e.target.classList.remove(styles.loading);
                                        }}
                                        onError={(e) => {
                                          console.error("Image failed to load:", msg.metadata);
                                          e.target.onerror = null;
                                          e.target.src = "/placeholder.svg";
                                          e.target.classList.remove(styles.loading);
                                        }}
                                      />
                                    </a>
                                    <div className={styles.imgCaption}>
                                      <a 
                                        href={msg.metadata.fileUrl || msg.metadata.url || "/placeholder.svg"} 
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        title={`Open ${msg.metadata.fileName || "image"} in new tab`}
                                      >
                                        {msg.metadata.fileName || "Image"}
                                      </a>
                                    </div>
                                  </div>
                                ) : (
                                  <div className={styles.fileAttachment}>
                                    {getFileIcon(msg.metadata.fileType)}
                                    <span className={styles.fileName}>{msg.metadata.fileName || "File"}</span>
                                    <span className={styles.fileSize}>
                                      {msg.metadata.fileSize ? `(${Math.round(msg.metadata.fileSize / 1024)} KB)` : ""}
                                    </span>
                                    {(msg.metadata.fileUrl || msg.metadata.url) && (
                                      <a
                                        href={msg.metadata.fileUrl || msg.metadata.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.downloadLink}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Download
                                      </a>
                                    )}
                                  </div>
                                )}
                                <span className={styles.messageTime}>
                                  {formatDate(msg.createdAt, { showTime: true, showDate: false })}
                                  {isFromMe && <span className={styles.statusIndicator}>{statusIndicator}</span>}
                                </span>
                              </div>
                            ) : (
                              <>
                                <div className={styles.messageContent}>{msg.content || ""}</div>
                                <div className={styles.messageMeta}>
                                  <span className={styles.messageTime}>
                                    {formatDate(msg.createdAt, { showTime: true, showDate: false })}
                                  </span>
                                  {isFromMe && <span className={styles.statusIndicator}>{statusIndicator}</span>}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
                {typingUser && (
                  <div className={styles.typingIndicator}>
                    <div className={styles.dot}></div>
                    <div className={styles.dot}></div>
                    <div className={styles.dot}></div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              {attachment && (
                <div className={styles.attachmentPreview}>
                  <div className={styles.attachmentInfo}>
                    {getFileIcon(attachment.type)}
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
              {showEmojis && (
                <div className={styles.emojiPicker}>
                  <div className={styles.emojiHeader}>
                    <h4>Emojis</h4>
                    <button onClick={() => setShowEmojis(false)}>
                      <FaTimes />
                    </button>
                  </div>
                  <div className={styles.emojiList}>
                    {commonEmojis.map((emoji) => (
                      <button key={emoji} type="button" onClick={() => handleEmojiClick(emoji)}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className={styles.inputArea}>
                <button
                  type="button"
                  className={styles.emojiButton}
                  onClick={() => setShowEmojis(!showEmojis)}
                  title="Add Emoji"
                >
                  <FaSmile />
                </button>
                <textarea
                  ref={messageInputRef}
                  className={styles.messageInput}
                  placeholder={currentUser?.accountTier === "FREE" ? "Free users can only send winks" : "Type a message..."}
                  value={messageInput}
                  onChange={handleMessageInputChange}
                  onKeyPress={handleKeyPress}
                  rows={1}
                  disabled={isSending || isUploading || (currentUser?.accountTier === "FREE" && messageInput !== "😉")}
                  title={currentUser?.accountTier === "FREE" ? "Upgrade to send text messages" : "Type a message"}
                />
                <button
                  type="button"
                  className={styles.attachButton}
                  onClick={handleFileAttachment}
                  disabled={isSending || isUploading || currentUser?.accountTier === "FREE"}
                  title={currentUser?.accountTier === "FREE" ? "Upgrade to send files" : "Attach File"}
                >
                  <FaPaperclip />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                  accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,audio/mpeg,audio/wav,video/mp4,video/quicktime"
                />
                <button
                  type="button"
                  className={styles.winkButton}
                  onClick={handleSendWink}
                  disabled={isSending || isUploading}
                  title="Send Wink"
                >
                  <FaHeart />
                </button>
                <button
                  onClick={attachment ? handleSendAttachment : handleSendMessage}
                  className={`${styles.sendButton} ${!messageInput.trim() && !attachment ? styles.disabled : ""}`}
                  disabled={(!messageInput.trim() && !attachment) || isSending || isUploading}
                >
                  {isSending || isUploading ? <FaSpinner className="fa-spin" /> : <FaPaperPlane />}
                </button>
              </div>
            </>
          ) : (
            <div className={styles.noActiveChat}>
              <div className={styles.noActiveChatContent}>
                <FaEnvelope size={48} />
                <h3>Your Messages</h3>
                <p>Select a conversation from the list to start chatting.</p>
                {error && <p className={styles.errorMessage}>{error}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
      {isCallActive && activeConversation && activeConversation.user && activeConversation.user._id && /^[0-9a-fA-F]{24}$/.test(activeConversation.user._id) && (
        <div className={styles.videoCallOverlay}>
          <VideoCall
            isActive={isCallActive}
            userId={currentUser?._id}
            recipientId={activeConversation.user._id}
            onEndCall={handleEndCall}
            isIncoming={incomingCall !== null && incomingCall.callerId === activeConversation.user._id}
            callId={incomingCall?.callId}
          />
        </div>
      )}
    </div>
  );
};

export default Messages;
