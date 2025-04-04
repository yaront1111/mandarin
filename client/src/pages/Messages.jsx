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
import VideoCall from "../components/VideoCall"; // Assume this component exists
import socketService from "../services/socketService";

// Import CSS module
import styles from "../styles/Messages.module.css";

// Counter for guaranteeing uniqueness within the same timestamp
let idCounter = 0;

// Helper function to generate unique message IDs for system messages
const generateUniqueId = () => {
  idCounter++;
  return `system-${Date.now()}-${idCounter}-${Math.random().toString(36).substring(2, 15)}`;
}

const Messages = () => {
  // Hooks & context
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

  // New state variables for enhanced features
  const [showEmojis, setShowEmojis] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSending, setIsSending] = useState(false);

  // Refs for scrolling and input focus
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const chatInitializedRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  // Common emojis for emoji picker
  const commonEmojis = ["😊", "😂", "😍", "❤️", "👍", "🙌", "🔥", "✨", "🎉", "🤔", "😉", "🥰"];

  // Handle responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      setMobileView(isMobile);
      if (!isMobile) setShowSidebar(true);
      else if (activeConversation) setShowSidebar(false);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeConversation]);

  // Initialize chat service & fetch conversations once user is authenticated
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

  // Event listeners for chat updates
  useEffect(() => {
    if (!chatInitializedRef.current || !currentUser?._id) return;
    const handleMessageReceived = (newMessage) => {
      const partnerId =
        newMessage.sender === currentUser._id ? newMessage.recipient : newMessage.sender;
      if (activeConversation && activeConversation.user._id === partnerId) {
        setMessages((prev) => {
          if (prev.some((msg) => msg._id === newMessage._id)) return prev;
          return [...prev, newMessage].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });
        chatService.markConversationRead(activeConversation.user._id);
      } else {
        toast.info(`New message from ${newMessage.senderName || "a user"}`);
      }
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

    // New event listener for video calls
    const handleIncomingCall = (call) => {
      // Skip if the call is not from the active conversation
      if (!activeConversation || call.userId !== activeConversation.user._id) return;

      console.debug(`Received incoming call from ${call.userId}`);

      // Set the incoming call data
      setIncomingCall({
        callId: call.callId,
        callerName: activeConversation.user.nickname,
        callerId: call.userId,
        timestamp: call.timestamp
      });

      // Add a system message
      const systemMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: `${activeConversation.user.nickname} is calling you.`,
        createdAt: new Date().toISOString(),
        type: "system",
      };

      setMessages((prev) => [...prev, systemMessage]);
    };

    // Handle call accepted event
    const handleCallAccepted = (data) => {
      if (!activeConversation || data.userId !== activeConversation.user._id) return;

      console.debug(`Call accepted by ${activeConversation.user.nickname}`);

      // Add a system message
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

    // Handle call declined event
    const handleCallDeclined = (data) => {
      if (!activeConversation || data.userId !== activeConversation.user._id) return;

      console.debug(`Call declined by ${activeConversation.user.nickname}`);

      // Add a system message
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

    // Handle call hangup event
    const handleCallHangup = (data) => {
      if (!activeConversation || data.userId !== activeConversation.user._id) return;

      console.debug(`Call hung up by ${activeConversation.user.nickname}`);

      // End the call if it's active
      if (isCallActive) {
        handleEndCall();
      }
    };

    const unsubscribeMessage = chatService.on("messageReceived", handleMessageReceived);
    const unsubscribeTyping = chatService.on("userTyping", handleUserTyping);
    const unsubscribeConnection = chatService.on("connectionChanged", handleConnectionChanged);

    // Register video call event listeners
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

  // Handle invalid IDs (mock user check removed)
  useEffect(() => {
    if (chatInitializedRef.current && targetUserIdParam && conversations.length > 0) {
      // --- MOCK USER CHECK REMOVED ---
      // Original check was here to navigate away if targetUserIdParam included 'mock-user'

      const conversation = conversations.find((c) => c.user._id === targetUserIdParam);
      if (conversation && (!activeConversation || activeConversation.user._id !== conversation.user._id)) {
        selectConversation(conversation);
      } else if (!conversation && targetUserIdParam !== currentUser?._id) { // Check added to prevent loading self
          loadUserDetails(targetUserIdParam);
      }
    }
  }, [targetUserIdParam, conversations, chatInitializedRef.current, navigate, currentUser?._id, activeConversation]); // Added dependencies

  // Load messages when active conversation changes
  useEffect(() => {
    if (activeConversation?.user?._id && currentUser?._id) {
      loadMessages(activeConversation.user._id);
      if (targetUserIdParam !== activeConversation.user._id) {
        navigate(`/messages/${activeConversation.user._id}`, { replace: true });
      }
      markConversationAsRead(activeConversation.user._id);
      messageInputRef.current?.focus();

      // On mobile, hide sidebar when conversation is active
      if (mobileView) {
        setShowSidebar(false);
      }
    } else {
      setMessages([]);
    }
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

      // Filter out conversations where the user is talking to themselves
      const filteredConversations = conversationsData.filter(
        conversation => conversation.user._id !== currentUser._id
      );

      setConversations(filteredConversations);

      // Logic to select conversation based on targetUserIdParam is now handled in the other useEffect
      // We still might need to load details if the param ID isn't in the fetched list
       if (targetUserIdParam && !filteredConversations.find((c) => c.user._id === targetUserIdParam) && targetUserIdParam !== currentUser._id) {
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
        console.warn('Attempted to load own user details or null ID');
        return;
    }

    // --- MOCK USER CHECK REMOVED ---
    // Original check was here to prevent loading mock user details

    try {
      setMessagesLoading(true);
      // Validate user ID format before making the API call
      const isValidId = /^[0-9a-fA-F]{24}$/.test(idToLoad); // Test for MongoDB ObjectId format

      if (!isValidId) {
        // If ID format is invalid, stop here. Previously mock users were caught earlier.
        console.error("Invalid user ID format:", idToLoad);
        toast.error("Invalid User ID provided.");
        navigate("/messages", { replace: true });
        throw new Error("Invalid user ID format"); // Throw error to be caught below
      }

      const token = chatService.getAuthToken?.() ||
                   localStorage.getItem('token') ||
                   sessionStorage.getItem('token') ||
                   localStorage.getItem('authToken') ||
                   sessionStorage.getItem('authToken');

      if (!token) {
        console.warn("No authentication token found");
      }

      const headers = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/users/${idToLoad}`, { headers });

      if (!response.ok) {
          // Handle actual API errors (e.g., 404 Not Found if the ID is valid format but doesn't exist)
          console.warn(`API error ${response.status} fetching user ${idToLoad}.`);
          // Decide how to handle - maybe show error, maybe fallback like before?
          // For now, let's just navigate away and show an error
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
            accountTier: userDetail.accountTier || "FREE" // Add account tier
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
        errorMessage = "Invalid user ID provided."; // Already toasted above
      } else if (err.message.includes("failed with status")) {
         errorMessage = `Could not retrieve user information. ${err.message}`;
      }

      setError(errorMessage); // Set component error state
      // Navigation might have happened already depending on where error occurred
      if (!err.message.includes("Invalid user ID format") && !err.message.includes("failed with status")) {
         // Only navigate if not already handled
         navigate("/messages", { replace: true });
      }
    } finally {
      setMessagesLoading(false);
    }
  };

  const loadMessages = async (partnerUserId) => {
    if (!currentUser?._id || !partnerUserId || partnerUserId === currentUser._id) {
        console.warn('Attempted to load messages with self or invalid partner ID');
        setMessages([]);
        setMessagesLoading(false);
        return;
    }

    // --- MOCK USER CHECK REMOVED ---
    // Original check was here to prevent loading messages for mock users

    // Validate user ID format
    const isValidId = /^[0-9a-fA-F]{24}$/.test(partnerUserId); // Test for MongoDB ObjectId format
    if (!isValidId) {
      console.error(`Invalid partner user ID format: ${partnerUserId}`);
      toast.error("Cannot load messages: Invalid user ID format");
      setMessages([]);
      setMessagesLoading(false);
      // Consider navigating away or showing a persistent error in the chat window
      setError("Cannot load messages for this user (Invalid ID).");
      return;
    }

    setMessagesLoading(true);
    try {
      const messagesData = await chatService.getMessages(partnerUserId);
      setMessages(messagesData.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
      setError(null); // Clear previous errors if messages load successfully
    } catch (err) {
      console.error("Error fetching messages:", err);
      toast.error(`Failed to load messages: ${err.message || 'Server error'}`);
      setError(`Failed to load messages. ${err.message || ''}`); // Show error in chat window
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSendMessage = async () => {
    const trimmedMessage = messageInput.trim();
    if (!trimmedMessage || !activeConversation || !currentUser?._id) return;

    // Prevent sending messages to yourself
    if (activeConversation.user._id === currentUser._id) {
      toast.error("Cannot send messages to yourself");
      return;
    }

    // Check for invalid ID format (mock user check removed)
    const partnerId = activeConversation.user._id;
    if (!/^[0-9a-fA-F]{24}$/.test(partnerId)) { // Keep ObjectId format check
      toast.error("Cannot send message: Invalid recipient ID format.");
      console.error("Attempted to send message to invalid ID format:", partnerId);
      return;
    }

    // Free account restriction check
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
      toast.error(`Failed to send message: ${err.message || 'Please try again.'}`);
      // Optionally, add the failed message back to the input or show an error indicator
    } finally {
      setIsSending(false);
    }
  };

  // Handle sending a wink
  const handleSendWink = async () => {
    if (!activeConversation || !currentUser?._id || isSending) return;

    // Prevent sending winks to yourself
    if (activeConversation.user._id === currentUser._id) {
      toast.error("Cannot send winks to yourself");
      return;
    }

    // Check for invalid ID format (mock user check removed)
    const partnerId = activeConversation.user._id;
     if (!/^[0-9a-fA-F]{24}$/.test(partnerId)) { // Keep ObjectId format check
      toast.error("Cannot send wink: Invalid recipient ID format.");
      console.error("Attempted to send wink to invalid ID format:", partnerId);
      return;
    }

    setIsSending(true);
    try {
      const winkMessage = {
        content: "😉",
        recipient: partnerId,
        type: "wink"
      };

      const sentMessage = await chatService.sendMessage(partnerId, "😉", "wink");
      setMessages((prev) =>
        prev
          .map((msg) => (msg._id === sentMessage.tempId ? sentMessage : msg))
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      );
      updateConversationList(sentMessage);
    } catch (err) {
      console.error("Error sending wink:", err);
      toast.error(`Failed to send wink: ${err.message || 'Please try again.'}`);
    } finally {
      setIsSending(false);
    }
  };

  // Handle file selection
  const handleFileAttachment = () => {
    if (currentUser?.accountTier === "FREE") {
      return toast.error("Free accounts cannot send files. Upgrade to send files.");
    }

    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle file change
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 5MB.");
      e.target.value = null;
      return;
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg", "image/jpg", "image/png", "image/gif",
      "application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain", "audio/mpeg", "audio/wav", "video/mp4", "video/quicktime",
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

  // Handle removing attachment
  const handleRemoveAttachment = () => {
    setAttachment(null);
    setUploadProgress(0);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle sending attachment
  const handleSendAttachment = async () => {
    if (!attachment || !activeConversation?.user?._id || isUploading) return;

    // Prevent sending files to yourself
    if (activeConversation.user._id === currentUser._id) {
      toast.error("Cannot send files to yourself");
      return;
    }

    // Check for invalid ID format (mock user check removed)
    const partnerId = activeConversation.user._id;
     if (!/^[0-9a-fA-F]{24}$/.test(partnerId)) { // Keep ObjectId format check
      toast.error("Cannot send file: Invalid recipient ID format.");
      console.error("Attempted to send file to invalid ID format:", partnerId);
      return;
    }

    // Free account restriction check
    if (currentUser?.accountTier === "FREE") {
      toast.error("Free accounts cannot send files. Upgrade to send files.");
      return;
    }

    setIsUploading(true);

    try {
      // Create a FormData object to upload the file
      const formData = new FormData();
      formData.append("file", attachment);
      formData.append("recipient", activeConversation.user._id);
      formData.append("messageType", "file");

      // Create a simulated progress update
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const newProgress = prev + Math.floor(Math.random() * 15);
          return newProgress > 95 ? 95 : newProgress;
        });
      }, 300);

      try {
        // In a real implementation, we would use the actual chat service
        // This is a simplified version for demonstration
        const fileMetadata = {
          fileName: attachment.name,
          fileSize: attachment.size,
          fileType: attachment.type,
          fileUrl: URL.createObjectURL(attachment) // In real implementation, this would be the server URL
        };

        // Send the message with file metadata
        const sentMessage = await chatService.sendMessage(
          activeConversation.user._id,
          "File attachment",
          "file",
          fileMetadata
        );

        clearInterval(progressInterval);
        setUploadProgress(100);

        // Update messages list with the sent file
        setMessages((prev) =>
          [...prev, sentMessage].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        );

        updateConversationList(sentMessage);
        toast.success("File sent successfully");
      } catch (uploadError) {
        clearInterval(progressInterval);
        throw uploadError; // Rethrow to be caught by outer catch
      }

      // Clear the attachment
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

  // Handle emoji selection
  const handleEmojiClick = (emoji) => {
    setMessageInput((prev) => prev + emoji);
    setShowEmojis(false);

    if (messageInputRef.current) {
      messageInputRef.current.focus();
    }
  };

  // Handle video call
  const handleVideoCall = async () => {
    if (!activeConversation || !currentUser?._id) return;

    // Check if socket is connected
    if (!socketService.isConnected || !socketService.isConnected()) {
      const errorMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: "Cannot start call: connection issue. Please refresh and try again.",
        createdAt: new Date().toISOString(),
        type: "system",
        error: true
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
        error: true
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
        error: true
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    // Add check for valid partner ID format before initiating call
    const partnerId = activeConversation.user._id;
    if (!/^[0-9a-fA-F]{24}$/.test(partnerId)) {
      const errorMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: "Cannot start call: Invalid recipient ID.",
        createdAt: new Date().toISOString(),
        type: "system",
        error: true
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
        type: "system"
      };
      setMessages((prev) => [...prev, infoMessage]);

      // Set call as active
      setIsCallActive(true);

      // Add a system message
      const systemMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: `You started a video call with ${activeConversation.user.nickname}.`,
        createdAt: new Date().toISOString(),
        type: "system",
      };

      setMessages((prev) => [...prev, systemMessage]);

      // Initiate call via socket service
      socketService.initiateVideoCall(activeConversation.user._id)
        .then(data => {
          console.debug("Call initiation successful:", data);
        })
        .catch(err => {
          console.error("Call initiation error:", err);
          // We don't close the call UI as it's already opened
           const errorMessage = {
              _id: generateUniqueId(),
              sender: "system",
              content: `Call failed to initiate: ${err.message || 'Unknown error'}`,
              createdAt: new Date().toISOString(),
              type: "system",
              error: true
          };
          setMessages((prev) => [...prev, errorMessage]);
          // Maybe reset call state here? Depends on desired UX.
          // setIsCallActive(false);
        });
    } catch (error) {
      console.error("Video call initiation error:", error);

      const errorMessage = {
        _id: generateUniqueId(),
        sender: "system",
        content: error.message || "Could not start video call. Please try again.",
        createdAt: new Date().toISOString(),
        type: "system",
        error: true
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsCallActive(false); // Reset call state on synchronous error
    }
  };

  // Handle ending call
  const handleEndCall = () => {
    // Send hangup signal if we have an active call
    if (isCallActive && activeConversation) {
      // Check partner ID format before emitting hangup
      const partnerId = activeConversation.user._id;
       if (/^[0-9a-fA-F]{24}$/.test(partnerId)) {
            socketService.emit("videoHangup", {
                recipientId: partnerId
            });
       } else {
           console.warn("Cannot emit hangup for invalid partner ID:", partnerId);
       }
    }

    // Reset call states
    setIsCallActive(false);
    setIncomingCall(null);

    // Add a system message
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

  // Update conversation list when a new message is received or sent
  const updateConversationList = (newMessage) => {
    if (!currentUser?._id) return;

    // Don't update the conversation list if the message is to/from yourself
    const partnerId = newMessage.sender === currentUser._id ? newMessage.recipient : newMessage.sender;
    if (partnerId === currentUser._id) return;

    // Added check: Don't update list if partnerId format is invalid (relevant if received msg has bad ID somehow)
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
          updatedConvo.unreadCount = 0; // Reset unread count if it's the active chat
        // Ensure the updated conversation moves to the top
        return [updatedConvo, ...prev.filter((c) => c.user._id !== partnerId)];
      } else {
        // Need to fetch user details if it's a truly new conversation partner
        // For simplicity here, we use basic info from the message, but ideally fetch full details
        const newConvo = {
          user: {
            _id: partnerId,
            nickname: newMessage.senderName || `User ${partnerId.substring(0, 6)}`,
            photo: newMessage.senderPhoto || null,
            // isOnline status would ideally come from presence system or user details fetch
            isOnline: false, // Default to offline until confirmed otherwise
            accountTier: "FREE" // Default or fetch
          },
          lastMessage: newMessage,
          unreadCount: newMessage.sender !== currentUser._id ? 1 : 0,
        };
         // Add the new conversation to the top
        return [newConvo, ...prev];
      }
    });
  };

  const markConversationAsRead = (partnerUserId) => {
    // Skip for self-conversations
    if (partnerUserId === currentUser?._id) return;

    // Check for invalid ID format (mock user check removed)
    if (!/^[0-9a-fA-F]{24}$/.test(partnerUserId)) { // Keep ObjectId format check
      console.warn("Attempted to mark conversation read for invalid ID format:", partnerUserId);
      return;
    }

    const convoIndex = conversations.findIndex((c) => c.user._id === partnerUserId);
    if (convoIndex !== -1 && conversations[convoIndex].unreadCount > 0) {
      chatService.markConversationRead(partnerUserId); // Assuming this handles errors internally
      setConversations((prev) =>
        prev.map((c, index) => (index === convoIndex ? { ...c, unreadCount: 0 } : c))
      );
    }
  };

  // Debounced sending of typing indicator
  const sendTypingIndicator = useCallback(() => {
    if (activeConversation && chatService.isConnected && chatService.isConnected() && currentUser?._id) {
        // Add ID format check before sending typing indicator
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
      // Send typing indicator only if partner ID is valid
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
      // Reset height after sending
      if(e.target) e.target.style.height = "auto";
    }
  };

  const selectConversation = (conversation) => {
    if (!conversation?.user?._id || (activeConversation && activeConversation.user._id === conversation.user._id))
      return;

    // Don't allow selecting your own conversation
    if (conversation.user._id === currentUser?._id) {
      toast.warning("You cannot message yourself");
      return;
    }

    // Add check for valid ID format before selecting
    if (!/^[0-9a-fA-F]{24}$/.test(conversation.user._id)) {
        toast.error("Cannot select conversation: Invalid user ID.");
        console.error("Attempted to select conversation with invalid ID:", conversation.user._id);
        return;
    }


    setActiveConversation(conversation);
    setError(null); // Clear errors when selecting a valid conversation
    markConversationAsRead(conversation.user._id);
    // Don't navigate here, let the useEffect handle navigation based on URL param
  };

  // Toggle sidebar for mobile view
  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  // Group messages by date for rendering
  const groupedMessages = groupMessagesByDate(messages);

  // Get file icon based on type
  const getFileIcon = (fileType) => {
    if (!fileType) return <FaFile />;

    if (fileType.startsWith("image/")) return <FaImage />;
    if (fileType.startsWith("video/")) return <FaFileVideo />;
    if (fileType.startsWith("audio/")) return <FaFileAudio />;
    if (fileType === "application/pdf") return <FaFilePdf />;

    return <FaFileAlt />;
  };

  // Render loading, error, or main chat UI
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

  // Render component-level error (e.g., init failed, login required)
   if (!isAuthenticated && !authLoading) { // Show login prompt if not authenticated and not loading
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

   // Use the 'error' state for general errors after initial load/auth
   if (error && !activeConversation) { // Show general error if no conversation selected
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

  // Main UI Render
  return (
    <div className={styles.appWrapper}>
      <Navbar />
      <div className={styles.messagesContainer}>
        {/* Sidebar: Conversations List */}
        <div className={`${styles.sidebar} ${showSidebar ? styles.show : styles.hide}`}>
          <div className={styles.sidebarHeader}>
            <h2>Messages</h2>
            {mobileView && activeConversation && (
              <button className={styles.backButton} onClick={toggleSidebar}>
                &times;
              </button>
            )}
          </div>

          {conversations.length === 0 && !componentLoading ? ( // Added !componentLoading check
            <div className={styles.noConversations}>
              <FaEnvelope size={32} />
              <p>No conversations yet.</p>
            </div>
          ) : (
            <div className={styles.conversationsList}>
              {conversations.map((convo) => {
                  // Added safety check for valid convo structure
                   if (!convo || !convo.user || !convo.user._id) {
                      console.warn("Skipping rendering invalid conversation item:", convo);
                      return null;
                   }
                   return (
                     <div
                       key={convo.user._id}
                       className={`${styles.conversationItem}
                         ${activeConversation?.user._id === convo.user._id ? styles.active : ''}
                         ${convo.unreadCount > 0 ? styles.unread : ''}`}
                       onClick={() => selectConversation(convo)} // selectConversation now has ID check
                       role="button"
                       tabIndex={0}
                     >
                       <div className={styles.avatarContainer}>
                         <Avatar
                           src={convo.user.photo}
                           alt={convo.user.nickname}
                           size="medium"
                         />
                         {convo.user.isOnline && <span className={`${styles.statusIndicator} ${styles.online}`}></span>}
                       </div>

                       <div className={styles.conversationInfo}>
                         <div className={styles.conversationName}>
                           <span>{convo.user.nickname || 'Unknown User'}</span>
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

        {/* Main Chat Area */}
        <div className={`${styles.chatArea} ${!showSidebar && mobileView ? styles.fullWidth : ''}`}>
          {activeConversation ? (
            <>
              <div className={styles.chatHeader}>
                 {/* Added safety check for activeConversation structure */}
                 {activeConversation.user && activeConversation.user._id ? (
                     <div className={styles.chatUser}>
                         {mobileView && (
                             <button className={styles.backButton} onClick={toggleSidebar}>
                                 &larr;
                             </button>
                         )}
                         <div className={styles.avatarContainer}>
                             <Avatar
                                 src={activeConversation.user.photo}
                                 alt={activeConversation.user.nickname}
                                 size="medium"
                             />
                             {activeConversation.user.isOnline && (
                                 <span className={`${styles.statusIndicator} ${styles.online}`}></span>
                             )}
                         </div>
                         <div className={styles.chatUserDetails}>
                             <h3>{activeConversation.user.nickname || 'Unknown User'}</h3>
                             <span className={activeConversation.user.isOnline ? `${styles.statusText} ${styles.online}` : `${styles.statusText} ${styles.offline}`}>
                                 {activeConversation.user.isOnline ? "Online" : "Offline"}
                             </span>
                         </div>
                         <div className={styles.chatActions}>
                             {currentUser?.accountTier !== "FREE" && (
                                 <>
                                     {isCallActive ? (
                                         <button
                                             className={styles.actionButton}
                                             onClick={handleEndCall}
                                             title="End call"
                                         >
                                             <FaPhoneSlash />
                                         </button>
                                     ) : (
                                         <button
                                             className={styles.actionButton}
                                             onClick={handleVideoCall} // Video call function now checks ID format
                                             title={activeConversation.user.isOnline ? "Start Video Call" : `${activeConversation.user.nickname} is offline`}
                                             disabled={!activeConversation.user.isOnline || !/^[0-9a-fA-F]{24}$/.test(activeConversation.user._id)} // Disable if offline or invalid ID
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
                     <div className={styles.chatUser}>Loading user...</div> // Placeholder if somehow activeConversation is bad
                 )}
              </div>

              {/* Premium upgrade banner */}
              {currentUser?.accountTier === "FREE" && (
                <div className={styles.premiumBanner}>
                  <div>
                    <FaCrown className={styles.premiumIcon} />
                    <span>Upgrade to send messages and make calls</span>
                  </div>
                  <button
                    className={styles.upgradeBtn}
                    onClick={() => navigate("/subscription")}
                  >
                    Upgrade
                  </button>
                </div>
              )}

              {/* Active call banner */}
              {isCallActive && (
                <div className={styles.activeCallBanner}>
                  <div>
                    <FaVideo className={styles.callIcon} />
                    <span>Call with {activeConversation.user.nickname}</span>
                  </div>
                  <button
                    className={styles.endCallBtn}
                    onClick={handleEndCall}
                  >
                    <FaPhoneSlash /> End
                  </button>
                </div>
              )}

              {/* Incoming call banner */}
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
                        // Decline the call
                        // Check caller ID format before answering
                         if (incomingCall.callerId && /^[0-9a-fA-F]{24}$/.test(incomingCall.callerId)) {
                             socketService.answerVideoCall(
                                 incomingCall.callerId,
                                 false,
                                 incomingCall.callId
                             );
                             // Add a system message
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
                        // Accept the call
                        // Check caller ID format before answering
                         if (incomingCall.callerId && /^[0-9a-fA-F]{24}$/.test(incomingCall.callerId)) {
                             socketService.answerVideoCall(
                                 incomingCall.callerId,
                                 true,
                                 incomingCall.callId
                             );
                             // Add a system message
                             const systemMessage = {
                                 _id: generateUniqueId(),
                                 sender: "system",
                                 content: `You accepted a video call from ${activeConversation.user.nickname}.`,
                                 createdAt: new Date().toISOString(),
                                 type: "system",
                             };
                             setMessages((prev) => [...prev, systemMessage]);
                             // Activate the call
                             setIsCallActive(true);
                             setIncomingCall(null); // Clear incoming call state
                         } else {
                             console.error("Cannot accept call: Invalid caller ID format", incomingCall.callerId);
                             toast.error("Error accepting call (Invalid ID).");
                             setIncomingCall(null); // Still clear incoming call state on error
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
                ) : error ? ( // Display error within the message area if one exists for the active chat
                    <div className={styles.noMessages}>
                        <div className={`${styles.noMessagesContent} ${styles.errorContent}`}>
                            <p>Error:</p>
                            <p>{error}</p>
                            <button onClick={() => loadMessages(activeConversation.user._id)} className={styles.btnSecondary}>Retry Loading Messages</button>
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
                        // Safety check for message structure
                        if (!msg || (!msg._id && !msg.tempId)) {
                            console.warn("Skipping rendering invalid message:", msg);
                            return null;
                        }

                        const isFromMe = msg.sender === currentUser._id;
                        let statusIndicator = null;

                        if (isFromMe) {
                          // Assuming read status comes from backend
                          statusIndicator = msg.read ? <FaCheckDouble size={12} /> : <FaCheck size={12} />;
                          // Could add a pending indicator for !msg._id && msg.tempId
                          if (!msg._id && msg.tempId) {
                              // statusIndicator = <FaSpinner size={10} className="fa-spin" />; // Example pending
                          }
                        }

                        return (
                          <div
                            key={msg._id || msg.tempId}
                            className={`${styles.messageBubble}
                              ${isFromMe ? styles.sent : styles.received}
                              ${msg.type === "system" ? styles.systemMessage : ""}
                              ${msg.error ? styles.error : ''} // Keep error styling for system messages
                              ${msg.type === "wink" ? styles.winkMessage : ""}`}
                          >
                            {msg.type === "system" ? (
                              <div className={`${styles.systemMessageContent} ${msg.error ? styles.errorContent : ''}`}>
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
                            ) : msg.type === "file" && msg.metadata ? ( // Added check for metadata
                              <div className={styles.fileMessage}>
                                {msg.metadata.fileType?.startsWith("image/") ? (
                                  <img
                                    src={msg.metadata.fileUrl || "/placeholder.svg"} // Use placeholder if URL missing
                                    alt={msg.metadata.fileName || "Image"}
                                    className={styles.imageAttachment}
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src = "/placeholder.svg";
                                    }}
                                  />
                                ) : (
                                  <div className={styles.fileAttachment}>
                                    {getFileIcon(msg.metadata.fileType)}
                                    <span className={styles.fileName}>{msg.metadata.fileName || "File"}</span>
                                    <span className={styles.fileSize}>
                                      {msg.metadata.fileSize ? `(${Math.round(msg.metadata.fileSize / 1024)} KB)` : ""}
                                    </span>
                                    {/* Make download conditional on having a URL */}
                                    {msg.metadata.fileUrl && (
                                         <a
                                             href={msg.metadata.fileUrl}
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
                            ) : ( // Default to text message
                              <>
                                <div className={styles.messageContent}>{msg.content || ''}</div>
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
                    {/* Could add user nickname: {activeConversation?.user?.nickname} is typing... */}
                    <div className={styles.dot}></div>
                    <div className={styles.dot}></div>
                    <div className={styles.dot}></div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* File attachment preview */}
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

              {/* Emoji picker */}
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
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleEmojiClick(emoji)}
                      >
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
                  // Disable input if sending, uploading, or if account tier is FREE (unless it's exactly the wink emoji)
                  disabled={isSending || isUploading || (currentUser?.accountTier === "FREE" && messageInput !== '😉')}
                  title={currentUser?.accountTier === "FREE" ? "Upgrade to send text messages" : "Type a message"}
                />

                <button
                  type="button"
                  className={styles.attachButton}
                  onClick={handleFileAttachment}
                  // Disable attachment if sending, uploading, or FREE tier
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
                  onClick={handleSendWink} // Wink function now checks ID format
                  disabled={isSending || isUploading}
                  title="Send Wink"
                >
                  <FaHeart />
                </button>

                <button
                  onClick={attachment ? handleSendAttachment : handleSendMessage} // Send functions now check ID format
                  className={`${styles.sendButton} ${!messageInput.trim() && !attachment ? styles.disabled : ''}`}
                  // Disable send if nothing to send, or already sending/uploading
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
                {/* Optionally show general error here too if needed */}
                {error && <p className={styles.errorMessage}>{error}</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video Call Overlay */}
      {isCallActive && activeConversation && activeConversation.user && activeConversation.user._id && /^[0-9a-fA-F]{24}$/.test(activeConversation.user._id) && ( // Add checks before rendering video call
        <div className={styles.videoCallOverlay}>
          <VideoCall
            isActive={isCallActive}
            userId={currentUser?._id}
            recipientId={activeConversation.user._id}
            onEndCall={handleEndCall}
            isIncoming={incomingCall !== null && incomingCall.callerId === activeConversation.user._id} // Ensure incoming call matches active chat
            callId={incomingCall?.callId}
          />
        </div>
      )}
    </div>
  );
};

export default Messages;
