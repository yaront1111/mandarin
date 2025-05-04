"use client";

import React, { useState, useEffect, useRef, useContext, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import chatService from "../services/ChatService";
import { formatDate, classNames } from "../utils";
import apiService from "../services/apiService";
import logger from "../utils/logger";
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
    // Disabling eslint exhaustive-deps because fetchConversations is called within initChat
    // and including it would cause an infinite loop or unnecessary re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isAuthenticated, authLoading]);

  // Socket and notification event listeners
  useEffect(() => {
    if (!chatInitializedRef.current || !currentUser?._id || typeof window === 'undefined') return;

    const handleMessageReceived = (newMessage) => {
      console.log("Message received:", newMessage);
      
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
            
            // Strategy 3: Fuzzy hash for near-matches with slight variations
            const existingFuzzyHash = createFuzzyHash(msg);
            if (existingFuzzyHash === newMessageFuzzyHash) {
              console.log("Fuzzy hash match detected, likely duplicate", {
                existing: msg._id,
                new: newMessage._id,
                fuzzyHash: newMessageFuzzyHash
              });
              return true;
            }
            
            // Strategy 4: Look for messages with identical content but different IDs
            // that arrived within a short time window (5 seconds)
            if (msg.sender === newMessage.sender &&
                msg.content === newMessage.content &&
                msg.type === newMessage.type &&
                Math.abs(new Date(msg.createdAt) - new Date(newMessage.createdAt)) < 5000) {
              console.log("Content+time match detected, treating as duplicate", {
                existing: msg._id,
                new: newMessage._id
              });
              return true;
            }
            
            // Strategy 5: Attribute-based detection with smart tolerance
            const contentMatch = msg.content && newMessage.content && 
                                msg.content.length > 10 && 
                                msg.content === newMessage.content;
            
            const timeMatch = msg.createdAt && newMessage.createdAt && 
                             Math.abs(new Date(msg.createdAt) - new Date(newMessage.createdAt)) < 10000; // 10s tolerance
            
            // Special handling for different message types
            const typeSpecificMatch = (() => {
              // For text messages, compare content and length
              if (msg.type === 'text' && newMessage.type === 'text') {
                return contentMatch;
              }
              
              // For file messages, compare filenames and size if available
              if (msg.type === 'file' && newMessage.type === 'file') {
                const fileNameMatch = msg.metadata?.fileName === newMessage.metadata?.fileName;
                const fileSizeMatch = msg.metadata?.fileSize === newMessage.metadata?.fileSize;
                return (fileNameMatch && fileSizeMatch) || 
                       (msg.metadata?.url === newMessage.metadata?.url);
              }
              
              // For other message types, use basic comparison
              return msg.type === newMessage.type && contentMatch;
            })();
            
            // For messages with the same sender, same type, and close timestamps
            const attributeMatch = msg.sender === newMessage.sender && 
                                  timeMatch &&
                                  typeSpecificMatch;
                              
            if (attributeMatch) {
              console.log("Attribute match detected, treating as duplicate", {
                existing: msg._id,
                new: newMessage._id
              });
            }
            
            return attributeMatch;
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
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
    // Disabling eslint exhaustive-deps for handleEndCall as it's a stable function defined outside
    // but used within the effect cleanup logic implicitly via handleCallHangup.
    // Including it might cause complexity if its definition changes frequently.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation, currentUser?._id, isCallActive, isMobile]); // Added updateConversationList


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
  // Disabling exhaustive-deps for selectConversation & loadUserDetails as they are stable functions
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation?.user?._id, currentUser?._id]);


  // Auto-scroll to bottom when messages update
  useEffect(() => {
    // Added a small delay to allow layout reflow, especially for images
    const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
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
  }, [blockedUsers, isUserBlocked, activeConversation]);

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
  // Disabling exhaustive-deps for loadUserDetails as it's a stable function
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
     
     // Set messages with processed file URLs
     setMessages(
       processedMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
     );
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
      // Replace optimistic message with actual server response
       setMessages((prev) =>
         prev
           .map((msg) => (msg.tempId === tempId ? { ...sentMessage, _id: sentMessage._id || tempId } : msg)) // Use tempId if _id missing in response?
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
     // Replace optimistic wink with actual server response
     setMessages((prev) =>
       prev
         .map((msg) => (msg.tempId === tempId ? { ...sentMessage, _id: sentMessage._id || tempId } : msg))
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
    
    // Trigger file selection in the FileAttachmentHandler component
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.click();
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

    if (isMobile && "vibrate" in navigator) {
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
      
      // Update the optimistic message with the real URL
      // Keep both the local URL and real URL for a smooth transition
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
                  serverUrl: fileData.url, // Add a separate serverUrl field to track the permanent URL
                },
              }
            : msg
        )
      );

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


  const handleEmojiClick = (emoji) => {
    setMessageInput((prev) => prev + emoji);
    setShowEmojis(false);
    if (messageInputRef.current) {
      messageInputRef.current.focus();
    }
    if (isMobile && "vibrate" in navigator) {
      navigator.vibrate(20);
    }
  };

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
       const convoIndex = prev.findIndex((c) => c.user._id === partnerId);
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

  // No longer needed - using the shared component getFileIcon function
  // const getFileIcon = (fileType) => {
  //   if (!fileType) return <FaFile />;
  //   if (fileType.startsWith("image/")) return <FaImage />;
  //   if (fileType.startsWith("video/")) return <FaFileVideo />;
  //   if (fileType.startsWith("audio/")) return <FaFileAudio />;
  //   if (fileType === "application/pdf") return <FaFilePdf />;
  //   // Add more specific icons if needed
  //   if (fileType.includes("word")) return <FaFileAlt />; // Simple check for Word
  //   if (fileType.includes("spreadsheet") || fileType.includes("excel")) return <FaFileAlt />; // Placeholder
  //   return <FaFileAlt />; // Default document icon
  // };

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
          className={(!showSidebar && isMobile) && styles.fullWidth}
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
                  messages={messages}
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
                disabled={activeConversation?.user?.isBlocked || (activeConversation?.user?._id && isUserBlocked(activeConversation.user._id))}
                isUserBlocked={activeConversation?.user?.isBlocked || (activeConversation?.user?._id && isUserBlocked(activeConversation.user._id))}
                placeholderText={activeConversation?.user?.isBlocked ? "You have blocked this user" : "Type a message..."}
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
                disabled={!!incomingCall || isCallActive}
                inputRef={messageInputRef}
                placeholderText={
                  currentUser?.accountTier === ACCOUNT_TIER.FREE 
                    ? "Send a wink instead (Free Account)" 
                    : `Message ${activeConversation?.user?.nickname || ''}...`
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
