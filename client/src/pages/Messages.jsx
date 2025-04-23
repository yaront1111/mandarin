"use client";

import React, { useState, useEffect, useRef, useContext, useCallback, useMemo } from "react";
//                                                                    ^^^^^^^^ Add useMemo here
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import chatService from "../services/ChatService";
import { formatMessagePreview, groupMessagesByDate, formatDate, classNames } from "../utils";
import LoadingSpinner from "../components/common/LoadingSpinner";
import Avatar from "../components/common/Avatar";
import MessagesWrapper from '../components/MessagesWrapper';
import AuthContext from "../context/AuthContext";
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
  FaArrowLeft,
  FaPlus
} from "react-icons/fa";
import VideoCall from "../components/VideoCall";
import socketService from "../services/socketService";
import styles from "../styles/Messages.module.css";

// Add gesture support for mobile
const SWIPE_THRESHOLD = 50; // Minimum distance to trigger swipe action

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
  const [mobileView, setMobileView] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false); // Check for window
  const [showSidebar, setShowSidebar] = useState(true);
  const [showEmojis, setShowEmojis] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSending, setIsSending] = useState(false);

  // Mobile-specific state
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState(null);

  // Refs
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const chatInitializedRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const conversationsListRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const loadedConversationRef = useRef(null);
  const refreshIndicatorRef = useRef(null);

  // Common emojis for the emoji picker
  const commonEmojis = ["😊", "😂", "😍", "❤️", "👍", "🙌", "🔥", "✨", "🎉", "🤔", "😉", "🥰"];

  // Handle PWA installation
  useEffect(() => {
    // Ensure this runs only on the client
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      window.deferredPrompt = e;
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallBanner(false);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      }
    };
  }, []);

  // Handle app installation
  const handleInstallClick = async () => {
    if (typeof window === 'undefined' || !window.deferredPrompt) return;

    const promptEvent = window.deferredPrompt;
    promptEvent.prompt();

    const { outcome } = await promptEvent.userChoice;
    console.log(`User ${outcome === 'accepted' ? 'accepted' : 'declined'} the install prompt`);

    window.deferredPrompt = null;
    setShowInstallBanner(false);
  };

  // Responsive sidebar handling with improved mobile detection
  useEffect(() => {
    // Ensure this runs only on the client
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      setMobileView(isMobile);

      if (!isMobile) {
        setShowSidebar(true);
      } else if (activeConversation) {
        setShowSidebar(false);
      }

      setPullDistance(0);
      setSwipeDirection(null);
    };

    handleResize(); // Initial check

    window.addEventListener("resize", handleResize);
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener("resize", handleResize);
      }
    };
  }, [activeConversation]);

  // Initialize chat service and fetch conversations
  useEffect(() => {
    if (authLoading || !isAuthenticated || !currentUser?.id || chatInitializedRef.current) {
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
    // Disabling eslint exhaustive-deps because fetchConversations is called within initChat
    // and including it would cause an infinite loop or unnecessary re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isAuthenticated, authLoading]);

  // Socket and notification event listeners
  useEffect(() => {
    if (!chatInitializedRef.current || !currentUser?.id || typeof window === 'undefined') return;

    const handleMessageReceived = (newMessage) => {
      console.log("Message received:", newMessage);

      if (newMessage.type === 'file' && window.__lastUploadedFile) {
        const lastFile = window.__lastUploadedFile;
        const msgUrl = newMessage.metadata?.url || newMessage.metadata?.fileUrl;
        if (msgUrl && msgUrl === lastFile.url) {
          console.log("Identified message for the file we just uploaded", lastFile.id);
          window.__lastUploadedFile = null;
        }
      }

      if (newMessage.sender !== currentUser.id) {
        const audio = new Audio('/notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(err => console.log("Couldn't play notification sound:", err));
      }

      const partnerId = newMessage.sender === currentUser.id ? newMessage.recipient : newMessage.sender;

      if (activeConversation && activeConversation.user.id === partnerId) {
        setMessages((prev) => {
          let isDuplicate = prev.some(msg =>
            msg.id === newMessage.id ||
            (newMessage.tempId && msg.tempId === newMessage.tempId)
          );

          if (!isDuplicate && newMessage.type === 'file' && newMessage.metadata?.url) {
            isDuplicate = prev.some(msg =>
              msg.type === 'file' &&
              msg.metadata?.url === newMessage.metadata.url &&
              msg.sender === newMessage.sender &&
              Math.abs(new Date(msg.createdAt) - new Date(newMessage.createdAt)) < 10000
            );

            if (isDuplicate) {
              const placeholderIndex = prev.findIndex(msg =>
                msg.type === 'file' &&
                msg.metadata?.url === newMessage.metadata.url &&
                msg.metadata?.__localPlaceholder === true
              );

              if (placeholderIndex >= 0) {
                console.log("Replacing placeholder with real message:", newMessage.id);
                const updatedMessages = [...prev];
                updatedMessages[placeholderIndex] = {
                  ...newMessage,
                  metadata: {
                    ...newMessage.metadata,
                    fileUrl: newMessage.metadata.url || newMessage.metadata.fileUrl,
                    url: newMessage.metadata.url || newMessage.metadata.fileUrl
                  }
                };
                return updatedMessages;
              }
            }
          }

          if (isDuplicate) {
            console.log("Skipping duplicate message:", newMessage.id);
            return prev;
          }

          if (mobileView && "vibrate" in navigator) {
            navigator.vibrate(50);
          }

          return [...prev, newMessage].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });

        chatService.markConversationRead(activeConversation.user.id);
      } else {
        if (mobileView && "Notification" in window && Notification.permission === "granted") {
          new Notification("New message", {
            body: `New message from ${newMessage.senderName || "a user"}`,
            icon: "/icon-192x192.png"
          });
        } else if ("Notification" in window && Notification.permission !== "denied") {
          // Only show toast if notifications aren't denied
          toast.info(`New message from ${newMessage.senderName || "a user"}`);
        }
      }

      updateConversationList(newMessage);
    };

    const handleUserTyping = (data) => {
      if (activeConversation && data.userId === activeConversation.user.id) {
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

    const handleIncomingCall = (call) => {
      if (!activeConversation || call.userId !== activeConversation.user.id) return;

      console.debug(`Received incoming call from ${call.userId}`);
      setIncomingCall({
        callId: call.callId,
        callerName: activeConversation.user.nickname,
        callerId: call.userId,
        timestamp: call.timestamp,
      });

      if (mobileView && "vibrate" in navigator) {
        navigator.vibrate([300, 100, 300]);
      }

      const systemMessage = {
        id: generateUniqueId(),
        sender: "system",
        content: `${activeConversation.user.nickname} is calling you.`,
        createdAt: new Date().toISOString(),
        type: "system",
      };
      setMessages((prev) => [...prev, systemMessage]);
    };

    const handleCallAccepted = (data) => {
      if (!activeConversation || data.userId !== activeConversation.user.id) return;
      console.debug(`Call accepted by ${activeConversation.user.nickname}`);
      const systemMessage = {
        id: generateUniqueId(),
        sender: "system",
        content: `${activeConversation.user.nickname} accepted your call.`,
        createdAt: new Date().toISOString(),
        type: "system",
      };
      setMessages((prev) => [...prev, systemMessage]);
      toast.success(`${activeConversation.user.nickname} accepted your call`);
    };

    const handleCallDeclined = (data) => {
      if (!activeConversation || data.userId !== activeConversation.user.id) return;
      console.debug(`Call declined by ${activeConversation.user.nickname}`);
      const systemMessage = {
        id: generateUniqueId(),
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
      if (!activeConversation || data.userId !== activeConversation.user.id) return;
      console.debug(`Call hung up by ${activeConversation.user.nickname}`);
      if (isCallActive) handleEndCall(); // Call local end call logic
    };

    const unsubscribeMessage = chatService.on("messageReceived", handleMessageReceived);
    const unsubscribeTyping = chatService.on("userTyping", handleUserTyping);
    const unsubscribeConnection = chatService.on("connectionChanged", handleConnectionChanged);
    const unsubscribeIncomingCall = socketService.on("incomingCall", handleIncomingCall);
    const unsubscribeCallAccepted = socketService.on("callAccepted", handleCallAccepted);
    const unsubscribeCallDeclined = socketService.on("callDeclined", handleCallDeclined);
    const unsubscribeVideoHangup = socketService.on("videoHangup", handleCallHangup);

    if (mobileView && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

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
    // Disabling eslint exhaustive-deps for handleEndCall as it's a stable function defined outside
    // but used within the effect cleanup logic implicitly via handleCallHangup.
    // Including it might cause complexity if its definition changes frequently.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation, currentUser?.id, isCallActive, mobileView]); // Added updateConversationList


  // Load conversation based on URL parameter
  useEffect(() => {
    if (chatInitializedRef.current && targetUserIdParam && conversations.length > 0) {
      const conversation = conversations.find((c) => c.user.id === targetUserIdParam);
      if (conversation && (!activeConversation || activeConversation.user.id !== conversation.user.id)) {
        selectConversation(conversation);
      } else if (!conversation && targetUserIdParam !== currentUser?.id) {
        loadUserDetails(targetUserIdParam);
      }
    }
  // Disabling exhaustive-deps for selectConversation & loadUserDetails as they are stable functions
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserIdParam, conversations, currentUser?.id, activeConversation, navigate]);

  // Load messages for the active conversation
  useEffect(() => {
    if (!activeConversation?.user?.id || !currentUser?.id) {
      setMessages([]);
      return;
    }

    if (loadedConversationRef.current === activeConversation.user.id) return;
    loadedConversationRef.current = activeConversation.user.id;

    setMessagesLoading(true);
    (async () => {
      try {
        await loadMessages(activeConversation.user.id);
        if (targetUserIdParam !== activeConversation.user.id) {
          // Use replace to avoid adding intermediate states to history
          navigate(`/messages/${activeConversation.user.id}`, { replace: true });
        }
        markConversationAsRead(activeConversation.user.id);
        messageInputRef.current?.focus();
        if (mobileView) setShowSidebar(false);
      } catch (err) {
        console.error("Error in loading messages:", err);
        // Potentially set an error state here
      } finally {
        setMessagesLoading(false);
      }
    })();
  // Disabling exhaustive-deps for loadMessages & markConversationAsRead as they are stable functions
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation, currentUser?.id, targetUserIdParam, mobileView, navigate]);


  // Auto-scroll to bottom when messages update
  useEffect(() => {
    // Added a small delay to allow layout reflow, especially for images
    const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  // --- Touch Gesture Handlers ---

  const handleTouchStart = (e) => {
    if (!conversationsListRef.current) return;

    const touchY = e.touches[0].clientY;
    const touchX = e.touches[0].clientX;
    setTouchStartY(touchY);
    setTouchStartX(touchX);

    if (conversationsListRef.current.scrollTop <= 0) {
      setIsRefreshing(true); // Tentatively set refreshing true
    } else {
      setIsRefreshing(false); // Ensure it's false if not at top
    }
  };

  const handleTouchMove = (e) => {
    if (!messagesContainerRef.current) return; // Ensure container ref is valid

    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const diffY = currentY - touchStartY;
    const diffX = currentX - touchStartX;

    // Handle pull-to-refresh only if started at the top and pulling down
    if (isRefreshing && diffY > 0 && conversationsListRef.current?.scrollTop <= 0) {
      const newPullDistance = Math.min(diffY * 0.5, 80);
      setPullDistance(newPullDistance);

      if (refreshIndicatorRef.current) {
        refreshIndicatorRef.current.style.transform = `translateY(${newPullDistance}px)`;
        refreshIndicatorRef.current.style.opacity = `${Math.min(newPullDistance / 50, 1)}`; // Fade in
      }
      // Prevent vertical scroll while pulling
       e.preventDefault();
    } else if (isRefreshing && diffY <= 0) {
        // If user starts pulling down then up, reset refresh state
        setIsRefreshing(false);
        setPullDistance(0);
        if (refreshIndicatorRef.current) {
          refreshIndicatorRef.current.style.transform = 'translateY(0)';
          refreshIndicatorRef.current.style.opacity = '0';
        }
    }

    // Handle horizontal swipe only if horizontal movement is dominant
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10 && !isRefreshing) {
      if (diffX > SWIPE_THRESHOLD && !showSidebar) {
        // Swiping right (showing sidebar)
        setSwipeDirection('right');
      } else if (diffX < -SWIPE_THRESHOLD && showSidebar) {
        // Swiping left (hiding sidebar)
        setSwipeDirection('left');
      }
      // Optional: Add visual feedback during swipe here if needed
       // e.preventDefault(); // Prevent horizontal scroll interference
    }
  };

  const handleTouchEnd = async (e) => {
    // Handle pull-to-refresh completion
    if (isRefreshing && pullDistance > 50) {
      if (refreshIndicatorRef.current) {
        refreshIndicatorRef.current.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
        refreshIndicatorRef.current.style.transform = 'translateY(40px)'; // Hold position while refreshing
        refreshIndicatorRef.current.style.opacity = '1';
      }

      try {
        await fetchConversations();
        if (refreshIndicatorRef.current) {
          refreshIndicatorRef.current.classList.add(styles.refreshSuccess);
        }
      } catch (err) {
        console.error("Error refreshing conversations:", err);
        if (refreshIndicatorRef.current) {
          refreshIndicatorRef.current.classList.add(styles.refreshError);
        }
      } finally {
        // Reset visual state after a delay
        setTimeout(() => {
          if (refreshIndicatorRef.current) {
            refreshIndicatorRef.current.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
            refreshIndicatorRef.current.style.transform = 'translateY(0)';
            refreshIndicatorRef.current.style.opacity = '0';
            refreshIndicatorRef.current.classList.remove(styles.refreshSuccess, styles.refreshError);
          }
          setIsRefreshing(false);
          setPullDistance(0);
        }, 600);
      }
    } else if (isRefreshing) {
      // Reset without refreshing if pull not far enough or cancelled
      if (refreshIndicatorRef.current) {
        refreshIndicatorRef.current.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
        refreshIndicatorRef.current.style.transform = 'translateY(0)';
        refreshIndicatorRef.current.style.opacity = '0';
      }
      setIsRefreshing(false);
      setPullDistance(0);
    }

    // Handle swipe gesture completion
    if (swipeDirection === 'right') {
      setShowSidebar(true);
    } else if (swipeDirection === 'left') {
      setShowSidebar(false);
    }
    // Reset swipe direction regardless
    setSwipeDirection(null);
  };


  // --- Helper Functions ---

  const fetchConversations = useCallback(async () => {
    if (!currentUser?.id) return;
    // Consider adding a loading state specific to conversation fetching if needed
    try {
      const conversationsData = await chatService.getConversations();
      const filteredConversations = conversationsData.filter(
        (conversation) => conversation?.user?.id && conversation.user.id !== currentUser.id // Add null check for user
      );
      setConversations(filteredConversations);
      if (
        targetUserIdParam &&
        !filteredConversations.find((c) => c.user.id === targetUserIdParam) &&
        targetUserIdParam !== currentUser.id
      ) {
        // If the target user isn't in the fetched list, try loading their details
        loadUserDetails(targetUserIdParam);
      }
    } catch (err) {
      console.error("Error fetching conversations:", err);
      // Set error state only if it's a persistent issue?
      // setError("Failed to load conversations");
      toast.error("Failed to load conversations");
    }
  // Disabling exhaustive-deps for loadUserDetails as it's a stable function
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, targetUserIdParam]);

  const loadUserDetails = useCallback(async (idToLoad) => {
    if (!idToLoad || idToLoad === currentUser?.id) {
      console.warn("Attempted to load own user details or null ID");
      if (idToLoad === currentUser?.id) navigate("/messages", { replace: true }); // Redirect if trying to load self
      return;
    }
    try {
      setMessagesLoading(true); // Show loading indicator for messages area
      const isValidId = /^[0-9a-fA-F]{24}$/.test(idToLoad);
      if (!isValidId) {
        console.error("Invalid user ID format:", idToLoad);
        toast.error("Invalid User ID provided.");
        navigate("/messages", { replace: true });
        // Don't throw error here, just return after navigation
        return;
      }
       const token =
         chatService.getAuthToken?.() ||
         (typeof window !== 'undefined' ? localStorage.getItem("token") : null) ||
         (typeof window !== 'undefined' ? sessionStorage.getItem("token") : null) ||
         (typeof window !== 'undefined' ? localStorage.getItem("authToken") : null) ||
         (typeof window !== 'undefined' ? sessionStorage.getItem("authToken") : null);

       if (!token) {
         console.warn("No authentication token found for loading user details");
         // Handle appropriately - maybe redirect to login or show error
         // For now, just warning
       }

      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // Make sure API path is correct (e.g., relative or absolute)
      const response = await fetch(`/api/users/${idToLoad}`, { headers });

      if (!response.ok) {
        console.warn(`API error ${response.status} fetching user ${idToLoad}.`);
        let errorMsg = `Could not find or load user details (Error: ${response.status}).`;
        if (response.status === 404) errorMsg = `User not found (${idToLoad}).`;
        toast.error(errorMsg);
        navigate("/messages", { replace: true });
        setError(errorMsg); // Set error state
        return; // Stop execution
      }

      const result = await response.json();
      const userDetail = result.data?.user || result.user || result;

      if (userDetail?.id) {
        const newConvo = {
          user: {
            id: userDetail.id,
            nickname: userDetail.nickname || userDetail.name || "Unknown User",
            // Ensure photos exists and has elements before accessing
            photo: userDetail.photos?.[0]?.url || userDetail.photo || null,
            isOnline: userDetail.isOnline || false,
            accountTier: userDetail.accountTier || "FREE",
          },
          lastMessage: null,
          unreadCount: 0,
        };
        // Add or update conversation in the list
        setConversations((prev) => {
           const existingIndex = prev.findIndex((c) => c.user.id === idToLoad);
           if (existingIndex > -1) {
             // Update existing conversation if needed (e.g., online status)
             const updatedConvos = [...prev];
             updatedConvos[existingIndex] = { ...updatedConvos[existingIndex], user: newConvo.user };
             return updatedConvos;
           } else {
             // Add as a new conversation
             return [newConvo, ...prev];
           }
        });
        setActiveConversation(newConvo);
        setMessages([]); // Clear messages for the new user
        setError(null); // Clear previous errors
      } else {
        throw new Error("User data not found in API response");
      }
    } catch (err) {
      console.error(`Error loading user details for ${idToLoad}:`, err);
      let errorMessage = "Could not load user details.";
      if (err.message.includes("API request failed")) {
        errorMessage = `Could not retrieve user information. ${err.message}`;
      } else if (err.message === "User data not found in API response") {
           errorMessage = `User details format error for ${idToLoad}.`;
      }
      setError(errorMessage); // Set specific error message
      toast.error(errorMessage);
      // Only navigate away if it's not an ID format issue already handled
      if (!/^[0-9a-fA-F]{24}$/.test(idToLoad)) {
           // Already navigated
      } else {
         // Consider navigating away on other errors too
         // navigate("/messages", { replace: true });
      }
    } finally {
      setMessagesLoading(false);
    }
  }, [currentUser?.id, navigate]);


 const loadMessages = useCallback(async (partnerUserId) => {
   if (!currentUser?.id || !partnerUserId || partnerUserId === currentUser.id) {
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
     // Ensure messages are sorted correctly upon fetch
     setMessages(
       messagesData.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
     );
     setError(null); // Clear error on successful load
   } catch (err) {
     console.error("Error fetching messages:", err);
     const errorMsg = `Failed to load messages. ${err.message || "Server error"}`;
     toast.error(errorMsg);
     setError(errorMsg); // Set error state
     setMessages([]); // Clear messages on error
   } finally {
     setMessagesLoading(false);
   }
 }, [currentUser?.id]);


  const handleSendMessage = async () => {
    const trimmedMessage = messageInput.trim();
    if (!trimmedMessage || !activeConversation || !currentUser?.id) return;
    if (activeConversation.user.id === currentUser.id) {
      toast.error("Cannot send messages to yourself");
      return;
    }
    const partnerId = activeConversation.user.id;
    if (!/^[0-9a-fA-F]{24}$/.test(partnerId)) {
      toast.error("Cannot send message: Invalid recipient ID format.");
      console.error("Attempted to send message to invalid ID format:", partnerId);
      return;
    }
    if (currentUser?.accountTier === "FREE" && trimmedMessage !== "😉") {
      toast.error("Free accounts can only send winks. Upgrade to send messages.");
      return;
    }

    // Optimistic UI update (optional but improves perceived performance)
     const tempId = `temp-${Date.now()}`;
     const optimisticMessage = {
       id: tempId, // Temporary ID
       tempId: tempId,
       sender: currentUser.id,
       recipient: partnerId,
       content: trimmedMessage,
       createdAt: new Date().toISOString(),
       type: 'text',
       read: false,
       // Add senderName/Photo if available for consistency, though not strictly needed for own message
       senderName: currentUser.nickname,
       senderPhoto: currentUser.photos?.[0]?.url || currentUser.photo,
     };
     setMessages((prev) => [...prev, optimisticMessage].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
     updateConversationList(optimisticMessage); // Update sidebar optimistically


    setMessageInput(""); // Clear input after preparing message
    setIsSending(true);
    // Reset textarea height
    if(messageInputRef.current) messageInputRef.current.style.height = 'auto';


    if (mobileView && "vibrate" in navigator) {
      navigator.vibrate(20);
    }

    try {
      const sentMessage = await chatService.sendMessage(partnerId, trimmedMessage);
      // Replace optimistic message with actual server response
       setMessages((prev) =>
         prev
           .map((msg) => (msg.tempId === tempId ? { ...sentMessage, id: sentMessage.id || tempId } : msg)) // Use tempId if id missing in response?
           .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
       );
       // Update conversation list again with actual message data (e.g., accurate timestamp)
       updateConversationList(sentMessage);

    } catch (err) {
      console.error("Error sending message:", err);
      toast.error(`Failed to send message: ${err.message || "Please try again."}`);
       // Revert optimistic update on failure
       setMessages((prev) => prev.filter(msg => msg.tempId !== tempId));
       // Optionally, add the failed message back with an error indicator
       setMessages((prev) => [...prev, {...optimisticMessage, error: true, content: `${trimmedMessage} (Failed)` }]
                         .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
       // Reset conversation list if needed, or mark last message as failed
       updateConversationList({...optimisticMessage, error: true });
    } finally {
      setIsSending(false);
    }
  };

 const handleSendWink = async () => {
   if (!activeConversation || !currentUser?.id || isSending) return;
   if (activeConversation.user.id === currentUser.id) {
     toast.error("Cannot send winks to yourself");
     return;
   }
   const partnerId = activeConversation.user.id;
   if (!/^[0-9a-fA-F]{24}$/.test(partnerId)) {
     toast.error("Cannot send wink: Invalid recipient ID format.");
     console.error("Attempted to send wink to invalid ID format:", partnerId);
     return;
   }
   setIsSending(true);

   // Optimistic UI update for wink
   const tempId = `temp-wink-${Date.now()}`;
   const optimisticWink = {
     id: tempId,
     tempId: tempId,
     sender: currentUser.id,
     recipient: partnerId,
     content: "😉",
     createdAt: new Date().toISOString(),
     type: 'wink',
     read: false,
     senderName: currentUser.nickname,
     senderPhoto: currentUser.photos?.[0]?.url || currentUser.photo,
   };
   setMessages((prev) => [...prev, optimisticWink].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
   updateConversationList(optimisticWink);

   if (mobileView && "vibrate" in navigator) {
     navigator.vibrate([20, 30, 20]);
   }

   try {
     const sentMessage = await chatService.sendMessage(partnerId, "😉", "wink");
     // Replace optimistic wink with actual server response
     setMessages((prev) =>
       prev
         .map((msg) => (msg.tempId === tempId ? { ...sentMessage, id: sentMessage.id || tempId } : msg))
         .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
     );
     // Update conversation list again with actual message data
     updateConversationList(sentMessage);
   } catch (err) {
     console.error("Error sending wink:", err);
     toast.error(`Failed to send wink: ${err.message || "Please try again."}`);
     // Revert optimistic update on failure
     setMessages((prev) => prev.filter(msg => msg.tempId !== tempId));
      setMessages((prev) => [...prev, {...optimisticWink, error: true, content: `😉 (Failed)` }]
                          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
     updateConversationList({...optimisticWink, error: true });
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
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error(`File is too large. Maximum size is ${maxSize / (1024 * 1024)}MB.`);
      e.target.value = null; // Reset file input
      return;
    }
    const allowedTypes = [
      "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", // Added webp
      "application/pdf",
      "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // Word docs
      "text/plain",
      "audio/mpeg", "audio/wav", "audio/ogg", // Added ogg
      "video/mp4", "video/quicktime", "video/webm" // Added webm
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error(`File type (${file.type || 'unknown'}) not supported.`);
      e.target.value = null; // Reset file input
      return;
    }
    setAttachment(file);
    toast.info(`Selected file: ${file.name}`);
    e.target.value = null; // Reset file input immediately after selection

    if (mobileView && "vibrate" in navigator) {
      navigator.vibrate(30);
    }
  };


  const handleRemoveAttachment = () => {
    setAttachment(null);
    setUploadProgress(0);
    setIsUploading(false); // Ensure uploading state is reset
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Clear the actual input element's value
    }
  };

  const handleSendAttachment = async () => {
    if (!attachment || !activeConversation?.user?.id || isUploading) return;
    if (activeConversation.user.id === currentUser.id) {
      toast.error("Cannot send files to yourself");
      return;
    }
    const partnerId = activeConversation.user.id;
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
    setUploadProgress(10);

    if (mobileView && "vibrate" in navigator) {
      navigator.vibrate(40);
    }

     // Optimistic UI for file upload
     const tempId = `temp-file-${Date.now()}`;
     const optimisticFileMessage = {
       id: tempId,
       tempId: tempId,
       sender: currentUser.id,
       recipient: partnerId,
       content: attachment.name, // Use file name as content initially
       createdAt: new Date().toISOString(),
       type: 'file',
       read: false,
       metadata: {
         fileName: attachment.name,
         fileType: attachment.type,
         fileSize: attachment.size,
         // Indicate it's a placeholder while uploading
         __localPlaceholder: true,
         // Create a local URL for preview if it's an image
         fileUrl: attachment.type.startsWith('image/') ? URL.createObjectURL(attachment) : null,
         url: attachment.type.startsWith('image/') ? URL.createObjectURL(attachment) : null,
       },
       senderName: currentUser.nickname,
       senderPhoto: currentUser.photos?.[0]?.url || currentUser.photo,
     };

     setMessages((prev) => [...prev, optimisticFileMessage].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
     // Don't update conversation list optimistically with file yet, wait for URL

    try {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("file", attachment);
      formData.append("recipient", partnerId); // Send recipient with upload

      const uploadFile = () => {
        return new Promise((resolve, reject) => {
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentComplete = Math.round((event.loaded / event.total) * 90) + 10; // Scale to 10-100%
              setUploadProgress(percentComplete);
            }
          };

          xhr.open("POST", "/api/messages/attachments", true); // Ensure async

           const authToken =
             chatService.getAuthToken?.() ||
             (typeof window !== 'undefined' ? localStorage.getItem("token") : null) ||
             (typeof window !== 'undefined' ? sessionStorage.getItem("token") : null) ||
             (typeof window !== 'undefined' ? localStorage.getItem("authToken") : null) ||
             (typeof window !== 'undefined' ? sessionStorage.getItem("authToken") : null);

           if (authToken) {
             xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);
           } else {
                console.warn("No auth token found for file upload request.");
                // Consider rejecting the promise or handling the error
                // reject(new Error("Authentication token not found"));
                // return;
           }

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const result = JSON.parse(xhr.responseText);
                if(result.success && result.data) {
                    resolve(result.data); // Resolve with the file data (URL, etc.)
                } else {
                    reject(new Error(result.error || "Upload processing failed"));
                }
              } catch (e) {
                reject(new Error(`Invalid response format: ${e.message}`));
              }
            } else {
              reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
            }
          };

          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.ontimeout = () => reject(new Error("Upload timed out")); // Add timeout handler
          xhr.timeout = 60000; // 60 second timeout

          xhr.send(formData);
        });
      };

      const fileData = await uploadFile(); // This now contains { url, fileName, mimeType, fileSize, metadata }
      setUploadProgress(100); // Mark as complete visually

      // *** No need to send a separate message via API ***
      // The backend should ideally create the message upon successful upload
      // and broadcast it via Socket.IO. The handleMessageReceived listener
      // should then pick it up and replace the placeholder.

      // However, if the backend *doesn't* automatically create and broadcast the message,
      // you would need to manually send it here using chatService.sendMessage or a direct API call.
      // Let's assume the backend *does* broadcast it for now.

      // We need to update the optimistic message metadata if possible, though waiting for socket is better.
       setMessages((prev) =>
         prev.map((msg) =>
           msg.tempId === tempId
             ? {
                 ...msg,
                 metadata: {
                   ...msg.metadata,
                   fileUrl: fileData.url, // Update with real URL
                   url: fileData.url,
                   __localPlaceholder: false, // Mark as no longer placeholder
                   // Revoke the local object URL if it exists and differs from the server URL
                   ...(msg.metadata?.fileUrl?.startsWith('blob:') && msg.metadata.fileUrl !== fileData.url && URL.revokeObjectURL(msg.metadata.fileUrl)),
                 },
               }
             : msg
         )
       );

      // Update conversation list now that we have the final message details (or let socket handle it)
      // updateConversationList({...optimisticFileMessage, metadata: {...optimisticFileMessage.metadata, fileUrl: fileData.url, url: fileData.url }});


      // If the local URL was used, revoke it after a short delay to allow rendering
      if (optimisticFileMessage.metadata?.fileUrl?.startsWith('blob:')) {
        setTimeout(() => {
          URL.revokeObjectURL(optimisticFileMessage.metadata.fileUrl);
        }, 1000); // Adjust delay as needed
      }


      toast.success("File uploaded successfully. Sending message..."); // Updated toast message

      // Reset state *after* potential message sending logic (if needed) or socket confirmation
      setAttachment(null);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";


      // Success vibration pattern
      if (mobileView && "vibrate" in navigator) {
        navigator.vibrate([30, 50, 30]);
      }

    } catch (error) {
      console.error("Failed to upload or send file:", error);
      toast.error(error.message || "Failed to send file. Please try again.");

      // Revert optimistic update on failure
      setMessages((prev) => prev.filter(msg => msg.tempId !== tempId));
       // Revoke local URL on error too
       if (optimisticFileMessage.metadata?.fileUrl?.startsWith('blob:')) {
         URL.revokeObjectURL(optimisticFileMessage.metadata.fileUrl);
       }
       // Maybe show failed placeholder?
        setMessages((prev) => [...prev, {...optimisticFileMessage, error: true, content: `${attachment.name} (Upload Failed)`}]
                             .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));


      // Error vibration pattern
      if (mobileView && "vibrate" in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    } finally {
      setIsUploading(false); // Ensure this is always reset
      // Don't reset attachment/progress here, do it on success or explicit removal
    }
  };


  const handleEmojiClick = (emoji) => {
    setMessageInput((prev) => prev + emoji);
    setShowEmojis(false);
    if (messageInputRef.current) {
      messageInputRef.current.focus();
    }
    if (mobileView && "vibrate" in navigator) {
      navigator.vibrate(20);
    }
  };

  const handleVideoCall = async () => {
    if (!activeConversation || !currentUser?.id) return;
    // Check socket connection using the service's method
    if (!socketService.isConnected || !socketService.isConnected()) {
       const errorMessage = {
         id: generateUniqueId(),
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
        id: generateUniqueId(),
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
        id: generateUniqueId(),
        sender: "system",
        content: "Free accounts cannot make video calls. Upgrade for video calls.",
        createdAt: new Date().toISOString(),
        type: "system",
        error: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
       // Optionally navigate to subscription page
       // navigate('/subscription');
      return;
    }

    const partnerId = activeConversation.user.id;
    if (!/^[0-9a-fA-F]{24}$/.test(partnerId)) {
      const errorMessage = {
        id: generateUniqueId(),
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
        id: generateUniqueId(),
        sender: "system",
        content: `Initiating call to ${activeConversation.user.nickname}...`,
        createdAt: new Date().toISOString(),
        type: "system",
      };
      setMessages((prev) => [...prev, infoMessage]);
      setIsCallActive(true); // Set call active state *before* initiating

      if (mobileView && "vibrate" in navigator) {
        navigator.vibrate([50, 100, 50]);
      }

      // Emit the call initiation request via socket service
      // The promise resolves/rejects based on socket ack or internal logic
      await socketService.initiateVideoCall(partnerId);

      // System message confirms *successful initiation attempt*
      const systemMessage = {
        id: generateUniqueId(),
        sender: "system",
        content: `Calling ${activeConversation.user.nickname}... Waiting for response.`, // Updated message
        createdAt: new Date().toISOString(),
        type: "system",
      };
       setMessages((prev) => [...prev, systemMessage]);
      console.debug("Call initiation request sent successfully for user:", partnerId);

    } catch (error) {
      console.error("Video call initiation error:", error);
      const errorMessage = {
        id: generateUniqueId(),
        sender: "system",
        content: `Call failed to initiate: ${error.message || "Could not start video call. Please try again."}`,
        createdAt: new Date().toISOString(),
        type: "system",
        error: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsCallActive(false); // Reset call state on initiation failure
    }
  };

  // Use useCallback for handleEndCall to stabilize its reference
  const handleEndCall = useCallback(() => {
    console.log("handleEndCall triggered. isCallActive:", isCallActive, "Active Convo:", activeConversation);
    if (activeConversation) {
      const partnerId = activeConversation.user.id;
      // Only emit hangup if a call was actually active *and* we have a valid partner
      if (isCallActive && /^[0-9a-fA-F]{24}$/.test(partnerId)) {
        console.log("Emitting videoHangup to:", partnerId);
        socketService.emit("videoHangup", { recipientId: partnerId });
      } else if (isCallActive) {
        console.warn("Cannot emit hangup for invalid partner ID:", partnerId);
      }

       // Add system message regardless of whether hangup was emitted (e.g., if user cancels before connection)
        const systemMessage = {
          id: generateUniqueId(),
          sender: "system",
          content: `Video call ended.`, // Simpler message
          createdAt: new Date().toISOString(),
          type: "system",
        };
        // Use functional update to avoid dependency on `messages` state
        setMessages((prev) => [...prev, systemMessage]);
    } else {
         console.log("handleEndCall: No active conversation.");
    }

    // Reset call states
    setIsCallActive(false);
    setIncomingCall(null); // Clear any potential incoming call banner


    // Hangup vibration pattern
    if (mobileView && "vibrate" in navigator) {
      navigator.vibrate(100);
    }
  }, [activeConversation, isCallActive, mobileView]); // Dependencies for useCallback


   const updateConversationList = useCallback((newMessage) => {
     if (!currentUser?.id || !newMessage) return;

     // Determine partner ID, handle potential missing fields gracefully
     const partnerId = newMessage.sender === currentUser.id
       ? newMessage.recipient
       : newMessage.sender;

     // Ensure partnerId is valid before proceeding
     if (!partnerId || partnerId === currentUser.id || !/^[0-9a-fA-F]{24}$/.test(partnerId)) {
       console.warn("Skipping conversation list update due to invalid partner ID:", partnerId, "Message:", newMessage);
       return;
     }

     setConversations((prev) => {
       const convoIndex = prev.findIndex((c) => c.user.id === partnerId);
       let updatedConvo;

       if (convoIndex !== -1) {
         // Conversation exists, update it
         updatedConvo = {
           ...prev[convoIndex],
           lastMessage: newMessage, // Update last message
           // Update unread count logic
           unreadCount: (newMessage.sender !== currentUser.id && (!activeConversation || activeConversation.user.id !== partnerId))
             ? (prev[convoIndex].unreadCount || 0) + 1
             : (activeConversation && activeConversation.user.id === partnerId)
               ? 0 // Reset if currently active
               : prev[convoIndex].unreadCount // Keep existing count if sending message in active chat
         };
         // Move updated conversation to the top
         return [updatedConvo, ...prev.filter((c) => c.user.id !== partnerId)];
       } else {
         // New conversation
         // Try to get sender details from the message, fallback gracefully
         const senderNickname = newMessage.senderName || `User ${partnerId.substring(0, 6)}`;
         const senderPhoto = newMessage.senderPhoto || null; // Use photo from message if available

         updatedConvo = {
           user: {
             id: partnerId,
             nickname: senderNickname,
             photo: senderPhoto,
             isOnline: false, // Assume offline initially, update later if possible
             accountTier: "FREE", // Assume FREE initially
           },
           lastMessage: newMessage,
           unreadCount: newMessage.sender !== currentUser.id ? 1 : 0,
         };
         // Add new conversation to the top
         return [updatedConvo, ...prev];
       }
     });
   }, [currentUser?.id, activeConversation]); // Dependencies for useCallback


  const markConversationAsRead = useCallback((partnerUserId) => {
    if (!partnerUserId || partnerUserId === currentUser?.id) return;
    if (!/^[0-9a-fA-F]{24}$/.test(partnerUserId)) {
      console.warn("Attempted to mark conversation read for invalid ID format:", partnerUserId);
      return;
    }

    // Update state optimistically first
    let marked = false;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.user.id === partnerUserId && c.unreadCount > 0) {
          marked = true;
          return { ...c, unreadCount: 0 };
        }
        return c;
      })
    );

    // If a conversation was actually marked as read, notify the service
    if (marked) {
        // Add a slight delay to ensure UI update happens first if needed
        setTimeout(() => {
            chatService.markConversationRead(partnerUserId);
        }, 50);
    }
  }, [currentUser?.id]); // Dependency for useCallback


  const sendTypingIndicator = useCallback(() => {
     // Check connection status from the service
     if (activeConversation && chatService.isConnected && chatService.isConnected() && currentUser?.id) {
       const partnerId = activeConversation.user.id;
       if (/^[0-9a-fA-F]{24}$/.test(partnerId)) {
         chatService.sendTypingIndicator(partnerId);
       } else {
         console.warn("Cannot send typing indicator for invalid partner ID:", partnerId);
       }
     }
   }, [activeConversation, currentUser?.id]); // Dependencies for useCallback


  const handleMessageInputChange = (e) => {
    const value = e.target.value;
    setMessageInput(value);

    // Send typing indicator only if input is not empty and partner ID is valid
    if (value.trim() && activeConversation?.user?.id) {
      if (/^[0-9a-fA-F]{24}$/.test(activeConversation.user.id)) {
        // Clear existing timeout and set a new one
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(sendTypingIndicator, 500); // Use a slightly longer delay
      }
    } else {
        // If input is cleared, clear the timeout
         if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }

    // Auto-resize textarea
    e.target.style.height = "auto"; // Reset height first
    const maxHeight = 120; // Max height in pixels
    e.target.style.height = `${Math.min(e.target.scrollHeight, maxHeight)}px`;
  };

  const handleKeyPress = (e) => {
    // Check if Enter key is pressed without the Shift key
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // Prevent default behavior (newline)
      if (attachment) {
        handleSendAttachment();
      } else if (messageInput.trim()) { // Only send if there's text
        handleSendMessage();
      }
      // Reset textarea height after sending
      if (e.target) e.target.style.height = "auto";
    }
  };

  const selectConversation = useCallback((conversation) => {
    if (!conversation?.user?.id || (activeConversation && activeConversation.user.id === conversation.user.id))
      return;
    if (conversation.user.id === currentUser?.id) {
      toast.warning("You cannot message yourself");
      return;
    }
    if (!/^[0-9a-fA-F]{24}$/.test(conversation.user.id)) {
      toast.error("Cannot select conversation: Invalid user ID.");
      console.error("Attempted to select conversation with invalid ID:", conversation.user.id);
      return;
    }

    // Reset relevant states before setting new conversation
    setMessages([]); // Clear previous messages immediately
    setMessagesLoading(true); // Indicate loading for the new conversation
    setError(null); // Clear any previous errors
    setMessageInput(""); // Clear message input
    setAttachment(null); // Clear any attachment preview
    setTypingUser(null); // Clear typing indicator
    loadedConversationRef.current = null; // Reset loaded ref to force message loading

    setActiveConversation(conversation);

    // Navigate to the new conversation URL
    navigate(`/messages/${conversation.user.id}`, { replace: true }); // Use replace to avoid history clutter

    // Mark as read (will be handled by useEffect on activeConversation change, but can call here too)
    // markConversationAsRead(conversation.user.id); // This might be redundant due to useEffect

    if (mobileView) {
      setShowSidebar(false); // Hide sidebar on mobile when a convo is selected
    }

    if (mobileView && "vibrate" in navigator) {
      navigator.vibrate(20);
    }
  }, [activeConversation, currentUser?.id, mobileView, navigate]); // Dependencies


  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
    if (mobileView && "vibrate" in navigator) {
      navigator.vibrate(15);
    }
  };

  // Memoize grouped messages to avoid re-computation on every render
   const groupedMessages = useMemo(() => groupMessagesByDate(messages), [messages]);


  const getFileIcon = (fileType) => {
    if (!fileType) return <FaFile />;
    if (fileType.startsWith("image/")) return <FaImage />;
    if (fileType.startsWith("video/")) return <FaFileVideo />;
    if (fileType.startsWith("audio/")) return <FaFileAudio />;
    if (fileType === "application/pdf") return <FaFilePdf />;
    // Add more specific icons if needed
    if (fileType.includes("word")) return <FaFileAlt />; // Simple check for Word
    if (fileType.includes("spreadsheet") || fileType.includes("excel")) return <FaFileAlt />; // Placeholder
    return <FaFileAlt />; // Default document icon
  };

  // --- Render Logic ---

  if (componentLoading || authLoading) {
    return <MessagesWrapper>
      <div className={styles.messagesLoading}>
        {/* Use LoadingSpinner component */}
        <LoadingSpinner size="large" text="Loading chat..." centered />
      </div>
    </MessagesWrapper>;
  }

  if (!isAuthenticated && !authLoading) {
    return <MessagesWrapper>
      <div className={styles.noActiveChat}>
        <div className={styles.noActiveChatContent}>
          <h3>Please Login</h3>
          <p>You need to login to view your messages.</p>
          <button
            className={styles.startChatButton}
            onClick={() => navigate('/login')} // Navigate to login page
          >
            Go to Login
          </button>
        </div>
      </div>
    </MessagesWrapper>;
  }

  // Display error centrally if no conversation is selected yet
  if (error && !activeConversation && !messagesLoading && !componentLoading) {
    return <MessagesWrapper>
      <div className={styles.noActiveChat}>
        <div className={`${styles.noActiveChatContent} ${styles.errorContent}`}>
          <h3>Error</h3>
          <p>{error}</p>
          <button
            className={styles.startChatButton} // Re-use style for retry button
            onClick={() => window.location.reload()} // Simple retry: reload page
          >
            Retry
          </button>
        </div>
      </div>
    </MessagesWrapper>;
  }


  return (
    <MessagesWrapper>
      <div
        className={styles.messagesContainer}
        ref={messagesContainerRef}
        // Conditionally apply touch handlers only on mobile view
        onTouchStart={mobileView ? handleTouchStart : undefined}
        onTouchMove={mobileView ? handleTouchMove : undefined}
        onTouchEnd={mobileView ? handleTouchEnd : undefined}
      >
        {/* Sidebar */}
        <div className={classNames(styles.sidebar, showSidebar ? styles.show : styles.hide)}>
          <div className={styles.sidebarHeader}>
            <h2>Messages</h2>
            <div className={styles.sidebarActions}>
              {mobileView && (
                <button
                  className={styles.newConversationButton}
                  onClick={() => navigate('/users')} // Navigate to user list/search
                  aria-label="New conversation"
                  title="Find Users"
                >
                  <FaPlus />
                </button>
              )}
              {/* Close button for sidebar on mobile when chat is active */}
              {mobileView && activeConversation && (
                <button className={styles.closeSidebarButton} onClick={toggleSidebar} aria-label="Close sidebar">
                  &times; {/* Using times symbol for close */}
                </button>
              )}
            </div>
          </div>

          <div
            className={styles.conversationsList}
            ref={conversationsListRef}
          >
            {/* Pull-to-refresh indicator */}
            {mobileView && (
              <div
                ref={refreshIndicatorRef}
                className={styles.pullToRefreshIndicator}
                style={{ transform: `translateY(0)`, opacity: 0 }} // Initial state: hidden
              >
                {/* Dynamically change text based on pull distance */}
                <span>
                  {isRefreshing && pullDistance > 50 ? 'Release to refresh' : 'Pull down to refresh'}
                </span>
                {/* Show spinner only when actively pulling below threshold */}
                {isRefreshing && pullDistance > 10 && pullDistance <= 50 && <LoadingSpinner size="small" />}
              </div>
            )}

            {/* Handle case where conversations might still be loading */}
             {componentLoading && conversations.length === 0 ? (
                 <div className={styles.noConversations}>
                     <LoadingSpinner size="medium" text="Loading conversations..." />
                 </div>
             ) : conversations.length === 0 ? (
              <div className={styles.noConversations}>
                <FaEnvelope size={32} />
                <p>No conversations yet.</p>
                <button
                  className={styles.startChatButton}
                  onClick={() => navigate('/users')}
                >
                  Find someone to chat with
                </button>
              </div>
            ) : (
              conversations.map((convo) => {
                // Basic validation for conversation object
                if (!convo || !convo.user || !convo.user.id || !/^[0-9a-fA-F]{24}$/.test(convo.user.id)) {
                  console.warn("Skipping rendering invalid conversation item:", convo);
                  return null; // Skip rendering this item
                }
                return (
                  <div
                    key={convo.user.id}
                    className={classNames(
                        styles.conversationItem,
                        activeConversation?.user.id === convo.user.id && styles.active,
                        convo.unreadCount > 0 && styles.unread
                    )}
                    onClick={() => selectConversation(convo)}
                    role="button"
                    tabIndex={0}
                    aria-current={activeConversation?.user.id === convo.user.id ? "page" : undefined}
                  >
                    <div className={styles.avatarContainer}>
                      <Avatar src={convo.user.photo} alt={convo.user.nickname || 'User Avatar'} size="medium" />
                      {convo.user.isOnline && <span className={`${styles.statusIndicator} ${styles.online}`} title="Online"></span>}
                    </div>
                    <div className={styles.conversationInfo}>
                      <div className={styles.conversationName}>
                        {/* Display nickname, fallback to 'Unknown User' */}
                        <span>{convo.user.nickname || "Unknown User"}</span>
                        {convo.unreadCount > 0 && <span className={styles.unreadBadge} title={`${convo.unreadCount} unread message${convo.unreadCount > 1 ? 's' : ''}`}>{convo.unreadCount}</span>}
                      </div>
                      <div className={styles.conversationPreview}>
                         {/* Format last message preview, handle null/undefined lastMessage */}
                         {convo.lastMessage ? formatMessagePreview(convo.lastMessage, currentUser.id) : <span className={styles.noMessagesHint}>No messages yet</span>}
                      </div>
                    </div>
                    {/* Show time only if last message exists and has a timestamp */}
                    {convo.lastMessage?.createdAt && (
                      <div className={styles.conversationTime} title={formatDate(convo.lastMessage.createdAt, { showTime: true, showDate: true })}>
                        {formatDate(convo.lastMessage.createdAt, { showRelative: true })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={classNames(styles.chatArea, (!showSidebar && mobileView) && styles.fullWidth)}>
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className={styles.chatHeader}>
                {/* Ensure user object and ID exist before rendering */}
                {activeConversation.user && activeConversation.user.id ? (
                  <div className={styles.chatUser}>
                    {mobileView && (
                      <button className={styles.backButton} onClick={toggleSidebar} aria-label="Back to conversation list">
                        <FaArrowLeft />
                      </button>
                    )}
                    <div className={styles.avatarContainer}>
                      <Avatar src={activeConversation.user.photo} alt={activeConversation.user.nickname || 'User Avatar'} size="medium" />
                       {/* Show online status indicator */}
                       {activeConversation.user.isOnline && <span className={`${styles.statusIndicator} ${styles.online}`} title="Online"></span>}
                    </div>
                    <div className={styles.chatUserDetails}>
                       {/* Display nickname, fallback to 'Unknown User' */}
                       <h3>{activeConversation.user.nickname || "Unknown User"}</h3>
                      <span className={classNames(styles.statusText, activeConversation.user.isOnline ? styles.online : styles.offline)}>
                        {activeConversation.user.isOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                    <div className={styles.chatActions}>
                      {/* Video Call / End Call Button */}
                      {currentUser?.accountTier !== "FREE" && (
                        <>
                          {isCallActive ? (
                             // End call button
                             <button className={classNames(styles.actionButton, styles.endCallButton)} onClick={handleEndCall} title="End call">
                              <FaPhoneSlash />
                            </button>
                          ) : (
                            // Start call button
                             <button
                              className={styles.actionButton}
                              onClick={handleVideoCall}
                               // Dynamic title based on online status
                               title={activeConversation.user.isOnline ? "Start Video Call" : `${activeConversation.user.nickname} is offline`}
                               // Disable if user is offline, call is already active, or ID is invalid
                               disabled={!activeConversation.user.isOnline || isCallActive || !/^[0-9a-fA-F]{24}$/.test(activeConversation.user.id)}
                              aria-label="Start Video Call"
                            >
                              <FaVideo />
                            </button>
                          )}
                        </>
                      )}
                      {/* More Options Button (Placeholder) */}
                      <button className={styles.actionButton} title="More options" aria-label="More options">
                        <FaEllipsisH />
                      </button>
                    </div>
                  </div>
                ) : (
                   // Placeholder if user data is somehow missing (shouldn't happen with checks)
                   <div className={styles.chatUser}>Loading user...</div>
                )}
              </div>

              {/* Premium Banner for FREE users */}
              {currentUser?.accountTier === "FREE" && (
                <div className={styles.premiumBanner}>
                  <div>
                    <FaCrown className={styles.premiumIcon} />
                    <span>Upgrade to send messages and make calls</span>
                  </div>
                  <button className={styles.upgradeBtn} onClick={() => navigate("/subscription")}>
                    Upgrade Now
                  </button>
                </div>
              )}

              {/* Active Call Banner */}
              {isCallActive && (
                <div className={styles.activeCallBanner}>
                  <div>
                    <FaVideo className={styles.callIcon} />
                    <span>Call with {activeConversation.user.nickname}</span>
                  </div>
                  <button className={styles.endCallBtn} onClick={handleEndCall}>
                    <FaPhoneSlash /> End Call
                  </button>
                </div>
              )}

              {/* Incoming Call Banner */}
              {incomingCall && !isCallActive && (
                <div className={styles.incomingCallBanner}>
                  <div className={styles.incomingCallInfo}>
                    <FaVideo className={styles.callIcon} />
                    {/* Use nickname from activeConversation for consistency */}
                    <span>{activeConversation.user.nickname} is calling you</span>
                  </div>
                  <div className={styles.incomingCallActions}>
                    <button
                      className={styles.declineCallBtn}
                      onClick={() => {
                         // Validate callerId before answering
                         if (incomingCall.callerId && /^[0-9a-fA-F]{24}$/.test(incomingCall.callerId)) {
                           socketService.answerVideoCall(incomingCall.callerId, false, incomingCall.callId);
                           const systemMessage = {
                             id: generateUniqueId(),
                             sender: "system",
                             content: `You declined the video call from ${activeConversation.user.nickname}.`,
                             createdAt: new Date().toISOString(),
                             type: "system",
                           };
                           setMessages((prev) => [...prev, systemMessage]);
                         } else {
                           console.error("Cannot decline call: Invalid caller ID format", incomingCall.callerId);
                           toast.error("Error declining call (Invalid ID).");
                         }
                         setIncomingCall(null); // Clear banner after action
                      }}
                    >
                      <FaTimes /> Decline
                    </button>
                    <button
                      className={styles.acceptCallBtn}
                      onClick={() => {
                         // Validate callerId before answering
                         if (incomingCall.callerId && /^[0-9a-fA-F]{24}$/.test(incomingCall.callerId)) {
                             // Check account tier before accepting
                             if (currentUser?.accountTier === "FREE") {
                                 toast.error("Free accounts cannot receive video calls. Upgrade to accept.");
                                 // Optionally decline automatically
                                 socketService.answerVideoCall(incomingCall.callerId, false, incomingCall.callId);
                                 setIncomingCall(null);
                                 return;
                             }

                             socketService.answerVideoCall(incomingCall.callerId, true, incomingCall.callId);
                             const systemMessage = {
                               id: generateUniqueId(),
                               sender: "system",
                               content: `You accepted the video call from ${activeConversation.user.nickname}.`,
                               createdAt: new Date().toISOString(),
                               type: "system",
                             };
                             setMessages((prev) => [...prev, systemMessage]);
                             setIsCallActive(true); // Set call active
                             setIncomingCall(null); // Clear banner
                           } else {
                               console.error("Cannot accept call: Invalid caller ID format", incomingCall.callerId);
                               toast.error("Error accepting call (Invalid ID).");
                               setIncomingCall(null); // Clear banner on error too
                           }
                       }}
                    >
                      <FaVideo /> Accept
                    </button>
                  </div>
                </div>
              )}

              {/* Messages Area */}
              <div className={styles.messagesArea}>
                {messagesLoading ? (
                  <div className={styles.messagesLoading}>
                    <LoadingSpinner size="medium" text="Loading messages..." centered />
                  </div>
                ) : error && messages.length === 0 ? ( // Show error only if messages failed to load initially
                  <div className={styles.noMessages}>
                    <div className={`${styles.noMessagesContent} ${styles.errorContent}`}>
                      <p>Error loading messages:</p>
                      <p>{error}</p>
                       {/* Provide retry mechanism specific to loading messages */}
                       <button onClick={() => loadMessages(activeConversation.user.id)} className={styles.btnSecondary}>
                        Retry Loading Messages
                      </button>
                    </div>
                  </div>
                 ) : Object.entries(groupedMessages).length === 0 && !messagesLoading ? (
                  // Show "No messages" only if not loading and no messages exist
                   <div className={styles.noMessages}>
                    <div className={styles.noMessagesContent}>
                      <FaEnvelope size={40} />
                      <p>No messages in this conversation yet.</p>
                      <p className={styles.hint}>
                           {currentUser?.accountTier === "FREE" ? "Send a wink to start!" : "Say hello to start the conversation!"}
                       </p>
                    </div>
                  </div>
                ) : (
                   // Render message groups
                   Object.entries(groupedMessages).map(([date, msgs]) => (
                    <div key={date} className={styles.messageGroup}>
                      <div className={styles.dateSeparator}>
                        <span>{date}</span>
                      </div>
                      {msgs.map((msg) => {
                         // Validate message object before rendering
                         if (!msg || (!msg.id && !msg.tempId)) {
                           console.warn("Skipping rendering invalid message:", msg);
                           return null;
                         }
                         const isFromMe = msg.sender === currentUser.id;
                         let statusIndicator = null;
                         if (isFromMe && msg.type !== 'system' && !msg.error) { // Don't show status for system or failed messages
                              // Determine status: Sending (spinner), Sent (single check), Read (double check)
                              if (msg.tempId && isSending && messages.some(m => m.tempId === msg.tempId)) {
                                  statusIndicator = <FaSpinner className="fa-spin" size={12} title="Sending..." />;
                              } else if (msg.read) {
                                  statusIndicator = <FaCheckDouble size={12} title="Read" />;
                              } else {
                                  statusIndicator = <FaCheck size={12} title="Sent" />;
                              }
                          }

                         return (
                          <div
                            key={msg.id || msg.tempId} // Use tempId as fallback key
                             className={classNames(
                                 styles.messageBubble,
                                 isFromMe ? styles.sent : styles.received,
                                 msg.type === "system" && styles.systemMessage,
                                 msg.error && styles.errorMessageBubble, // Use a specific class for error bubbles
                                 msg.type === "wink" && styles.winkMessage,
                                 msg.metadata?.__localPlaceholder && styles.placeholderMessage // Style for placeholders
                             )}
                             title={msg.error ? "Message failed to send" : undefined}
                          >
                            {/* --- Message Content based on Type --- */}

                             {/* System Message */}
                             {msg.type === "system" ? (
                              <div className={classNames(styles.systemMessageContent, msg.error && styles.errorContent)}>
                                <p>{msg.content}</p>
                                <span className={styles.messageTime} title={formatDate(msg.createdAt, { showTime: true, showDate: true })}>
                                  {formatDate(msg.createdAt, { showTime: true, showDate: false })}
                                </span>
                              </div>
                            ) :

                            /* Wink Message */
                            msg.type === "wink" ? (
                              <div className={styles.winkContent}>
                                <p className={styles.messageContent}>😉</p>
                                <span className={styles.messageLabel}>Wink</span>
                                <span className={styles.messageTime} title={formatDate(msg.createdAt, { showTime: true, showDate: true })}>
                                  {formatDate(msg.createdAt, { showTime: true, showDate: false })}
                                  {isFromMe && <span className={styles.statusIndicator}>{statusIndicator}</span>}
                                </span>
                              </div>
                            ) :

                            /* File Message */
                            msg.type === "file" && msg.metadata ? (
                              <div className={styles.fileMessage}>
                                 {/* Image File */}
                                 {msg.metadata.fileType?.startsWith("image/") ? (
                                  <div className={styles.imageContainer}>
                                     {/* Link wrapping the image */}
                                     <a
                                        href={msg.metadata.fileUrl || msg.metadata.url || "#"} // Fallback href
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.imageLink}
                                        onClick={(e) => e.stopPropagation()} // Prevent bubble click
                                        title={`View ${msg.metadata.fileName || "image"} in new tab`}
                                      >
                                      <img
                                         // Use local blob URL for optimistic preview if available
                                         src={msg.metadata.__localPlaceholder && msg.metadata.url?.startsWith('blob:') ? msg.metadata.url : (msg.metadata.fileUrl || msg.metadata.url || "/placeholder.svg")}
                                         alt={msg.metadata.fileName || "Image attachment"}
                                         className={classNames(styles.imageAttachment, msg.metadata.__localPlaceholder && styles.loading)} // Add loading style for placeholder
                                         loading="lazy" // Lazy load images
                                         onLoad={(e) => {
                                             // console.log("Image loaded:", msg.metadata.fileName);
                                             e.target.classList.remove(styles.loading);
                                         }}
                                         onError={(e) => {
                                            console.error("Image failed to load:", msg.metadata.fileUrl || msg.metadata.url);
                                            e.target.onerror = null; // prevent infinite loop
                                            e.target.src = "/placeholder-error.svg"; // Use an error placeholder
                                            e.target.classList.remove(styles.loading);
                                          }}
                                       />
                                     </a>
                                     {/* Caption below the image */}
                                     <div className={styles.imgCaption}>
                                        {/* Optionally link the caption too */}
                                        <a
                                            href={msg.metadata.fileUrl || msg.metadata.url || "#"}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            title={`View ${msg.metadata.fileName || "image"} in new tab`}
                                        >
                                            {msg.metadata.fileName || "Image"}
                                        </a>
                                         {/* Show file size if available */}
                                         {msg.metadata.fileSize ? ` (${Math.round(msg.metadata.fileSize / 1024)} KB)` : ""}
                                     </div>
                                  </div>
                                ) : (
                                  /* Non-Image File */
                                  <div className={styles.fileAttachment}>
                                    {getFileIcon(msg.metadata.fileType)}
                                    <div className={styles.fileInfo}>
                                        <span className={styles.fileName}>{msg.metadata.fileName || "File"}</span>
                                        {/* Show file size */}
                                        {msg.metadata.fileSize && (
                                            <span className={styles.fileSize}>
                                                {`(${Math.round(msg.metadata.fileSize / 1024)} KB)`}
                                            </span>
                                        )}
                                        {/* Download link - only if URL exists and not a placeholder */}
                                         {Boolean(msg.metadata.fileUrl || msg.metadata.url) && !msg.metadata.__localPlaceholder && (
                                          <a
                                              href={String(msg.metadata.fileUrl || msg.metadata.url || "#")}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className={styles.downloadLink}
                                              onClick={(e) => e.stopPropagation()} // Prevent bubble click
                                              download={msg.metadata.fileName || true} // Suggest filename for download
                                          >
                                              Download
                                          </a>
                                         )}
                                         {/* Show uploading indicator */}
                                         {msg.metadata.__localPlaceholder && (
                                             <span className={styles.uploadingIndicator}>Uploading...</span>
                                         )}
                                    </div>
                                  </div>
                                )}
                                {/* Timestamp and Status for File Messages */}
                                <div className={styles.messageMeta}>
                                    <span className={styles.messageTime} title={formatDate(msg.createdAt, { showTime: true, showDate: true })}>
                                      {formatDate(msg.createdAt, { showTime: true, showDate: false })}
                                    </span>
                                    {isFromMe && <span className={styles.statusIndicator}>{statusIndicator}</span>}
                                 </div>
                              </div>
                            ) :

                            /* Text Message (Default) */
                            (
                              <>
                                 {/* Handle failed messages specifically */}
                                 {msg.error ? (
                                     <div className={styles.errorMessageContent}>
                                         <span className={styles.errorIcon}>!</span>
                                         <span>{msg.content || "Failed to send"}</span>
                                     </div>
                                 ) : (
                                     <div className={styles.messageContent}>{msg.content || ""}</div>
                                 )}
                                 <div className={styles.messageMeta}>
                                  <span className={styles.messageTime} title={formatDate(msg.createdAt, { showTime: true, showDate: true })}>
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

                {/* Typing Indicator */}
                 {typingUser && activeConversation?.user?.id === typingUser && (
                    <div className={styles.typingIndicatorBubble}>
                        <div className={styles.typingIndicator}>
                          <div className={styles.dot}></div>
                          <div className={styles.dot}></div>
                          <div className={styles.dot}></div>
                        </div>
                    </div>
                )}

                {/* Element to scroll to */}
                <div ref={messagesEndRef} style={{ height: '1px' }} />
              </div>

              {/* Attachment Preview Area */}
              {attachment && (
                <div className={styles.attachmentPreview}>
                  <div className={styles.attachmentInfo}>
                    {getFileIcon(attachment.type)}
                    <span className={styles.attachmentName} title={attachment.name}>{attachment.name}</span>
                    <span className={styles.attachmentSize}>({Math.round(attachment.size / 1024)} KB)</span>
                  </div>
                  {isUploading ? (
                    <div className={styles.uploadProgressContainer}>
                      <div
                        className={styles.uploadProgressBar}
                        style={{ width: `${uploadProgress}%` }} // Dynamic width based on progress
                      ></div>
                      <span className={styles.uploadProgressText}>{uploadProgress}%</span>
                    </div>
                  ) : (
                    // Show remove button only if not currently uploading
                    <button
                      className={styles.removeAttachment}
                      onClick={handleRemoveAttachment}
                      disabled={isUploading} // Disable if uploading (double check)
                      title="Remove attachment"
                      aria-label="Remove attachment"
                    >
                      <FaTimes />
                    </button>
                  )}
                </div>
              )}

              {/* Emoji Picker */}
              {showEmojis && (
                <div className={styles.emojiPicker}>
                  <div className={styles.emojiHeader}>
                    <h4>Select Emoji</h4>
                    <button onClick={() => setShowEmojis(false)} aria-label="Close emoji picker">
                      <FaTimes />
                    </button>
                  </div>
                  <div className={styles.emojiList}>
                    {commonEmojis.map((emoji) => (
                      <button key={emoji} type="button" onClick={() => handleEmojiClick(emoji)} title={emoji}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Area */}
              <div className={styles.inputArea}>
                 {/* Emoji Button */}
                 <button
                  type="button"
                  className={styles.emojiButton}
                  onClick={() => setShowEmojis(!showEmojis)}
                  title="Add Emoji"
                  aria-label="Add Emoji"
                  aria-expanded={showEmojis}
                >
                  <FaSmile />
                </button>
                 {/* Message Input Textarea */}
                 <textarea
                  ref={messageInputRef}
                  className={styles.messageInput}
                   placeholder={currentUser?.accountTier === "FREE" ? "Send a wink instead (Free Account)" : "Type a message..."}
                  value={messageInput}
                  onChange={handleMessageInputChange}
                  onKeyPress={handleKeyPress}
                  rows={1} // Start with 1 row, auto-resizes
                   // Disable input based on various states
                   disabled={isSending || isUploading || (currentUser?.accountTier === "FREE" && !attachment) || !!incomingCall || isCallActive}
                   title={currentUser?.accountTier === "FREE" ? "Upgrade to send text messages" : "Type a message (Shift+Enter for newline)"}
                  aria-label="Message Input"
                />
                 {/* Attach File Button */}
                 <button
                  type="button"
                  className={styles.attachButton}
                  onClick={handleFileAttachment}
                   // Disable based on states and account tier
                   disabled={isSending || isUploading || currentUser?.accountTier === "FREE" || !!incomingCall || isCallActive}
                   title={currentUser?.accountTier === "FREE" ? "Upgrade to send files" : "Attach File"}
                  aria-label="Attach File"
                >
                  <FaPaperclip />
                </button>
                 {/* Hidden File Input */}
                 <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }} // Keep hidden
                  onChange={handleFileChange}
                  // Define accepted file types
                   accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,audio/mpeg,audio/wav,audio/ogg,video/mp4,video/quicktime,video/webm"
                  // Use device camera on mobile if possible
                  capture={mobileView ? "environment" : undefined}
                />
                 {/* Send Wink Button */}
                 <button
                  type="button"
                  className={styles.winkButton}
                  onClick={handleSendWink}
                   // Disable based on states
                   disabled={isSending || isUploading || !!incomingCall || isCallActive}
                  title="Send Wink"
                  aria-label="Send Wink"
                >
                  <FaHeart />
                </button>
                 {/* Send Button (Text or Attachment) */}
                 <button
                   // Determine action based on whether an attachment is selected
                   onClick={attachment ? handleSendAttachment : handleSendMessage}
                   className={classNames(
                       styles.sendButton,
                       // Disable if no text AND no attachment, or during sending/uploading/call
                       (!messageInput.trim() && !attachment) && styles.disabled,
                       (isSending || isUploading) && styles.sending
                   )}
                   // More comprehensive disabled check
                   disabled={(!messageInput.trim() && !attachment) || isSending || isUploading || !!incomingCall || isCallActive}
                   title={attachment ? "Send File" : "Send Message"}
                   aria-label={attachment ? "Send File" : "Send Message"}
                 >
                   {/* Show spinner when sending/uploading, otherwise show plane icon */}
                   {isSending || isUploading ? <FaSpinner className="fa-spin" /> : <FaPaperPlane />}
                 </button>
              </div>
            </>
          ) : (
             // Placeholder when no conversation is selected
             <div className={styles.noActiveChat}>
              <div className={styles.noActiveChatContent}>
                <FaEnvelope size={48} />
                <h3>Your Messages</h3>
                <p>Select a conversation from the list to start chatting.</p>
                {/* Display general error here if it occurred before selecting chat */}
                 {error && <p className={styles.errorMessage}>{error}</p>}
                <button
                  className={styles.startChatButton}
                  onClick={() => navigate('/users')} // Navigate to user list/search
                >
                  Find someone to chat with
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video Call Overlay */}
       {/* Render VideoCall component conditionally */}
       {isCallActive && activeConversation?.user?.id && /^[0-9a-fA-F]{24}$/.test(activeConversation.user.id) && (
        <div className={styles.videoCallOverlay}>
          <VideoCall
            isActive={isCallActive} // Pass active state
            userId={currentUser?.id}
            recipientId={activeConversation.user.id} // Pass recipient ID
            onEndCall={handleEndCall} // Pass end call handler
             // Determine if it's an incoming call being accepted
             isIncoming={false} // This overlay is generally for outgoing or *active* calls
             // Pass call ID if available (might be needed for signalling)
             callId={null} // Or pass relevant call ID if stored
          />
        </div>
      )}
    </MessagesWrapper>
  );
};

export default Messages;
