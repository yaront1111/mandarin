// client/src/context/enhanced/UnifiedChatContext.jsx
// Unified Chat Context with improved performance and reliability

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../AuthContext";
import enhancedChatService from "../../services/enhanced/chatService";
import enhancedSocketClient from "../../services/enhanced/socketClient";
import logger from "../../utils/logger";
import MemoryHelper from "../../utils/simple-memory-helper";
import config from "../../config";

// Create named logger
const log = logger.create("UnifiedChatContext");

// Create context
const UnifiedChatContext = createContext();

/**
 * UnifiedChatProvider combines both connection and chat state management
 * in a single context provider with improved performance
 */
export function UnifiedChatProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  
  // Core state
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Chat data state
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [typingStatus, setTypingStatus] = useState({});
  
  // Pagination state
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Message state
  const [sending, setSending] = useState(false);
  
  // Connection state
  const [connecting, setConnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  // Refs for cleanup and tracking mount status
  const mountedRef = useRef(true);
  const typingTimeoutsRef = useRef({});
  
  // Simple memory helper for cleanup
  const cleanupHelper = useRef(new MemoryHelper());
  
  // Initialize chat service when user is authenticated
  useEffect(() => {
    mountedRef.current = true;
    
    const initializeChat = async () => {
      if (!isAuthenticated || !user?._id) return;
      
      setLoading(true);
      setError(null);
      setConnecting(true);
      
      try {
        log.info("Initializing enhanced chat service...");
        await enhancedChatService.initialize(user);
        
        if (mountedRef.current) {
          setInitialized(true);
          setIsConnected(enhancedChatService.isConnected());
          setConnecting(false);
          setupListeners();
        }
      } catch (error) {
        log.error("Failed to initialize chat service:", error);
        
        if (mountedRef.current) {
          setError(error.message || "Failed to initialize chat");
          setConnecting(false);
          // Set initialized to true even on error to prevent infinite loading
          setInitialized(true);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };
    
    initializeChat();
    
    return () => {
      mountedRef.current = false;
      cleanupListeners();
      
      // Clean up typing timeouts
      Object.values(typingTimeoutsRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
      typingTimeoutsRef.current = {};
      
      // Cleanup memory helper
      if (cleanupHelper.current) {
        cleanupHelper.current.cleanup();
      }
    };
  }, [isAuthenticated, user]);
  
  // Set up listeners for chat and connection events
  const setupListeners = useCallback(() => {
    // Clear existing listeners
    cleanupListeners();
    
    const listeners = [];
    const helper = cleanupHelper.current;
    
    // Connection status listener
    listeners.push(
      helper.addSubscription('connectionChanged',
        enhancedChatService.on('connectionChanged', ({ connected }) => {
          if (!mountedRef.current) return;
          setIsConnected(connected);
        })
      )
    );
    
    // Socket connection events for detailed status
    listeners.push(
      helper.addSubscription('socketConnected',
        enhancedSocketClient.on(config.SOCKET.EVENTS.SOCKET_CONNECTED, () => {
          if (!mountedRef.current) return;
          setIsConnected(true);
          setConnecting(false);
          setReconnectAttempts(0);
        })
      )
    );
    
    listeners.push(
      helper.addSubscription('socketDisconnected',
        enhancedSocketClient.on(config.SOCKET.EVENTS.SOCKET_DISCONNECTED, () => {
          if (!mountedRef.current) return;
          setIsConnected(false);
        })
      )
    );
    
    listeners.push(
      helper.addSubscription('socketConnectionFailed',
        enhancedSocketClient.on(config.SOCKET.EVENTS.SOCKET_CONNECTION_FAILED, (data) => {
          if (!mountedRef.current) return;
          setConnecting(false);
          setReconnectAttempts(data.attempts || 0);
        })
      )
    );
    
    listeners.push(
      helper.addSubscription('socketReconnecting',
        enhancedSocketClient.on(config.SOCKET.EVENTS.SOCKET_RECONNECTING, () => {
          if (!mountedRef.current) return;
          setConnecting(true);
        })
      )
    );
    
    // Message received listener
    listeners.push(
      enhancedChatService.on('messageReceived', (message) => {
        if (!mountedRef.current) return;
        
        // Update messages if for active conversation
        if (activeConversation === message.sender) {
          setMessages(prev => {
            // Check for duplicates
            if (prev.some(m => m._id === message._id)) return prev;
            
            // Add message and sort
            return [...prev, message].sort(
              (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            );
          });
          
          // Mark conversation as read
          enhancedChatService.markConversationRead(message.sender);
        }
        
        // Update conversations list with latest message
        updateConversationWithMessage(message);
      })
    );
    
    // Message sent/updated confirmation listener
    listeners.push(
      enhancedChatService.on('messageUpdated', (message) => {
        if (!mountedRef.current) return;
        
        // Update message status if for active conversation
        if (activeConversation === message.recipient) {
          updateMessageStatus(message);
        }
        
        // Update conversations list with latest message
        updateConversationWithMessage(message);
      })
    );
    
    // Message error listener
    listeners.push(
      enhancedChatService.on('messageError', (error) => {
        if (!mountedRef.current) return;
        
        if (error.tempId) {
          // Mark message as error
          setMessages(prev => prev.map(m =>
            m.tempId === error.tempId
              ? { ...m, status: 'error', error: true, errorMessage: error.error }
              : m
          ));
        }
        
        setSending(false);
        setError(error.error || 'Error sending message');
      })
    );
    
    // Typing indicator listener
    listeners.push(
      helper.addSubscription('userTyping',
        enhancedChatService.on('userTyping', (data) => {
          if (!mountedRef.current) return;
          
          // Update typing status
          const userId = data.userId;
          
          setTypingStatus(prev => ({
            ...prev,
            [userId]: {
              isTyping: true,
              timestamp: data.timestamp || Date.now()
            }
          }));
          
          // Clear any existing timeout
          if (typingTimeoutsRef.current[userId]) {
            clearTimeout(typingTimeoutsRef.current[userId]);
            delete typingTimeoutsRef.current[userId];
          }
          
          // Set timeout to clear typing status after 3 seconds
          const timeoutId = setTimeout(() => {
            if (mountedRef.current) {
              setTypingStatus(prev => ({
                ...prev,
                [userId]: {
                  ...prev[userId],
                  isTyping: false
                }
              }));
            }
            delete typingTimeoutsRef.current[userId];
          }, 3000);
          
          // Store timeout ID for cleanup
          typingTimeoutsRef.current[userId] = timeoutId;
        })
      )
    );
    
    // Messages read listener
    listeners.push(
      enhancedChatService.on('messagesRead', (data) => {
        if (!mountedRef.current) return;
        
        // Update read status of messages
        if (data.messageIds && Array.isArray(data.messageIds)) {
          setMessages(prev => prev.map(m =>
            data.messageIds.includes(m._id)
              ? { ...m, read: true, readAt: data.timestamp || new Date().toISOString() }
              : m
          ));
        }
      })
    );
  }, [activeConversation]);
  
  // Helper to clean up listeners
  const cleanupListeners = useCallback(() => {
    // The helper manages cleanup internally
  }, []);
  
  // Helper to update conversation list with a new message
  const updateConversationWithMessage = useCallback((message) => {
    setConversations(prev => {
      // Determine the conversation ID
      const conversationId = message.sender === user?._id
        ? message.recipient
        : message.sender;
      
      // Find the conversation
      const conversationIndex = prev.findIndex(c => c._id === conversationId);
      
      if (conversationIndex === -1) {
        // If conversation doesn't exist, refresh the list
        getConversations();
        return prev;
      }
      
      // Update the conversation with the latest message
      const updatedConversations = [...prev];
      updatedConversations[conversationIndex] = {
        ...updatedConversations[conversationIndex],
        lastMessage: message,
        // Increment unread count if not active conversation
        unreadCount: activeConversation === updatedConversations[conversationIndex]._id
          ? 0
          : (updatedConversations[conversationIndex].unreadCount || 0) + 1
      };
      
      // Sort conversations to put the most recent first
      return updatedConversations.sort((a, b) => {
        const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt) : new Date(0);
        const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt) : new Date(0);
        return bTime - aTime;
      });
    });
  }, [activeConversation, user]);
  
  // Helper to update message status
  const updateMessageStatus = useCallback((message) => {
    setMessages(prev => prev.map(m =>
      (m._id === message._id || m.tempId === message.tempId)
        ? { ...m, ...message, status: message.status || 'sent', pending: false, error: false }
        : m
    ));
  }, []);
  
  // Function to fetch conversations
  const getConversations = useCallback(async () => {
    if (!initialized || !isAuthenticated) {
      log.warn("Not initialized or authenticated, can't get conversations");
      return [];
    }
    
    try {
      log.info("Getting conversations from service");
      const fetchedConversations = await enhancedChatService.getConversations();
      
      if (mountedRef.current && Array.isArray(fetchedConversations)) {
        setConversations(fetchedConversations);
        return fetchedConversations;
      }
      
      return [];
    } catch (error) {
      log.error("Failed to fetch conversations:", error);
      return [];
    }
  }, [initialized, isAuthenticated]);
  
  // Function to set active conversation and load its messages
  const setActiveConvo = useCallback((recipientId) => {
    if (recipientId === activeConversation) return;
    
    setActiveConversation(recipientId);
    
    // Mark conversation as read when it becomes active
    if (recipientId && initialized) {
      enhancedChatService.markConversationRead(recipientId);
      
      // Reset pagination when changing conversations
      setPage(1);
      setHasMore(true);
      
      // Load messages for the conversation
      loadMessages(recipientId);
    }
  }, [activeConversation, initialized]);
  
  // Function to load messages for a conversation
  const loadMessages = useCallback(async (recipientId, forceRefresh = false) => {
    if (!recipientId || !initialized || (loading && !forceRefresh)) {
      return [];
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const fetchedMessages = await enhancedChatService.getMessages(recipientId);
      
      if (!mountedRef.current) return [];
      
      // Only update if this is still the active conversation
      if (activeConversation === recipientId) {
        // Deduplicate messages
        const uniqueMessages = [];
        const seenIds = new Set();
        
        // Process messages to ensure no duplicates
        [...fetchedMessages].forEach(msg => {
          const id = msg._id || msg.tempId;
          if (!id || !seenIds.has(id)) {
            if (id) seenIds.add(id);
            uniqueMessages.push(msg);
          }
        });
        
        // Sort messages by creation time
        uniqueMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        setMessages(uniqueMessages);
        setHasMore(fetchedMessages.length >= 20);
        setPage(1);
      }
      
      return fetchedMessages;
    } catch (error) {
      log.error("Failed to load messages:", error);
      
      if (mountedRef.current) {
        setError(error.message || "Failed to load messages");
      }
      
      return [];
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [activeConversation, initialized, loading]);
  
  // Function to load more messages (pagination)
  const loadMoreMessages = useCallback(async () => {
    if (!activeConversation || !initialized || loadingMore || !hasMore) {
      return [];
    }
    
    setLoadingMore(true);
    
    try {
      const nextPage = page + 1;
      const moreMessages = await enhancedChatService.getMessages(activeConversation, nextPage);
      
      if (!mountedRef.current) return [];
      
      if (Array.isArray(moreMessages) && moreMessages.length > 0) {
        setMessages(prev => {
          // Combine with existing messages, avoiding duplicates
          const combined = [...prev];
          const seenIds = new Set(prev.map(m => m._id || m.tempId));
          
          moreMessages.forEach(msg => {
            const id = msg._id || msg.tempId;
            if (!id || !seenIds.has(id)) {
              if (id) seenIds.add(id);
              combined.push(msg);
            }
          });
          
          // Sort messages by date
          return combined.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });
        
        setHasMore(moreMessages.length >= 20);
        setPage(nextPage);
      } else {
        setHasMore(false);
      }
      
      return moreMessages;
    } catch (error) {
      log.error("Failed to load more messages:", error);
      setError("Failed to load more messages");
      return [];
    } finally {
      setLoadingMore(false);
    }
  }, [activeConversation, initialized, loadingMore, hasMore, page]);
  
  // Function to send a message
  const sendMessage = useCallback(async (content, type = 'text', metadata = null) => {
    if (!activeConversation || !initialized || !isConnected) {
      const errMsg = 'Cannot send message: Chat is not ready';
      log.error(errMsg);
      throw new Error(errMsg);
    }
    
    setSending(true);
    
    try {
      // Check for recent duplicates (within 5 seconds)
      const now = new Date();
      const recentDuplicate = messages.some(m =>
        m.content === content &&
        m.type === type &&
        m.sender === user?._id &&
        m.recipient === activeConversation &&
        now - new Date(m.createdAt) < 5000
      );
      
      if (recentDuplicate) {
        log.debug("Skipping duplicate message send");
        setSending(false);
        return null;
      }
      
      // Send the message
      const result = await enhancedChatService.sendMessage(
        activeConversation,
        content,
        type,
        metadata
      );
      
      if (!mountedRef.current) return result;
      
      setSending(false);
      return result;
    } catch (error) {
      log.error("Failed to send message:", error);
      
      if (mountedRef.current) {
        setError(error.message || "Failed to send message");
        setSending(false);
      }
      
      throw error;
    }
  }, [activeConversation, initialized, isConnected, messages, user]);
  
  // Function to send typing indicator
  const sendTyping = useCallback(() => {
    if (activeConversation && initialized && isConnected) {
      enhancedChatService.sendTypingIndicator(activeConversation);
    }
  }, [activeConversation, initialized, isConnected]);
  
  // Function to reset error state
  const resetError = useCallback(() => {
    setError(null);
  }, []);
  
  // Function to refresh messages
  const refresh = useCallback(() => {
    if (activeConversation) {
      return loadMessages(activeConversation, true);
    }
    return Promise.resolve([]);
  }, [activeConversation, loadMessages]);
  
  // Function to mark a conversation as read
  const markConversationRead = useCallback((recipientId) => {
    if (recipientId && initialized) {
      return enhancedChatService.markConversationRead(recipientId);
    }
    return Promise.resolve(null);
  }, [initialized]);
  
  // Function to force reconnection
  const reconnect = useCallback(() => {
    if (!isConnected) {
      setConnecting(true);
      enhancedSocketClient.reconnect();
    }
  }, [isConnected]);
  
  // Function to get detailed diagnostics
  const getDiagnostics = useCallback(() => {
    return {
      chat: enhancedChatService.getDiagnostics(),
      socket: enhancedSocketClient.getDiagnostics(),
      state: {
        initialized,
        connected: isConnected,
        connecting,
        reconnectAttempts,
        activeConversation,
        messagesCount: messages.length,
        conversationsCount: conversations.length
      }
    };
  }, [initialized, isConnected, connecting, reconnectAttempts, activeConversation, 
      messages.length, conversations.length]);
  
  // Create context value
  const contextValue = {
    // State
    initialized,
    loading,
    error,
    isConnected,
    connecting,
    reconnectAttempts,
    messages,
    conversations,
    activeConversation,
    typingStatus,
    hasMore,
    loadingMore,
    sending,
    user,
    isAuthenticated,
    
    // Actions
    getConversations,
    setActiveConversation: setActiveConvo,
    loadMessages,
    loadMoreMessages,
    sendMessage,
    sendTyping,
    resetError,
    refresh,
    markConversationRead,
    reconnect,
    getDiagnostics
  };
  
  return (
    <UnifiedChatContext.Provider value={contextValue}>
      {children}
    </UnifiedChatContext.Provider>
  );
}

// Custom hook to use the unified chat context
export const useUnifiedChat = () => {
  const context = useContext(UnifiedChatContext);
  if (!context) {
    throw new Error("useUnifiedChat must be used within a UnifiedChatProvider");
  }
  return context;
};

export default UnifiedChatContext;