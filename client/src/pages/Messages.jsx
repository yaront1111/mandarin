"use client";

import React, { useState, useEffect, useRef, useContext, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import chatService from "../services/ChatService";
import { formatDate, classNames, debounce } from "../utils";
import apiService from "../services/apiService";
import logger from "../utils/logger";
import { messageDeduplicator } from "../utils/messageDeduplication.js";
import styles from "../styles/Messages.module.css";
import { useUser } from "../context";

// Create a named logger for this component
const log = logger.create("Messages");

// Core components
import LoadingSpinner from "../components/common/LoadingSpinner";
import Avatar from "../components/common/Avatar";
import MessagesWrapper from '../components/MessagesWrapper';
import AuthContext from "../context/AuthContext";
import { useIsMobile, useMobileDetect, useBlockedUsers } from "../hooks";
import { FaCrown, FaEnvelope } from "react-icons/fa";
import VideoCall from "../components/VideoCall";
import UserProfileModal from "../components/UserProfileModal";
import socketService from "../services/socketService";

// Chat components
import {
  // Components
  AttachmentPreview,
  CallBanners,
  ChatArea,
  ChatHeader,
  ChatInput,
  ConversationList,
  EmojiPicker,
  FileAttachmentHandler,
  LoadingIndicator,
  ErrorMessage,
  NoMessagesPlaceholder,
  MessageItem,
  MessageList,
  PremiumBanner,
  TypingIndicator,

  // Utils
  groupMessagesByDate,
  formatMessagePreview,
  generateLocalUniqueId,

  // Constants
  ACCOUNT_TIER
} from "../components/chat";

// Add gesture support for mobile
const SWIPE_THRESHOLD = 50; // Minimum distance to trigger swipe action

// Use function from chatUtils instead
const generateUniqueId = () => generateLocalUniqueId('system');

const Messages = () => {
  // Context and router hooks
  const { userId: targetUserIdParam } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, loading: authLoading, isAuthenticated } = useContext(AuthContext);
  const { blockUser, reportUser, unblockUser } = useUser();
  const { isUserBlocked, markBlockedUsers, fetchBlockedUsers, blockedUsers } = useBlockedUsers();

  // Local state
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [componentLoading, setComponentLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [typingUser, setTypingUser] = useState(null);

  // Use our custom hook for mobile detection instead of manual window width check
  const isMobile = useIsMobile();
  const { isTouch, isIOS, isAndroid } = useMobileDetect();
  const [showSidebar, setShowSidebar] = useState(true);
  
  // Memoize user ID to prevent unnecessary re-renders
  const currentUserId = useMemo(() => currentUser?._id, [currentUser?._id]);
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

  // Profile modal state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState(null);

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
  const messagesRef = useRef([]); // Track current messages to help detect duplicates

  // Common emojis for the emoji picker - memoized to prevent recreating array on each render
  const commonEmojis = useMemo(() => [
    "😊", "😂", "😍", "❤️", "👍", "🙌", "🔥", "✨", "🎉", "🤔", "😉", "🥰"
  ], []);
  
  // Keep messagesRef in sync with messages state and optimize message deduplication
  useEffect(() => {
    messagesRef.current = messages;
    
    // Add message IDs to the seen messages set when they're added to the state
    messages.forEach(message => {
      const messageId = message._id || message.tempId;
      if (messageId && !seenMessagesRef.current.has(messageId)) {
        seenMessagesRef.current.add(messageId);
      }
    });
    
    // Clean up seen messages set if it gets too large
    if (seenMessagesRef.current.size > 1000) {
      // Keep the 500 most recent message IDs by removing the oldest
      const oldestMessages = Array.from(seenMessagesRef.current).slice(0, 500);
      oldestMessages.forEach(id => seenMessagesRef.current.delete(id));
    }
  }, [messages]);
  
  // Add a throttle for wink messages to prevent sending multiple winks at once
  const lastWinkSentRef = useRef(0);
  const lastMessageSentRef = useRef({});
  
  // Global message tracker to prevent duplicates from any source
  const seenMessagesRef = useRef(new Set());
  const seenWinksRef = useRef([]); // Special handling for winks
  
  // Create a function to check if a message is a duplicate
  const isDuplicateMessage = useCallback((message) => {
    // Skip system messages from duplication checking
    if (message.type === 'system') return false;
    
    const messageId = message._id || message.tempId;
    
    // First level check: exact ID match
    if (messageId && seenMessagesRef.current.has(messageId)) {
      console.log("Duplicate message detected by exact ID match:", messageId);
      return true;
    }
    
    // Second level check: content + sender + recipient + approximate time
    // This catches messages that might have different IDs but are effectively duplicates
    if (message.sender && message.content) {
      // Create a signature combining the key aspects of a message
      const messageTimestamp = new Date(message.createdAt || Date.now()).getTime();
      const signatureKey = `${message.sender}:${message.recipient || ''}:${message.type}:${message.content}:${Math.floor(messageTimestamp/5000)}`;
      
      // Check if we've seen this signature in our messages
      if (messagesRef.current) {
        const similarMessages = messagesRef.current.filter(existingMsg => 
          existingMsg.sender === message.sender &&
          existingMsg.recipient === (message.recipient || '') &&
          existingMsg.type === message.type &&
          existingMsg.content === message.content &&
          Math.abs(new Date(existingMsg.createdAt || Date.now()).getTime() - messageTimestamp) < 5000
        );
        
        if (similarMessages.length > 0) {
          console.log("Duplicate message detected by content+time signature:", signatureKey);
          return true;
        }
      }
      
      // Third level: special handling for winks which are prone to duplication
      if (message.type === 'wink' && message.content === "😉") {
        // Check against recently seen winks from the same sender with a longer window
        const recentWinks = seenWinksRef.current.filter(wink => 
          wink.sender === message.sender && 
          Date.now() - wink.timestamp < 60000 // 60-second window for winks
        );
        
        if (recentWinks.length > 0) {
          console.log("Duplicate wink detected by time window");
          return true;
        }
        
        // Add to seen winks
        seenWinksRef.current.push({
          sender: message.sender,
          recipient: message.recipient || '',
          timestamp: Date.now(),
          id: messageId || `generated-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        });
        
        // Clean up old winks (older than 5 minutes)
        seenWinksRef.current = seenWinksRef.current.filter(wink => 
          Date.now() - wink.timestamp < 300000
        );
      }
    }
    
    // Not a duplicate, add to our tracking systems
    if (messageId) {
      seenMessagesRef.current.add(messageId);
      
      // Clean up seen messages set if it gets too large
      if (seenMessagesRef.current.size > 1000) {
        const oldestMessages = Array.from(seenMessagesRef.current).slice(0, 500);
        oldestMessages.forEach(id => seenMessagesRef.current.delete(id));
      }
    }
    
    return false;
  }, []);

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

  // Responsive sidebar handling based on mobile detection
  useEffect(() => {
    // Update sidebar visibility based on mobile state
    if (!isMobile) {
      setShowSidebar(true);
    } else if (activeConversation) {
      setShowSidebar(false);
    }

    // Reset pull distances when screen size changes
    setPullDistance(0);
    setSwipeDirection(null);
  }, [isMobile, activeConversation]);

  // Initialize chat service, fetch conversations, and set up file URL cache
  useEffect(() => {
    if (authLoading || !isAuthenticated || !currentUser?._id || chatInitializedRef.current) {
      if (!authLoading && !isAuthenticated) {
        setComponentLoading(false);
        setError("Please log in to view messages.");
      }
      return;
    }

    // Initialize file URL cache system if it doesn't exist
    if (typeof window !== 'undefined') {
      // Initialize ID-based cache
      if (!window.__fileMessages) {
        console.log("Initializing file URL caches");
        window.__fileMessages = {};

        // Check localStorage for persisted file URLs by ID
        try {
          const persistedUrls = localStorage.getItem('mandarin_file_urls');
          if (persistedUrls) {
            const parsed = JSON.parse(persistedUrls);
            if (parsed && typeof parsed === 'object') {
              window.__fileMessages = parsed;
              console.log(`Restored ${Object.keys(parsed).length} file URLs from localStorage`);
            }
          }
        } catch (e) {
          console.warn("Failed to load persisted file URLs by ID", e);
        }
      }

      // Initialize hash-based cache
      if (!window.__fileMessagesByHash) {
        window.__fileMessagesByHash = {};

        // Check localStorage for persisted file URLs by hash
        try {
          const persistedUrlsByHash = localStorage.getItem('mandarin_file_urls_by_hash');
          if (persistedUrlsByHash) {
            const parsed = JSON.parse(persistedUrlsByHash);
            if (parsed && typeof parsed === 'object') {
              window.__fileMessagesByHash = parsed;
              console.log(`Restored ${Object.keys(parsed).length} file URLs by hash from localStorage`);
            }
          } else {
            // If no hash cache exists yet, build it from the ID-based cache
            if (window.__fileMessages && Object.keys(window.__fileMessages).length > 0) {
              console.log("Building hash-based cache from ID-based cache");

              // Helper function to generate message hash
              const getMessageHash = (msgData) => {
                if (!msgData) return '';
                const fileName = msgData.fileName || '';
                const timeStamp = msgData.timestamp ? new Date(msgData.timestamp).toISOString().substring(0, 16) : '';
                // Use available data to create a semi-unique hash
                return `${fileName}-${timeStamp}`;
              };

              // Build hash-based cache
              Object.entries(window.__fileMessages).forEach(([msgId, msgData]) => {
                if (msgData.url) {
                  // Generate a hash if one doesn't exist
                  const hash = msgData.hash || getMessageHash(msgData);
                  if (hash) {
                    window.__fileMessagesByHash[hash] = {
                      ...msgData,
                      id: msgId
                    };
                  }
                }
              });

              // Persist the new hash-based cache
              try {
                localStorage.setItem('mandarin_file_urls_by_hash', JSON.stringify(window.__fileMessagesByHash));
                console.log(`Created and persisted ${Object.keys(window.__fileMessagesByHash).length} hash-based URL entries`);
              } catch (e) {
                console.warn("Failed to persist hash-based file URLs", e);
              }
            }
          }
        } catch (e) {
          console.warn("Failed to load persisted file URLs by hash", e);
        }
      }

      // Set up periodic cleanup of old entries
      if (!window.__fileUrlCleanupTimeout) {
        window.__fileUrlCleanupTimeout = setTimeout(() => {
          try {
            // Keep only the 300 most recent entries (generous limit)
            if (window.__fileMessages && Object.keys(window.__fileMessages).length > 300) {
              const entries = Object.entries(window.__fileMessages);
              entries.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
              window.__fileMessages = Object.fromEntries(entries.slice(0, 300));

              // Update localStorage
              localStorage.setItem('mandarin_file_urls', JSON.stringify(window.__fileMessages));
              console.log(`Cleaned up file URL cache, kept ${Object.keys(window.__fileMessages).length} entries`);
            }

            // Also clean up hash-based cache
            if (window.__fileMessagesByHash && Object.keys(window.__fileMessagesByHash).length > 300) {
              const entries = Object.entries(window.__fileMessagesByHash);
              entries.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
              window.__fileMessagesByHash = Object.fromEntries(entries.slice(0, 300));

              // Update localStorage
              localStorage.setItem('mandarin_file_urls_by_hash', JSON.stringify(window.__fileMessagesByHash));
            }

            window.__fileUrlCleanupTimeout = null;
          } catch (e) {
            console.warn("Error during file URL cache cleanup", e);
          }
        }, 30000); // Run cleanup after 30 seconds
      }
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
    if (!chatInitializedRef.current || !currentUser?._id || typeof window === 'undefined') return;

    const handleMessageReceived = (newMessage) => {
      log.debug("Message received:", newMessage);
      
      // Skip processing if this is a duplicate message we've seen before
      if (isDuplicateMessage(newMessage)) {
        log.debug("Skipping duplicate message in handleMessageReceived");
        return;
      }
      
      // Additional early check for duplicates using messageRef.current 
      // This helps avoid duplicates during active message exchanges
      if (newMessage._id && messagesRef.current) {
        const existingMsgById = messagesRef.current.find(m => m._id === newMessage._id);
        if (existingMsgById) {
          log.debug("Duplicate message detected in messagesRef by ID:", newMessage._id);
          return;
        }
        
        // Also check for likely duplicates even without matching IDs
        // For example, same content sent multiple times in quick succession
        if (newMessage.sender && newMessage.content) {
          const potentialDuplicates = messagesRef.current.filter(m => 
            m.sender === newMessage.sender && 
            m.content === newMessage.content &&
            m.type === newMessage.type && 
            Math.abs(new Date(m.createdAt).getTime() - new Date(newMessage.createdAt).getTime()) < 3000
          );
          
          if (potentialDuplicates.length > 0) {
            log.debug("Likely duplicate message detected using content+time matching:", newMessage.content);
            return;
          }
        }
      }

      // Enhanced message hash function with more factors for better deduplication
      // This creates a unique signature for messages even if they have different IDs
      const createMessageHash = (msg) => {
        const sender = msg.sender || '';
        const recipient = msg.recipient || '';
        // Use more content for a better hash - up to 200 chars
        const contentHash = (msg.content || '').substring(0, 200);
        // Include more precise timestamp info but still allow for small variations
        const timestamp = msg.createdAt
          ? new Date(msg.createdAt).getTime().toString().substring(0, 11)
          : '';
        const type = msg.type || '';
        // Add metadata fields for files/media
        const metadataFields = [];
        if (msg.metadata) {
          // Add filename and size for files
          if (msg.metadata.fileName) metadataFields.push(`file:${msg.metadata.fileName}`);
          if (msg.metadata.fileSize) metadataFields.push(`size:${msg.metadata.fileSize}`);
          if (msg.metadata.mimeType) metadataFields.push(`mime:${msg.metadata.mimeType}`);
          // For images, include dimensions if available
          if (msg.metadata.width && msg.metadata.height) {
            metadataFields.push(`dim:${msg.metadata.width}x${msg.metadata.height}`);
          }
        }
        const metadataStr = metadataFields.length ? `:${metadataFields.join(':')}` : '';

        // Create main fingerprint hash
        return `${sender}:${recipient}:${type}:${timestamp}:${contentHash}${metadataStr}`;
      };

      // Secondary fuzzy hash that's more tolerant of small changes
      const createFuzzyHash = (msg) => {
        const sender = msg.sender || '';
        const recipient = msg.recipient || '';
        // Use less content for fuzzy matching (just first 50 chars)
        const contentKey = (msg.content || '').substring(0, 50);
        // Use truncated timestamp with 10-second precision
        const roughTimestamp = msg.createdAt
          ? Math.floor(new Date(msg.createdAt).getTime() / 10000).toString()
          : '';
        const type = msg.type || '';

        return `${sender}:${recipient}:${type}:${roughTimestamp}:${contentKey}`;
      };

      // New recovery function: attempts to fix partially corrupted messages
      const recoverMessageData = (msg) => {
        // If message looks complete, return as is
        if (msg._id && msg.sender && msg.recipient && msg.createdAt &&
            ((msg.content && msg.type === 'text') ||
             (msg.type === 'file' && msg.metadata && (msg.metadata.url || msg.metadata.fileUrl)))) {
          return msg;
        }

        // Create recovery hashes if we can
        let messageHash = null;
        let fuzzyHash = null;
        try {
          messageHash = createMessageHash(msg);
          fuzzyHash = createFuzzyHash(msg);
        } catch (e) {
          console.warn("Couldn't create recovery hashes for message:", e);
        }

        // Try to recover file URLs for file messages
        if (msg.type === 'file' && msg._id && typeof window !== 'undefined' && window.__fileMessages) {
          // Try direct message ID lookup
          if (window.__fileMessages[msg._id]?.url) {
            console.log(`Recovered file URL for message ${msg._id} from cache`);
            if (!msg.metadata) msg.metadata = {};
            msg.metadata.url = window.__fileMessages[msg._id].url;
            msg.metadata.fileUrl = window.__fileMessages[msg._id].url;
          }
          // Try hash-based lookups if we have hashes
          else if (messageHash && window.__fileMessages[`hash:${messageHash}`]?.url) {
            console.log(`Recovered file URL for message using precise hash ${messageHash}`);
            if (!msg.metadata) msg.metadata = {};
            msg.metadata.url = window.__fileMessages[`hash:${messageHash}`].url;
            msg.metadata.fileUrl = window.__fileMessages[`hash:${messageHash}`].url;
          }
          else if (fuzzyHash && window.__fileMessages[`fuzzy:${fuzzyHash}`]?.url) {
            console.log(`Recovered file URL for message using fuzzy hash ${fuzzyHash}`);
            if (!msg.metadata) msg.metadata = {};
            msg.metadata.url = window.__fileMessages[`fuzzy:${fuzzyHash}`].url;
            msg.metadata.fileUrl = window.__fileMessages[`fuzzy:${fuzzyHash}`].url;
          }
        }

        // If still missing critical fields, use defaults where possible
        if (!msg.createdAt) msg.createdAt = new Date().toISOString();
        if (!msg.status) msg.status = 'sent';

        return msg;
      };

      // Apply recovery to incoming message
      const recoveredMessage = recoverMessageData(newMessage);

      // If the recovered message has significant improvements, use it instead
      if (recoveredMessage.metadata?.url && !newMessage.metadata?.url ||
          recoveredMessage.metadata?.fileUrl && !newMessage.metadata?.fileUrl) {
        console.log("Using recovered version of message with repaired file URLs");
        newMessage = recoveredMessage;
      }

      if (newMessage.type === 'file' && window.__lastUploadedFile) {
        const lastFile = window.__lastUploadedFile;
        const msgUrl = newMessage.metadata?.url || newMessage.metadata?.fileUrl;
        if (msgUrl && msgUrl === lastFile.url) {
          console.log("Identified message for the file we just uploaded", lastFile.id);
          window.__lastUploadedFile = null;
        }
      }

      if (newMessage.sender !== currentUser._id) {
        // Try to use sound from the public/sounds directory first
        const audio = new Audio('/sounds/call-connect.mp3');
        audio.volume = 0.5;
        audio.play().catch(err => {
          console.log("Couldn't play primary notification sound, trying fallback:", err);
          // Fallback to notification.mp3 if the primary sound fails
          const fallbackAudio = new Audio('/notification.mp3');
          fallbackAudio.volume = 0.5;
          fallbackAudio.play().catch(err2 => console.log("Couldn't play fallback notification sound:", err2));
        });
      }

      const partnerId = newMessage.sender === currentUser._id ? newMessage.recipient : newMessage.sender;

      if (activeConversation && activeConversation.user._id === partnerId) {
        setMessages((prev) => {
          // Generate both exact and fuzzy hashes for the new message
          const newMessageHash = createMessageHash(newMessage);
          const newMessageFuzzyHash = createFuzzyHash(newMessage);

          // Special handling for our own messages (typically from API calls)
          // These are more likely to cause duplication issues from optimistic UI
          if (newMessage.sender === currentUser._id) {
            console.log("Checking own sent message for duplicates", newMessage);
            
            // Look for any matching optimistic updates (tempId-based messages)
            // Find all optimistic messages that match this one
            const optimisticMatches = prev.filter(msg => 
              msg.tempId && 
              msg.sender === currentUser._id && 
              msg.type === newMessage.type &&
              (
                // For text messages, match on content
                (msg.type === 'text' && msg.content === newMessage.content) ||
                // For winks, match on content and type
                (msg.type === 'wink' && msg.content === newMessage.content) ||
                // For files, match on filename if available
                (msg.type === 'file' && msg.metadata?.fileName === newMessage.metadata?.fileName)
              ) &&
              // Only match messages sent in the last 30 seconds (generous window for optimistic updates)
              Math.abs(new Date(msg.createdAt) - new Date(newMessage.createdAt)) < 30000
            );
            
            if (optimisticMatches.length > 0) {
              console.log("Found optimistic message matches:", optimisticMatches.length);
              
              // Replace the first optimistic message with the real one
              // and remove any other duplicates
              const firstMatchIndex = prev.findIndex(msg => msg.tempId === optimisticMatches[0].tempId);
              
              if (firstMatchIndex !== -1) {
                console.log("Replacing optimistic message with server message");
                // Make a new copy of the messages array
                const newMessages = [...prev];
                
                // Replace the first match with the new message
                newMessages[firstMatchIndex] = newMessage;
                
                // Remove any other optimistic messages that matched
                if (optimisticMatches.length > 1) {
                  const otherTempIds = optimisticMatches.slice(1).map(m => m.tempId);
                  return newMessages
                    .filter(msg => !msg.tempId || !otherTempIds.includes(msg.tempId))
                    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                }
                
                return newMessages;
              }
            }
          }

          // Multi-layer duplicate detection with multiple strategies
          let isDuplicate = prev.some(msg => {
            // Strategy 1: Check for exact ID or tempId match (fastest)
            if (msg._id === newMessage._id || (newMessage.tempId && msg.tempId === newMessage.tempId)) {
              console.log("Exact ID match found, skipping duplicate");
              return true;
            }

            // Strategy 2: Precise hash-based detection
            const existingHash = createMessageHash(msg);
            if (existingHash === newMessageHash) {
              console.log("Precise hash match detected, treating as duplicate", {
                existing: msg._id,
                new: newMessage._id,
                hash: newMessageHash
              });
              return true;
            }

            // Strategy 3: Look for messages with identical content but different IDs
            // that arrived within a short time window (30 seconds for winks especially)
            if (msg.sender === newMessage.sender &&
                msg.content === newMessage.content &&
                msg.type === newMessage.type &&
                Math.abs(new Date(msg.createdAt) - new Date(newMessage.createdAt)) < 30000) {
              console.log("Content+time match detected, treating as duplicate", {
                existing: msg._id,
                new: newMessage._id
              });
              return true;
            }

            // Strategy 4: Super strict check for wink messages (emoji based)
            if (msg.type === 'wink' && newMessage.type === 'wink' &&
                msg.sender === newMessage.sender &&
                msg.content === newMessage.content &&
                Math.abs(new Date(msg.createdAt) - new Date(newMessage.createdAt)) < 60000) {
              console.log("Wink duplicate detected (within 60s window)");
              return true;
            }

            return false;
          });

          // Handle file messages specially
          if (newMessage.type === 'file' && (newMessage.metadata?.url || newMessage.metadata?.fileUrl)) {
            console.log("Processing file message:", newMessage._id);

            // First check for exact match by ID or hash to avoid duplicates
            if (prev.some(msg =>
                msg._id === newMessage._id ||
                createMessageHash(msg) === newMessageHash ||
                createFuzzyHash(msg) === newMessageFuzzyHash
            )) {
              console.log("Match found (ID or hash), skipping duplicate file message");
              return prev;
            }

            // Next, check for placeholders that need to be replaced (our own uploads)
            if (newMessage.sender === currentUser._id) {
              // Look for a matching tempId or a file upload placeholder
              const placeholderIndex = prev.findIndex(msg =>
                (msg.tempId && msg.tempId === newMessage.tempId) ||
                (msg.type === 'file' &&
                 msg.metadata?.__localPlaceholder === true &&
                 msg.sender === currentUser._id &&
                 Math.abs(new Date(msg.createdAt) - new Date(newMessage.createdAt)) < 60000 &&
                 (msg.metadata?.fileName === newMessage.metadata?.fileName ||
                  msg.content === newMessage.content))
              );

              if (placeholderIndex >= 0) {
                console.log("Replacing placeholder with real file message:", newMessage._id);

                // Extract the definitive file URL
                const serverUrl = newMessage.metadata.url || newMessage.metadata.fileUrl;

                // Create a proper normalized message with all needed fields
                const updatedMessages = [...prev];
                updatedMessages[placeholderIndex] = {
                  ...newMessage,
                  _id: newMessage._id, // Ensure server ID is used
                  tempId: null, // Clear tempId
                  metadata: {
                    ...newMessage.metadata,
                    fileUrl: serverUrl,
                    url: serverUrl,
                    serverUrl: serverUrl, // Store server URL separately for persistence
                    __localPlaceholder: false, // No longer a placeholder
                    __messageHash: newMessageHash, // Add the hash for future reference
                    __fuzzyHash: newMessageFuzzyHash // Add fuzzy hash for resilience
                  }
                };

                // Revoke any blob URLs from the placeholder if present
                const oldMsg = prev[placeholderIndex];
                if (oldMsg.metadata?.fileUrl?.startsWith('blob:')) {
                  try {
                    URL.revokeObjectURL(oldMsg.metadata.fileUrl);
                    console.log("Revoked blob URL for replaced message");
                  } catch (e) {
                    console.warn("Error revoking URL:", e);
                  }
                }

                // Save the URL to our persistent cache with multiple keys for redundancy
                if (typeof window !== 'undefined' && serverUrl) {
                  if (!window.__fileMessages) window.__fileMessages = {};

                  // Store by message ID
                  if (newMessage._id) {
                    window.__fileMessages[newMessage._id] = {
                      url: serverUrl,
                      timestamp: Date.now(),
                      messageHash: newMessageHash,
                      fuzzyHash: newMessageFuzzyHash
                    };
                  }

                  // Store by both precise and fuzzy hash for maximum recovery options
                  window.__fileMessages[`hash:${newMessageHash}`] = {
                    url: serverUrl,
                    timestamp: Date.now(),
                    messageId: newMessage._id
                  };

                  window.__fileMessages[`fuzzy:${newMessageFuzzyHash}`] = {
                    url: serverUrl,
                    timestamp: Date.now(),
                    messageId: newMessage._id
                  };

                  // Persist to localStorage
                  try {
                    localStorage.setItem('mandarin_file_urls', JSON.stringify(window.__fileMessages));
                    console.log(`Cached file URL for ${newMessage._id} in localStorage with hash backup`);
                  } catch (e) {
                    console.warn("Failed to persist file URL to localStorage", e);
                  }
                }

                console.log("Updated file message with actual server data");
                return updatedMessages;
              }
            }

            // For completeness, handle the case of a totally new file message
            // that wasn't created by the current user
            console.log("New file message received, adding to messages");

            // Make sure it has all required metadata fields
            const normalizedNewMessage = {
              ...newMessage,
              metadata: {
                ...newMessage.metadata,
                fileUrl: newMessage.metadata.url || newMessage.metadata.fileUrl,
                url: newMessage.metadata.url || newMessage.metadata.fileUrl,
                serverUrl: newMessage.metadata.url || newMessage.metadata.fileUrl, // Add serverUrl for persistence
                __processed: true, // Mark as processed to avoid reprocessing
                __messageHash: newMessageHash, // Store the message hash for future reference
                __fuzzyHash: newMessageFuzzyHash // Store fuzzy hash as well
              }
            };

            // Store in our list of known file messages for recovery purposes with hash redundancy
            if (typeof window !== 'undefined') {
              if (!window.__fileMessages) window.__fileMessages = {};

              // Store by message ID
              if (normalizedNewMessage._id) {
                window.__fileMessages[normalizedNewMessage._id] = {
                  url: normalizedNewMessage.metadata.fileUrl,
                  timestamp: Date.now(),
                  messageHash: newMessageHash,
                  fuzzyHash: newMessageFuzzyHash
                };
              }

              // Store by both hash types for recovery
              window.__fileMessages[`hash:${newMessageHash}`] = {
                url: normalizedNewMessage.metadata.fileUrl,
                timestamp: Date.now(),
                messageId: normalizedNewMessage._id
              };

              window.__fileMessages[`fuzzy:${newMessageFuzzyHash}`] = {
                url: normalizedNewMessage.metadata.fileUrl,
                timestamp: Date.now(),
                messageId: normalizedNewMessage._id
              };

              // Cleanup old entries periodically
              if (Object.keys(window.__fileMessages).length > 150) {
                // Keep only the 75 most recent entries
                const entries = Object.entries(window.__fileMessages);
                entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
                window.__fileMessages = Object.fromEntries(entries.slice(0, 75));
              }

              // Persist file URLs to localStorage
              try {
                localStorage.setItem('mandarin_file_urls', JSON.stringify(window.__fileMessages));
                console.log(`Persisted ${Object.keys(window.__fileMessages).length} file URLs to localStorage (with hash redundancy)`);
              } catch (e) {
                console.warn("Failed to persist file URLs to localStorage", e);
              }
            }

            // Add to messages
            return [...prev, normalizedNewMessage].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          }

          if (isDuplicate) {
            console.log("Skipping duplicate message:", newMessage._id);
            return prev;
          }

          if (isMobile && "vibrate" in navigator) {
            navigator.vibrate(50);
          }

          return [...prev, newMessage].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });

        chatService.markConversationRead(activeConversation.user._id);
      } else {
        if (isMobile && "Notification" in window && Notification.permission === "granted") {
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

    const handleIncomingCall = (call) => {
      if (!activeConversation || call.userId !== activeConversation.user._id) return;

      console.debug(`Received incoming call from ${call.userId}`);
      setIncomingCall({
        callId: call.callId,
        callerName: activeConversation.user.nickname,
        callerId: call.userId,
        timestamp: call.timestamp,
      });

      if (isMobile && "vibrate" in navigator) {
        navigator.vibrate([300, 100, 300]);
      }

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
      if (isCallActive) handleEndCall(); // Call local end call logic
    };

    const unsubscribeMessage = chatService.on("messageReceived", handleMessageReceived);
    const unsubscribeTyping = chatService.on("userTyping", handleUserTyping);
    const unsubscribeConnection = chatService.on("connectionChanged", handleConnectionChanged);
    const unsubscribeIncomingCall = socketService.on("incomingCall", handleIncomingCall);
    const unsubscribeCallAccepted = socketService.on("callAccepted", handleCallAccepted);
    const unsubscribeCallDeclined = socketService.on("callDeclined", handleCallDeclined);
    const unsubscribeVideoHangup = socketService.on("videoHangup", handleCallHangup);
    
    // Listen for read receipt updates
    const unsubscribeMessageRead = socketService.on("messageRead", (data) => {
      log.info(`Received messageRead event:`, data);
      
      // Update the message's read status in the state
      setMessages(prevMessages => 
        prevMessages.map(msg => {
          // Check if this is the message that was read
          if (msg._id === data.messageId || 
              (data.messageIds && data.messageIds.includes(msg._id))) {
            log.debug(`Updating read status for message ${msg._id}`);
            return { ...msg, read: true, readAt: data.readAt || new Date().toISOString() };
          }
          return msg;
        })
      );
    });
    
    // Listen for when messages are marked as read by recipient
    const unsubscribeMessagesRead = socketService.on("messagesRead", (data) => {
      log.info(`Received messagesRead event:`, data);
      
      // Update multiple messages' read status
      setMessages(prevMessages => 
        prevMessages.map(msg => {
          // Check if this message is from the current user and was read by the recipient
          if (msg.sender === currentUser?._id && 
              msg.recipient === data.senderId &&
              !msg.read) {
            log.debug(`Marking message ${msg._id} as read by recipient`);
            return { ...msg, read: true, readAt: data.readAt || new Date().toISOString() };
          }
          return msg;
        })
      );
    });

    if (isMobile && "Notification" in window && Notification.permission === "default") {
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
      unsubscribeMessageRead();
      unsubscribeMessagesRead();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [activeConversation, currentUser?._id, isCallActive, isMobile, isDuplicateMessage]);


  // Load conversation based on URL parameter
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

  // Load messages for the active conversation
  useEffect(() => {
    // Prevent unnecessary runs
    if (!activeConversation?.user?._id || !currentUser?._id) {
      setMessages([]);
      return;
    }

    // Skip if we've already loaded this conversation's messages
    if (loadedConversationRef.current === activeConversation.user._id) {
      return;
    }

    console.log(`Loading messages for user: ${activeConversation.user._id} (previous: ${loadedConversationRef.current})`);

    // Set the ref early to prevent potential duplicate calls
    const currentConversationId = activeConversation.user._id;
    loadedConversationRef.current = currentConversationId;

    // Set loading state
    setMessagesLoading(true);

    // Use an IIFE to handle async loading
    (async () => {
      try {
        // Load messages
        await loadMessages(currentConversationId);

        // Only update URL if needed
        if (targetUserIdParam !== currentConversationId) {
          navigate(`/messages/${currentConversationId}`, { replace: true });
        }

        // Mark conversation as read
        markConversationAsRead(currentConversationId);

        // Focus input and update UI
        messageInputRef.current?.focus();
        if (isMobile) setShowSidebar(false);
      } catch (err) {
        console.error("Error in loading messages:", err);
        setError(`Failed to load messages: ${err.message || "Unknown error"}`);
      } finally {
        // Make sure we're still on the same conversation before changing state
        if (loadedConversationRef.current === currentConversationId) {
          setMessagesLoading(false);
        }
      }
    })();

    // Cleanup function
    return () => {
      // If navigation happens before loading completes,
      // we don't want to update state for a conversation we've left
      console.log(`Cleanup for messages loading. Current: ${loadedConversationRef.current}`);
    };
  }, [activeConversation?.user?._id, currentUser?._id]);


  // Auto-scroll to bottom when messages update
  useEffect(() => {
    // Added a small delay to allow layout reflow, especially for images
    const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);
  
  // Create memoized filtered messages to avoid processing on every render
  const filteredMessages = useMemo(() => {
    // Skip processing if no messages
    if (!messages || messages.length === 0) return [];
    
    // Remove any duplicate messages by ID, content, and timestamp
    const uniqueIds = new Set();
    const contentTimeMap = new Map();
    const winkTracker = new Map(); // Special tracking for winks by sender and time
    
    // Track statistics for logging
    let totalMessages = messages.length;
    let duplicateIds = 0;
    let duplicateWinks = 0;
    let duplicateContent = 0;
    
    // First sort messages by date to ensure consistent processing
    const sortedMessages = [...messages].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeA - timeB;
    });
    
    // First pass - create a list of all message IDs to detect duplicates
    const messageIdCounts = new Map();
    sortedMessages.forEach(msg => {
      const id = msg._id || msg.tempId;
      if (id) {
        messageIdCounts.set(id, (messageIdCounts.get(id) || 0) + 1);
      }
    });
    
    // Find duplicate IDs for logging
    const duplicateMessageIds = Array.from(messageIdCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([id, count]) => ({id, count}));
    
    if (duplicateMessageIds.length > 0) {
      log.warn(`Found ${duplicateMessageIds.length} duplicate message IDs in state:`, 
        duplicateMessageIds.map(d => `${d.id} (${d.count}x)`).join(', '));
    }
    
    // Find duplicate winks
    const winkMessages = sortedMessages.filter(m => m.type === 'wink' && m.content === '😉');
    if (winkMessages.length > 1) {
      log.debug(`Found ${winkMessages.length} wink messages in state`);
    }
    
    const result = sortedMessages.filter(msg => {
      // Skip invalid messages
      if (!msg || (!msg.type && !msg.content)) return false;
      
      // First check for ID duplicates
      const id = msg._id || msg.tempId;
      if (id) {
        if (uniqueIds.has(id)) {
          duplicateIds++;
          return false;
        }
        uniqueIds.add(id);
      }
      
      // Special handling for winks - they need stricter deduplication
      if (msg.type === 'wink' && msg.content === '😉') {
        const sender = msg.sender || '';
        // Group winks by sender and 5-minute intervals for stricter filtering
        const winkTimeKey = Math.floor(new Date(msg.createdAt).getTime() / 300000); // 5-minute buckets
        const winkKey = `${sender}:${winkTimeKey}`;
        
        if (winkTracker.has(winkKey)) {
          // We already have a wink from this sender in this time period
          const existing = winkTracker.get(winkKey);
          
          // Keep the message with a valid ID if possible
          if (existing.id && !id) {
            duplicateWinks++;
            return false; // Keep the existing message with ID
          } else if (!existing.id && id) {
            // Replace the existing entry with this one that has an ID
            winkTracker.set(winkKey, {id, index: messages.indexOf(msg)});
            return true;
          } else {
            // If both have IDs or neither has an ID, keep the first one chronologically
            duplicateWinks++;
            return false;
          }
        }
        
        // First wink from this sender in this time period
        winkTracker.set(winkKey, {id, index: messages.indexOf(msg)});
        return true;
      }
      
      // General duplicate check for all message types by content and timing
      const sender = msg.sender || '';
      const recipient = msg.recipient || '';
      const content = msg.content || '';
      const type = msg.type || '';
      const timestamp = new Date(msg.createdAt).getTime();
      
      // For text messages, use smaller time window (1 second precision)
      // For other types, use larger window (5 second precision)
      const timeWindow = type === 'text' ? 1000 : 5000;
      const key = `${sender}:${recipient}:${type}:${content.substring(0, 30)}:${Math.floor(timestamp/timeWindow)}`;
      
      const existing = contentTimeMap.get(key);
      if (existing) {
        // If we have a message with ID and a duplicate without ID, keep the one with ID
        if (!existing.id && id) {
          contentTimeMap.set(key, {id, index: messages.indexOf(msg)});
          return true;
        }
        // If both have IDs or both don't have IDs, keep the first one we saw
        duplicateContent++;
        return false;
      }
      
      // First time seeing this message signature
      contentTimeMap.set(key, {id, index: messages.indexOf(msg)});
      return true;
    });
    
    // Log deduplication results if any duplicates were found
    const totalDuplicates = duplicateIds + duplicateWinks + duplicateContent;
    if (totalDuplicates > 0) {
      log.info(`Message deduplication: ${result.length} unique messages from ${totalMessages} total ` +
        `(removed ${duplicateIds} duplicate IDs, ${duplicateWinks} duplicate winks, ${duplicateContent} duplicate content)`);
    }
    
    return result;
  }, [messages]);

  // Ensure active conversation has current blocked status
  useEffect(() => {
    if (activeConversation?.user?._id) {
      // Update the active conversation's blocked status whenever blocked users change
      const isBlocked = isUserBlocked(activeConversation.user._id);

      if (isBlocked !== activeConversation.user.isBlocked) {
        setActiveConversation(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            user: {
              ...prev.user,
              isBlocked: isBlocked
            }
          };
        });
      }
    }
  }, [blockedUsers, isUserBlocked, activeConversation?.user?._id]); // Only depend on the user ID, not the whole object

  // --- Touch Gesture Handlers ---

  const handleTouchStart = useCallback((e) => {
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
  }, []);

  const handleTouchMove = useCallback((e) => {
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
  }, [isRefreshing, touchStartY, touchStartX, showSidebar, SWIPE_THRESHOLD]);

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
    if (!currentUser?._id) return;
    // Consider adding a loading state specific to conversation fetching if needed
    try {
      // Refresh blocked users list
      await fetchBlockedUsers();

      // Get conversations
      const conversationsData = await chatService.getConversations();
      const filteredConversations = conversationsData.filter(
        (conversation) => conversation?.user?._id && conversation.user._id !== currentUser._id // Add null check for user
      );

      // Mark blocked users
      const markedConversations = markBlockedUsers(filteredConversations);
      setConversations(markedConversations);

      // Also update the active conversation if it exists
      if (activeConversation && activeConversation.user && activeConversation.user._id) {
        const updatedActiveConversation = markedConversations.find(c => c.user._id === activeConversation.user._id);
        if (updatedActiveConversation) {
          setActiveConversation(updatedActiveConversation);
        }
      }
      if (
        targetUserIdParam &&
        !filteredConversations.find((c) => c.user._id === targetUserIdParam) &&
        targetUserIdParam !== currentUser._id
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
  }, [currentUser?._id, targetUserIdParam]);

  const loadUserDetails = useCallback(async (idToLoad) => {
    if (!idToLoad || idToLoad === currentUser?._id) {
      console.warn("Attempted to load own user details or null ID");
      if (idToLoad === currentUser?._id) navigate("/messages", { replace: true }); // Redirect if trying to load self
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

      // Use apiService for API calls
      const response = await apiService.get(`/users/${idToLoad}`);

      if (!response.success) {
        log.warn(`API error fetching user ${idToLoad}.`);
        let errorMsg = `Could not find or load user details.`;
        if (response.status === 404) errorMsg = `User not found (${idToLoad}).`;
        toast.error(errorMsg);
        navigate("/messages", { replace: true });
        setError(errorMsg); // Set error state
        return; // Stop execution
      }

      // apiService already returns the parsed JSON data
      const userDetail = response.data?.user || response.user || response.data || response;

      if (userDetail?._id) {
        const newConvo = {
          user: {
            _id: userDetail._id,
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
           const existingIndex = prev.findIndex((c) => c.user._id === idToLoad);
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
  }, [currentUser?._id, navigate]);


 const loadMessages = useCallback(async (partnerUserId) => {
   if (!currentUser?._id || !partnerUserId || partnerUserId === currentUser._id) {
     console.warn("Attempted to load messages with self or invalid partner ID");
     setMessages([]);
     return;
   }

   // Validate user ID
   const isValidId = /^[0-9a-fA-F]{24}$/.test(partnerUserId);
   if (!isValidId) {
     console.error(`Invalid partner user ID format: ${partnerUserId}`);
     toast.error("Cannot load messages: Invalid user ID format");
     setMessages([]);
     setError("Cannot load messages for this user (Invalid ID).");
     return;
   }

   // Store the ID we're loading for so we can check it hasn't changed
   const loadingForUserId = partnerUserId;

   try {
     console.log(`Fetching messages for ${partnerUserId}`);
     const messagesData = await chatService.getMessages(partnerUserId);
     
     // Log some basic stats about the loaded messages
     const winkCount = messagesData.filter(msg => msg.type === 'wink' && msg.content === '😉').length;
     console.log(`Loaded ${messagesData.length} messages for ${partnerUserId}, including ${winkCount} winks`);

     // Check we're still loading for the same user before updating state
     if (loadedConversationRef.current !== loadingForUserId) {
       console.log(`User changed during message fetch. Abandoning results for ${loadingForUserId}`);
       return;
     }

     // Ensure messages are sorted correctly upon fetch
     console.log(`Loaded ${messagesData.length} messages for ${partnerUserId}`);

     // Process messages to ensure file URLs are correctly set
     const processedMessages = messagesData.map(msg => {
       if (msg.type === 'file' && msg.metadata) {
         // Check if we have this file URL cached
         let cachedUrl = null;

         if (typeof window !== 'undefined' && window.__fileMessages && msg._id && window.__fileMessages[msg._id]) {
           cachedUrl = window.__fileMessages[msg._id].url;
           console.log(`Found cached URL for file message ${msg._id}`);
         }

         // Get the best URL from available sources
         const bestUrl = cachedUrl || msg.metadata.serverUrl || msg.metadata.url || msg.metadata.fileUrl;

         // If we have a good URL but no cache entry, add it to our cache
         if (bestUrl && !cachedUrl && typeof window !== 'undefined' && msg._id) {
           if (!window.__fileMessages) window.__fileMessages = {};
           window.__fileMessages[msg._id] = {
             url: bestUrl,
             timestamp: Date.now()
           };
           console.log(`Added URL for file message ${msg._id} to cache`);

           // Also persist to localStorage
           try {
             localStorage.setItem('mandarin_file_urls', JSON.stringify(window.__fileMessages));
           } catch (e) {
             console.warn("Failed to persist file URLs to localStorage", e);
           }
         }

         // Return a normalized message with consistent URL fields
         return {
           ...msg,
           metadata: {
             ...msg.metadata,
             // Set all URL fields to the best URL we found
             fileUrl: bestUrl,
             url: bestUrl,
             serverUrl: bestUrl,
             __processed: true // Mark as processed to avoid duplicate processing
           }
         };
       }
       return msg;
     });

     // Process winks to deduplicate them before setting messages
     // First, sort messages by date to ensure consistent processing
     const sortedMessages = processedMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
     
     // Deduplicate winks that are close in time (common when receiving from server)
     const deduplicatedMessages = [];
     const seenWinkTracker = new Map(); // Track winks by sender and approximate time
     const seenGeneralMessages = new Map(); // Track all messages by content+sender+time
     
     for (let i = 0; i < sortedMessages.length; i++) {
       const currentMsg = sortedMessages[i];
       
       // Skip malformed messages
       if (!currentMsg.sender || !currentMsg.createdAt) {
         continue;
       }
       
       // Special handling for winks - more aggressive filtering
       if (currentMsg.type === 'wink' && currentMsg.content === '😉') {
         const sender = currentMsg.sender;
         // Create wider time window - group winks by 5-minute intervals
         const timeKey = Math.floor(new Date(currentMsg.createdAt).getTime() / 300000); // 5-minute buckets
         const winkKey = `${sender}:${timeKey}`;
         
         // If we've seen a wink from this sender in this time window, skip this one
         if (seenWinkTracker.has(winkKey)) {
           log.debug(`Skipping duplicate wink from ${sender} during initial load (5min window ${timeKey})`);
           continue;
         }
         
         // Handle the special case where a user sends multiple winks in succession
         // To fix, check if the same sender has sent another wink within a minute before/after
         const msgTime = new Date(currentMsg.createdAt).getTime();
         let isDuplicate = false;
         
         for (const [existingKey, existingId] of seenWinkTracker.entries()) {
           const [existingSender, existingTimeKey] = existingKey.split(':');
           
           // Only check winks from same sender
           if (existingSender === sender) {
             // Calculate actual time difference between winks
             const existingMsg = sortedMessages.find(m => m._id === existingId);
             if (existingMsg) {
               const existingTime = new Date(existingMsg.createdAt).getTime();
               const timeDiff = Math.abs(msgTime - existingTime);
               
               // If winks are within 60 seconds of each other, consider them duplicates
               if (timeDiff < 60000) {
                 log.debug(`Found winks from ${sender} separated by only ${timeDiff}ms - treating as duplicate`);
                 isDuplicate = true;
                 break;
               }
             }
           }
         }
         
         if (isDuplicate) {
           continue;
         }
         
         // Mark this wink as seen
         seenWinkTracker.set(winkKey, currentMsg._id);
       } 
       // General duplicate check for other message types
       else if (currentMsg.type && currentMsg.content) {
         // Create a signature for this message
         const sender = currentMsg.sender;
         const content = currentMsg.content;
         const type = currentMsg.type;
         // Use 1-minute time buckets for other message types
         const timeKey = Math.floor(new Date(currentMsg.createdAt).getTime() / 60000);
         const msgKey = `${sender}:${type}:${timeKey}:${content.substring(0, 20)}`;
         
         // Check if we've seen this message already
         if (seenGeneralMessages.has(msgKey)) {
           log.debug(`Skipping duplicate ${type} message from ${sender}`);
           continue;
         }
         
         // Mark this message as seen
         seenGeneralMessages.set(msgKey, currentMsg._id);
       }
       
       // Add message to deduplicated list
       deduplicatedMessages.push(currentMsg);
     }
     
     // Update our seen message ID tracking to prevent them from being received again
     deduplicatedMessages.forEach(msg => {
       if (msg._id) {
         seenMessagesRef.current.add(msg._id);
         
         // For winks, also add to wink tracker for runtime deduplication
         if (msg.type === 'wink' && msg.content === '😉') {
           seenWinksRef.current.push({
             sender: msg.sender,
             recipient: msg.recipient || '',
             timestamp: new Date(msg.createdAt).getTime(),
             id: msg._id
           });
         }
       }
     });
     
     // Clean up old winks in the runtime tracker
     seenWinksRef.current = seenWinksRef.current.filter(wink => 
       Date.now() - wink.timestamp < 3600000 // Keep only winks from the last hour
     );
     
     log.info(`Loaded ${sortedMessages.length} messages, deduplicated to ${deduplicatedMessages.length} (removed ${sortedMessages.length - deduplicatedMessages.length} duplicates)`);
     
     // Set messages with processed and deduplicated messages
     setMessages(deduplicatedMessages);
     setError(null); // Clear error on successful load
   } catch (err) {
     // Check we're still on the same conversation before updating error state
     if (loadedConversationRef.current !== loadingForUserId) {
       return;
     }

     console.error("Error fetching messages:", err);
     const errorMsg = `Failed to load messages. ${err.message || "Server error"}`;
     toast.error(errorMsg);
     setError(errorMsg); // Set error state
     setMessages([]); // Clear messages on error
   }
 }, [currentUser?._id]);


  const handleSendMessage = async () => {
    const trimmedMessage = messageInput.trim();
    if (!trimmedMessage || !activeConversation || !currentUser?._id) return;
    if (activeConversation.user._id === currentUser._id) {
      toast.error("Cannot send messages to yourself");
      return;
    }
    if (activeConversation.user.isBlocked || isUserBlocked(activeConversation.user._id)) {
      toast.error("Cannot send messages to a blocked user");
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
    
    // Add throttling and deduplication for identical text messages in rapid succession
    const now = Date.now();
    const messageKey = `text:${partnerId}:${trimmedMessage}`;
    const lastSent = lastMessageSentRef.current[messageKey];
    
    if (lastSent && now - lastSent.timestamp < 5000) {
      toast.info("Please wait a moment before sending the same message again");
      return;
    }
    
    // Track this message 
    lastMessageSentRef.current[messageKey] = {
      type: 'text',
      content: trimmedMessage,
      recipient: partnerId,
      timestamp: now
    };
    
    // Clean up old entries
    const oldEntries = Object.keys(lastMessageSentRef.current)
      .filter(key => now - lastMessageSentRef.current[key].timestamp > 60000);
    oldEntries.forEach(key => delete lastMessageSentRef.current[key]);

    // Optimistic UI update (optional but improves perceived performance)
     const tempId = `temp-${Date.now()}`;
     const optimisticMessage = {
       _id: tempId, // Temporary ID
       tempId: tempId,
       sender: currentUser._id,
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


    if (isMobile && "vibrate" in navigator) {
      navigator.vibrate(20);
    }

    try {
      const sentMessage = await chatService.sendMessage(partnerId, trimmedMessage);
      
      // Check if we've already received the real message from the server
      const existingServerMessage = messagesRef.current.find(
        msg => msg._id && !msg.tempId && 
        msg.type === 'text' && 
        msg.sender === currentUser._id && 
        msg.recipient === partnerId && 
        msg.content === trimmedMessage &&
        Math.abs(new Date(msg.createdAt) - new Date(optimisticMessage.createdAt)) < 5000
      );
      
      if (existingServerMessage) {
        // If we already have a server message that matches this message, remove the optimistic one
        console.log("Server text message already exists, removing optimistic message");
        setMessages((prev) => 
          prev.filter(msg => msg.tempId !== tempId)
        );
      } else {
        // Replace optimistic message with actual server response
        setMessages((prev) => {
          // Filter out the optimistic message first
          const filteredMessages = prev.filter(msg => msg.tempId !== tempId);
          // Add the server-confirmed message
          return [...filteredMessages, sentMessage].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });
      }
      
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
   if (!activeConversation || !currentUser?._id || isSending) return;
   if (activeConversation.user._id === currentUser._id) {
     toast.error("Cannot send winks to yourself");
     return;
   }
   if (activeConversation.user.isBlocked || isUserBlocked(activeConversation.user._id)) {
     toast.error("Cannot send winks to a blocked user");
     return;
   }
   const partnerId = activeConversation.user._id;
   if (!/^[0-9a-fA-F]{24}$/.test(partnerId)) {
     toast.error("Cannot send wink: Invalid recipient ID format.");
     console.error("Attempted to send wink to invalid ID format:", partnerId);
     return;
   }
   
   // Add throttling to prevent multiple winks in quick succession
   const now = Date.now();
   const timeSinceLastWink = now - lastWinkSentRef.current;
   if (timeSinceLastWink < 5000) { // 5 second throttle
     toast.info("Please wait a moment before sending another wink");
     return;
   }
   
   // Update the last wink timestamp
   lastWinkSentRef.current = now;
   
   // Track this message in our global tracking
   const messageKey = `wink:${partnerId}:${now}`;
   lastMessageSentRef.current[messageKey] = {
     type: 'wink',
     content: "😉",
     recipient: partnerId,
     timestamp: now
   };
   
   // Cleanup old entries
   const oldEntries = Object.keys(lastMessageSentRef.current)
     .filter(key => now - lastMessageSentRef.current[key].timestamp > 60000);
   oldEntries.forEach(key => delete lastMessageSentRef.current[key]);
   
   setIsSending(true);

   // Optimistic UI update for wink
   const tempId = `temp-wink-${Date.now()}`;
   const optimisticWink = {
     _id: tempId,
     tempId: tempId,
     sender: currentUser._id,
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

   if (isMobile && "vibrate" in navigator) {
     navigator.vibrate([20, 30, 20]);
   }

   try {
     const sentMessage = await chatService.sendMessage(partnerId, "😉", "wink");
     
     // Check if we've already received the real message from the server
     const existingServerMessage = messagesRef.current.find(
       msg => msg._id && !msg.tempId && 
       msg.type === 'wink' && 
       msg.sender === currentUser._id && 
       msg.recipient === partnerId && 
       Math.abs(new Date(msg.createdAt) - new Date(optimisticWink.createdAt)) < 5000
     );
     
     if (existingServerMessage) {
       // If we already have a server message that matches this wink, remove the optimistic one
       console.log("Server wink message already exists, removing optimistic message");
       setMessages((prev) => 
         prev.filter(msg => msg.tempId !== tempId)
       );
     } else {
       // Replace optimistic wink with actual server response
       setMessages((prev) => {
         // Filter out the optimistic message first
         const filteredMessages = prev.filter(msg => msg.tempId !== tempId);
         // Add the server-confirmed message
         return [...filteredMessages, sentMessage].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
       });
     }
     
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


  const handleFileAttachment = useCallback(() => {
    if (currentUser?.accountTier === "FREE") {
      return toast.error("Free accounts cannot send files. Upgrade to send files.");
    }

    // Trigger file selection in the FileAttachmentHandler component
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.click();
    }
  }, [currentUser?.accountTier]);

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

    if (isMobile && "vibrate" in navigator) {
      navigator.vibrate(30);
    }
  };


  const handleRemoveAttachment = useCallback(() => {
    setAttachment(null);
    setUploadProgress(0);
    setIsUploading(false); // Ensure uploading state is reset
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Clear the actual input element's value
    }
  }, []);

  const handleSendAttachment = async () => {
    if (!attachment || !activeConversation?.user?._id || isUploading) return;
    if (activeConversation.user._id === currentUser._id) {
      toast.error("Cannot send files to yourself");
      return;
    }
    if (activeConversation.user.isBlocked || isUserBlocked(activeConversation.user._id)) {
      toast.error("Cannot send files to a blocked user");
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
    setUploadProgress(10);

    if (isMobile && "vibrate" in navigator) {
      navigator.vibrate(40);
    }

     // Optimistic UI for file upload
     const tempId = `temp-file-${Date.now()}`;
     const optimisticFileMessage = {
       _id: tempId,
       tempId: tempId,
       sender: currentUser._id,
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

      // Store the uploaded file information in a global so we can reference it later
      // This helps with tracking our uploads across page navigations
      if (typeof window !== 'undefined') {
        window.__lastUploadedFile = {
          id: tempId,
          url: fileData.url,
          fileName: attachment.name,
          timestamp: Date.now()
        };

        // Clean up old references after a while
        setTimeout(() => {
          if (window.__lastUploadedFile && window.__lastUploadedFile.id === tempId) {
            window.__lastUploadedFile = null;
          }
        }, 60000); // 1 minute cleanup

        // Also store in our persistent cache
        if (!window.__fileMessages) window.__fileMessages = {};
        window.__fileMessages[tempId] = {
          url: fileData.url,
          timestamp: Date.now()
        };

        // And persist to localStorage
        try {
          localStorage.setItem('mandarin_file_urls', JSON.stringify(window.__fileMessages));
          console.log("Persisted uploaded file URL to localStorage");
        } catch (e) {
          console.warn("Failed to persist file URL to localStorage", e);
        }
      }

      // When message is received through socket, check if there's a server response
      // First, check if we already received the real message from the server
      const existingServerMessage = messagesRef.current?.find(
        msg => msg._id && !msg.tempId && 
        msg.type === 'file' && 
        msg.sender === currentUser._id && 
        msg.recipient === partnerId && 
        Math.abs(new Date(msg.createdAt) - new Date(optimisticFileMessage.createdAt)) < 5000
      );

      if (existingServerMessage) {
        // If we already have a server message that matches this upload, remove the optimistic one
        console.log("Server message already exists, replacing optimistic message");
        setMessages((prev) => 
          prev.filter(msg => msg.tempId !== tempId)
        );
      } else {
        // Update the optimistic message with the real URL
        // Keep both the local URL and real URL for a smooth transition
        setMessages((prev) => {
          // Filter out the optimistic message first to avoid duplicates
          const filteredMessages = prev.filter(msg => 
            // Keep messages that aren't temporary or have a different tempId
            !msg.tempId || msg.tempId !== tempId
          );
          
          // Add back the updated optimistic message with real URL
          const updatedMessage = {
            ...optimisticFileMessage,
            metadata: {
              ...optimisticFileMessage.metadata,
              fileUrl: fileData.url, // Update with real URL
              url: fileData.url,
              __localPlaceholder: false, // Mark as no longer placeholder
              serverUrl: fileData.url, // Add a separate serverUrl field to track the permanent URL
            },
          };
          
          return [...filteredMessages, updatedMessage].sort((a, b) => 
            new Date(a.createdAt) - new Date(b.createdAt)
          );
        });
      }

      // Update the conversation list with the new message including the file URL
      updateConversationList({
        ...optimisticFileMessage,
        metadata: {
          ...optimisticFileMessage.metadata,
          fileUrl: fileData.url,
          url: fileData.url,
          serverUrl: fileData.url,
          __localPlaceholder: false
        }
      });

      // Keep the blob URL alive until we're sure the message has been rendered with the real URL
      // We'll handle cleanup when the message is confirmed from the server


      toast.success("File uploaded successfully. Sending message..."); // Updated toast message

      // Reset state *after* potential message sending logic (if needed) or socket confirmation
      setAttachment(null);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";


      // Success vibration pattern
      if (isMobile && "vibrate" in navigator) {
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
      if (isMobile && "vibrate" in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    } finally {
      setIsUploading(false); // Ensure this is always reset
      // Don't reset attachment/progress here, do it on success or explicit removal
    }
  };


  const handleEmojiClick = useCallback((emoji) => {
    setMessageInput((prev) => prev + emoji);
    setShowEmojis(false);
    if (messageInputRef.current) {
      messageInputRef.current.focus();
    }
    if (isMobile && "vibrate" in navigator) {
      navigator.vibrate(20);
    }
  }, [isMobile]);

  const handleVideoCall = async () => {
    if (!activeConversation || !currentUser?._id) return;
    // Check socket connection using the service's method
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
       // Optionally navigate to subscription page
       // navigate('/subscription');
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
      setIsCallActive(true); // Set call active state *before* initiating

      if (isMobile && "vibrate" in navigator) {
        navigator.vibrate([50, 100, 50]);
      }

      // Emit the call initiation request via socket service
      // The promise resolves/rejects based on socket ack or internal logic
      await socketService.initiateVideoCall(partnerId);

      // System message confirms *successful initiation attempt*
      const systemMessage = {
        _id: generateUniqueId(),
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
        _id: generateUniqueId(),
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
      const partnerId = activeConversation.user._id;
      // Only emit hangup if a call was actually active *and* we have a valid partner
      if (isCallActive && /^[0-9a-fA-F]{24}$/.test(partnerId)) {
        console.log("Emitting videoHangup to:", partnerId);
        socketService.emit("videoHangup", { recipientId: partnerId });
      } else if (isCallActive) {
        console.warn("Cannot emit hangup for invalid partner ID:", partnerId);
      }

       // Add system message regardless of whether hangup was emitted (e.g., if user cancels before connection)
        const systemMessage = {
          _id: generateUniqueId(),
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
    if (isMobile && "vibrate" in navigator) {
      navigator.vibrate(100);
    }
  }, [activeConversation, isCallActive, isMobile]); // Dependencies for useCallback


   const updateConversationList = useCallback((newMessage) => {
     if (!currentUser?._id || !newMessage) return;

     // Determine partner ID, handle potential missing fields gracefully
     const partnerId = newMessage.sender === currentUser._id
       ? newMessage.recipient
       : newMessage.sender;

     // Ensure partnerId is valid before proceeding
     if (!partnerId || partnerId === currentUser._id || !/^[0-9a-fA-F]{24}$/.test(partnerId)) {
       console.warn("Skipping conversation list update due to invalid partner ID:", partnerId, "Message:", newMessage);
       return;
     }

     setConversations((prev) => {
       // Early return if no changes needed
       const convoIndex = prev.findIndex((c) => c.user._id === partnerId);
       
       if (convoIndex !== -1) {
         // Check if we actually need to update
         const existingConvo = prev[convoIndex];
         if (existingConvo.lastMessage?._id === newMessage._id && 
             existingConvo.lastMessage?.createdAt === newMessage.createdAt) {
           // No change needed
           return prev;
         }
       }
       
       // Only create new array if we're actually changing something
       let updatedConvo;

       if (convoIndex !== -1) {
         // Conversation exists, update it
         updatedConvo = {
           ...prev[convoIndex],
           lastMessage: newMessage, // Update last message
           // Update unread count logic
           unreadCount: (newMessage.sender !== currentUser._id && (!activeConversation || activeConversation.user._id !== partnerId))
             ? (prev[convoIndex].unreadCount || 0) + 1
             : (activeConversation && activeConversation.user._id === partnerId)
               ? 0 // Reset if currently active
               : prev[convoIndex].unreadCount // Keep existing count if sending message in active chat
         };
         // Move updated conversation to the top
         return [updatedConvo, ...prev.filter((c) => c.user._id !== partnerId)];
       } else {
         // New conversation
         // Try to get sender details from the message, fallback gracefully
         const senderNickname = newMessage.senderName || `User ${partnerId.substring(0, 6)}`;
         const senderPhoto = newMessage.senderPhoto || null; // Use photo from message if available

         updatedConvo = {
           user: {
             _id: partnerId,
             nickname: senderNickname,
             photo: senderPhoto,
             isOnline: false, // Assume offline initially, update later if possible
             accountTier: "FREE", // Assume FREE initially
           },
           lastMessage: newMessage,
           unreadCount: newMessage.sender !== currentUser._id ? 1 : 0,
         };
         // Add new conversation to the top
         return [updatedConvo, ...prev];
       }
     });
   }, [currentUser?._id, activeConversation]); // Dependencies for useCallback


  const markConversationAsRead = useCallback((partnerUserId) => {
    if (!partnerUserId || partnerUserId === currentUser?._id) return;
    if (!/^[0-9a-fA-F]{24}$/.test(partnerUserId)) {
      console.warn("Attempted to mark conversation read for invalid ID format:", partnerUserId);
      return;
    }

    // Update state optimistically first
    let marked = false;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.user._id === partnerUserId && c.unreadCount > 0) {
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
  }, [currentUser?._id]); // Dependency for useCallback


  const sendTypingIndicator = useCallback(() => {
     // Check connection status from the service
     if (activeConversation && chatService.isConnected && chatService.isConnected() && currentUser?._id) {
       const partnerId = activeConversation.user._id;
       if (/^[0-9a-fA-F]{24}$/.test(partnerId)) {
         chatService.sendTypingIndicator(partnerId);
       } else {
         console.warn("Cannot send typing indicator for invalid partner ID:", partnerId);
       }
     }
   }, [activeConversation, currentUser?._id]); // Dependencies for useCallback


  const handleMessageInputChange = (e) => {
    const value = e.target.value;
    setMessageInput(value);

    // Send typing indicator only if input is not empty and partner ID is valid
    if (value.trim() && activeConversation?.user?._id) {
      if (/^[0-9a-fA-F]{24}$/.test(activeConversation.user._id)) {
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
    // Validate the conversation and check if it's already selected
    if (!conversation?.user?._id) {
      console.warn("Attempted to select invalid conversation", conversation);
      return;
    }

    // Skip if it's the same conversation
    if (activeConversation && activeConversation.user._id === conversation.user._id) {
      console.log("Already on this conversation, skipping");
      return;
    }

    // Can't message yourself
    if (conversation.user._id === currentUser?._id) {
      toast.warning("You cannot message yourself");
      return;
    }

    // Validate ID format
    if (!/^[0-9a-fA-F]{24}$/.test(conversation.user._id)) {
      toast.error("Cannot select conversation: Invalid user ID.");
      console.error("Attempted to select conversation with invalid ID:", conversation.user._id);
      return;
    }

    console.log(`Selecting conversation with user: ${conversation.user.nickname} (${conversation.user._id})`);

    // Reset UI state immediately
    setMessageInput(""); // Clear message input
    setAttachment(null); // Clear any attachment preview
    setTypingUser(null); // Clear typing indicator
    setError(null); // Clear any previous errors

    // Clear messages first to avoid showing previous conversation's messages
    setMessages([]);

    // Reset loadedConversationRef to force message loading in the messages effect
    // NOTE: Only set this to null for a moment - the effect will set it to the new ID
    loadedConversationRef.current = null;

    // Update active conversation state
    setActiveConversation(conversation);

    // Navigate to the new conversation URL - use replace to avoid cluttering history
    navigate(`/messages/${conversation.user._id}`, { replace: true });

    // Update UI for mobile
    if (isMobile) {
      setShowSidebar(false);
      if ("vibrate" in navigator) {
        navigator.vibrate(20);
      }
    }
  }, [activeConversation, currentUser?._id, isMobile, navigate]);


  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
    if (isMobile && "vibrate" in navigator) {
      navigator.vibrate(15);
    }
  };

  // Function to refresh conversations list
  const refreshConversations = useCallback(async () => {
    try {
      log.debug("Refreshing conversations list");
      setComponentLoading(true);
      const refreshedConversations = await chatService.getConversations();

      if (refreshedConversations && Array.isArray(refreshedConversations)) {
        setConversations(refreshedConversations);
        log.debug(`Loaded ${refreshedConversations.length} conversations`);
      }

      if (isMobile && "vibrate" in navigator) {
        navigator.vibrate([15, 30, 15]); // Vibration pattern for refresh success
      }
    } catch (err) {
      log.error("Error refreshing conversations:", err);
      toast.error("Failed to refresh conversations");

      if (isMobile && "vibrate" in navigator) {
        navigator.vibrate([100, 50, 100]); // Vibration pattern for error
      }
    } finally {
      setComponentLoading(false);
      setIsRefreshing(false);
    }
  }, [chatService, isMobile]);

  // Memoize grouped messages to avoid re-computation on every render
  const groupedMessages = useMemo(() => groupMessagesByDate(messages), [messages]);

  // Handle message scrolling - can be used for infinite scrolling or other scroll behaviors
  const handleMessageScroll = useCallback((e) => {
    // Placeholder for future scroll handling
    // For example, loading more messages when scrolling up
    const { scrollTop, scrollHeight, clientHeight } = e.target;

    // Near the top - could load older messages
    if (scrollTop < 100) {
      // Placeholder for loading older messages
      // loadOlderMessages();
    }
  }, []);

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
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchMove={isMobile ? handleTouchMove : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
      >
        {/* Sidebar with Conversation List */}
        <div className={classNames(styles.sidebar, showSidebar ? styles.show : styles.hide)}>
          <ConversationList
            conversations={conversations}
            activeConversation={activeConversation}
            onConversationSelect={selectConversation}
            onNewConversation={() => navigate('/dashboard')}
            currentUserId={currentUser?._id}
            onRefresh={refreshConversations}
            conversationsLoading={componentLoading && conversations.length === 0}
            conversationsListRef={conversationsListRef}
          />
        </div>

        {/* Chat Area */}
        <ChatArea
          className={(!showSidebar && isMobile) ? styles.fullWidth : ''}
          isUserBlocked={activeConversation?.user?.isBlocked || (activeConversation?.user?._id && isUserBlocked(activeConversation.user._id))}
        >
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <ChatHeader
                conversation={activeConversation}
                isMobile={isMobile}
                onBackClick={toggleSidebar}
                onStartVideoCall={handleVideoCall}
                onProfileClick={() => {
                  // Show user profile modal
                  setProfileUserId(activeConversation.user._id);
                  setIsProfileModalOpen(true);
                }}
                onBlockUser={(userId) => {
                  // Check if the user is already blocked
                  const isBlocked = activeConversation?.user?.isBlocked;

                  if (isBlocked) {
                    // Handle unblocking
                    if (window.confirm("Are you sure you want to unblock this user? They will be able to send you messages again.")) {
                      unblockUser(userId).then(() => {
                        // Also update our local storage to reflect the unblocked status
                        try {
                          const storedBlockedUsers = localStorage.getItem('blockedUsers');
                          if (storedBlockedUsers) {
                            const blockList = JSON.parse(storedBlockedUsers);
                            const filteredList = blockList.filter(blockedId => blockedId !== userId);
                            localStorage.setItem('blockedUsers', JSON.stringify(filteredList));
                          }
                        } catch (e) {
                          console.warn("Failed to update blocked users in localStorage:", e);
                        }

                        // Refresh blocked users list
                        fetchBlockedUsers().then(() => {
                          // Refresh conversations to update UI
                          fetchConversations();
                        });
                      });

                      toast.success("User unblocked successfully");

                      // Add a system message about unblocking
                      const systemMessage = {
                        _id: generateUniqueId(),
                        content: "You have unblocked this user. You will now receive messages from them.",
                        type: "system",
                        createdAt: new Date().toISOString(),
                        sender: "system",
                        systemType: "unblock"
                      };

                      setMessages(prev => [...prev, systemMessage]);
                    }
                  } else {
                    // Handle blocking
                    if (window.confirm("Are you sure you want to block this user? You will no longer receive messages from them.")) {
                      blockUser(userId).then(() => {
                        // Also update our local storage to reflect the blocked status
                        try {
                          const storedBlockedUsers = localStorage.getItem('blockedUsers');
                          let blockList = [];

                          if (storedBlockedUsers) {
                            blockList = JSON.parse(storedBlockedUsers);
                          }

                          // Only add if it's not already in the list
                          if (!blockList.includes(userId)) {
                            blockList.push(userId);
                            localStorage.setItem('blockedUsers', JSON.stringify(blockList));
                          }
                        } catch (e) {
                          console.warn("Failed to update blocked users in localStorage:", e);
                        }

                        // Refresh blocked users list
                        fetchBlockedUsers().then(() => {
                          // Refresh conversations to update UI
                          fetchConversations();
                        });
                      });

                      toast.success("User blocked successfully");

                      // Add a system message about blocking
                      const systemMessage = {
                        _id: generateUniqueId(),
                        content: "You have blocked this user. You will no longer receive messages from them.",
                        type: "system",
                        createdAt: new Date().toISOString(),
                        sender: "system",
                        systemType: "block"
                      };

                      setMessages(prev => [...prev, systemMessage]);
                    }
                  }
                }}
                onReportUser={(userId) => {
                  const reason = window.prompt("Please provide a reason for reporting this user:");
                  if (reason) {
                    reportUser(userId, reason);
                    toast.success("User reported successfully. Our team will review your report.");
                  }
                }}
                userTier={currentUser?.accountTier}
              />

              {/* Premium Banner for FREE users */}
              {currentUser?.accountTier === ACCOUNT_TIER.FREE && (
                <PremiumBanner onUpgradeClick={() => navigate("/subscription")} />
              )}

              {/* Call Banners */}
              <CallBanners
                incomingCall={incomingCall}
                isCallActive={isCallActive}
                recipientNickname={activeConversation?.user?.nickname || 'User'}
                onAcceptCall={() => {
                  if (incomingCall?.callerId && /^[0-9a-fA-F]{24}$/.test(incomingCall.callerId)) {
                    // Check account tier before accepting
                    if (currentUser?.accountTier === ACCOUNT_TIER.FREE) {
                      toast.error("Free accounts cannot receive video calls. Upgrade to accept.");
                      // Decline automatically
                      socketService.answerVideoCall(incomingCall.callerId, false, incomingCall.callId);
                      setIncomingCall(null);
                      return;
                    }

                    socketService.answerVideoCall(incomingCall.callerId, true, incomingCall.callId);
                    const systemMessage = {
                      _id: generateUniqueId(),
                      sender: "system",
                      content: `You accepted the video call from ${activeConversation.user.nickname}.`,
                      createdAt: new Date().toISOString(),
                      type: "system",
                    };
                    setMessages((prev) => [...prev, systemMessage]);
                    setIsCallActive(true);
                    setIncomingCall(null);
                  } else {
                    console.error("Cannot accept call: Invalid caller ID format", incomingCall?.callerId);
                    toast.error("Error accepting call (Invalid ID).");
                    setIncomingCall(null);
                  }
                }}
                onDeclineCall={() => {
                  if (incomingCall?.callerId && /^[0-9a-fA-F]{24}$/.test(incomingCall.callerId)) {
                    socketService.answerVideoCall(incomingCall.callerId, false, incomingCall.callId);
                    const systemMessage = {
                      _id: generateUniqueId(),
                      sender: "system",
                      content: `You declined the video call from ${activeConversation.user.nickname}.`,
                      createdAt: new Date().toISOString(),
                      type: "system",
                    };
                    setMessages((prev) => [...prev, systemMessage]);
                  } else {
                    console.error("Cannot decline call: Invalid caller ID format", incomingCall?.callerId);
                    toast.error("Error declining call (Invalid ID).");
                  }
                  setIncomingCall(null);
                }}
                onEndCall={handleEndCall}
                useSmallButtons={false}
              />

              {/* Messages Area - Show appropriate status components */}
              {messagesLoading ? (
                <LoadingIndicator
                  showTimeoutMessage={false}
                  handleRetry={() => loadMessages(activeConversation.user._id)}
                  handleReconnect={() => chatService.reconnect?.()}
                />
              ) : error && messages.length === 0 ? (
                <ErrorMessage
                  error={error}
                  handleRetry={() => loadMessages(activeConversation.user._id)}
                  handleForceInit={() => {
                    chatInitializedRef.current = false;
                    chatService.initialize(currentUser);
                  }}
                  showInitButton={true}
                />
              ) : messages.length === 0 ? (
                <NoMessagesPlaceholder
                  text="No messages in this conversation yet."
                  hint={currentUser?.accountTier === ACCOUNT_TIER.FREE ? "Send a wink to start!" : "Say hello to start the conversation!"}
                />
              ) : (
                <MessageList
                  messages={filteredMessages}
                  currentUserId={currentUser?._id}
                  isSending={isSending}
                  typingUser={typingUser && activeConversation?.user?._id === typingUser ? activeConversation.user.nickname : null}
                  isMobile={isMobile}
                  onScroll={handleMessageScroll}
                  messagesEndRef={messagesEndRef}
                />
              )}

              {/* Attachment Preview with integrated file handling */}
              <AttachmentPreview
                attachment={attachment}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                onRemoveAttachment={handleRemoveAttachment}
                onFileSelected={(file, error) => {
                  if (error) {
                    toast.error(error);
                    return;
                  }

                  if (file) {
                    setAttachment(file);
                    toast.info(`Selected file: ${file.name}`);

                    if (isMobile && "vibrate" in navigator) {
                      navigator.vibrate(30);
                    }
                  }
                }}
                showFileInput={false}
                disabled={!!incomingCall || isCallActive}
                userTier={currentUser?.accountTier}
              />

              {/* Emoji Picker */}
              <EmojiPicker
                isVisible={showEmojis}
                onClose={() => setShowEmojis(false)}
                onEmojiClick={(emoji) => {
                  setMessageInput((prev) => prev + emoji);
                  setShowEmojis(false);
                  setTimeout(() => messageInputRef.current?.focus(), 0);
                  if (isMobile && "vibrate" in navigator) {
                    navigator.vibrate(20);
                  }
                }}
              />

              {/* Chat Input */}
              <ChatInput
                messageValue={messageInput}
                onInputChange={handleMessageInputChange}
                onSubmit={attachment ? handleSendAttachment : handleSendMessage}
                onWinkSend={handleSendWink}
                onFileAttachClick={handleFileAttachment}
                disabled={!!incomingCall || isCallActive || activeConversation?.user?.isBlocked || (activeConversation?.user?._id && isUserBlocked(activeConversation.user._id))}
                isUserBlocked={activeConversation?.user?.isBlocked || (activeConversation?.user?._id && isUserBlocked(activeConversation.user._id))}
                onEmojiClick={(emoji) => {
                  setMessageInput((prev) => prev + emoji);
                  setShowEmojis(false);
                  setTimeout(() => messageInputRef.current?.focus(), 0);
                  if (isMobile && "vibrate" in navigator) {
                    navigator.vibrate(20);
                  }
                }}
                userTier={currentUser?.accountTier}
                isSending={isSending}
                isUploading={isUploading}
                attachmentSelected={!!attachment}
                inputRef={messageInputRef}
                placeholderText={
                  activeConversation?.user?.isBlocked ?
                    "You have blocked this user" :
                    (currentUser?.accountTier === ACCOUNT_TIER.FREE
                      ? "Send a wink instead (Free Account)"
                      : `Message ${activeConversation?.user?.nickname || ''}...`)
                }
              />

              {/* File Attachment Handler */}
              <FileAttachmentHandler
                onFileSelected={(file) => {
                  if (file) {
                    setAttachment(file);
                    toast.info(`Selected file: ${file.name}`);

                    if (isMobile && "vibrate" in navigator) {
                      navigator.vibrate(30);
                    }
                  }
                }}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                showProgress={false}
                acceptedFileTypes="image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,audio/mpeg,audio/wav,audio/ogg,video/mp4,video/quicktime,video/webm"
              />
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
                  onClick={() => navigate('/dashboard')} // Navigate to dashboard
                >
                  Find someone to chat with
                </button>
              </div>
            </div>
          )}
        </ChatArea>
      </div>

      {/* Video Call Overlay */}
      {isCallActive && activeConversation?.user?._id && /^[0-9a-fA-F]{24}$/.test(activeConversation.user._id) && (
        <div className={styles.videoCallOverlay}>
          <VideoCall
            isActive={isCallActive}
            userId={currentUser?._id}
            recipientId={activeConversation.user._id}
            onEndCall={handleEndCall}
            isIncoming={false}
            callId={null}
          />
        </div>
      )}

      {/* User Profile Modal */}
      <UserProfileModal
        userId={profileUserId}
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </MessagesWrapper>
  );
};

export default Messages;
