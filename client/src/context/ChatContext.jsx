"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import chatService from "../services/ChatService";
import logger from "../utils/logger";
import { MemoryHelper } from "../utils/simple-memory-helper";

const log = logger.create("ChatContext");

// Create context
const ChatContext = createContext();

/**
 * ChatProvider is a wrapper around ChatService that provides
 * chat state and methods to all child components.
 *
 * It is designed to be a thin wrapper that delegates most functionality
 * to the ChatService singleton, which acts as the single source of truth.
 */
export function ChatProvider({ children }) {
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
  const [typingStatus, setTypingStatus] = useState(false);

  // Pagination state
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // Message state
  const [sending, setSending] = useState(false);

  // Refs for cleanup and tracking mount status
  const mountedRef = useRef(true);
  const cleanupHelper = useRef(new MemoryHelper());
  const typingTimeoutRef = useRef(null);

  // Initialize chat service when user is authenticated
  useEffect(() => {
    mountedRef.current = true;

    const initializeChat = async () => {
      if (!isAuthenticated || !user?._id) return;

      setLoading(true);
      setError(null);

      try {
        log.info("Initializing chat service...");
        await chatService.initialize(user);

        if (mountedRef.current) {
          setInitialized(true);
          // Force immediate check of connection status
          const connected = chatService.isConnected();
          setIsConnected(connected);
          log.info(`Initial connection status: ${connected}`);
          setupListeners();
        }
      } catch (error) {
        log.error("Failed to initialize chat service:", error);

        if (mountedRef.current) {
          setError(error.message || "Failed to initialize chat");
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
      cleanupHelper.current.cleanup();
    };
  }, [isAuthenticated, user]);

  // Setup listeners for chat events
  const setupListeners = useCallback(() => {
    // Clear existing listeners
    cleanupHelper.current.cleanup();

    // Connection status listener
    cleanupHelper.current.addCleanup(
      chatService.on('connectionChanged', ({ connected }) => {
        if (!mountedRef.current) return;
        setIsConnected(connected);
      })
    );

    // Message received listener
    cleanupHelper.current.addCleanup(
      chatService.on('messageReceived', (message) => {
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
          chatService.markConversationRead(message.sender);
        }

        // Update conversations list with latest message
        updateConversationWithMessage(message);
      })
    );

    // Message sent confirmation listener
    cleanupHelper.current.addCleanup(
      chatService.on('messageSent', (message) => {
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
    cleanupHelper.current.addCleanup(
      chatService.on('messageError', (error) => {
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

    // Add typing indicator listener
    cleanupHelper.current.addCleanup(
      chatService.on('userTyping', (data) => {
        if (!mountedRef.current) return;

        // Only update typing status if it's for the active conversation
        if (activeConversation === data.userId) {
          setTypingStatus(true);

          // Clear any existing timeout
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }

          // Set timeout to clear typing status after 3 seconds
          typingTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              setTypingStatus(false);
            }
          }, 3000);
        }
      })
    );
  }, [activeConversation]);

  // Helper to clean up listeners
  const cleanupListeners = useCallback(() => {
    cleanupHelper.current.cleanup();

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, []);

  // Helper to update conversation list with new message
  const updateConversationWithMessage = useCallback((message) => {
    setConversations(prev => {
      // Find the conversation
      const conversationIndex = prev.findIndex(c =>
        c._id === (message.recipient === user?._id ? message.sender : message.recipient)
      );

      if (conversationIndex === -1) {
        // If conversation doesn't exist, we might need to refresh the list
        // This could happen if this is the first message
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
        ? { ...m, ...message, status: 'sent', pending: false, error: false }
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
      log.info("ChatContext: Getting conversations from service");
      const fetchedConversations = await chatService.getConversations();
      log.info(`ChatContext: Got ${fetchedConversations?.length || 0} conversations from service`);

      if (mountedRef.current && Array.isArray(fetchedConversations)) {
        log.info("ChatContext: Setting conversations in state");
        setConversations(fetchedConversations);
        return fetchedConversations;
      }

      log.warn("ChatContext: Got non-array or component unmounted, returning empty array");
      return [];
    } catch (error) {
      log.error("Failed to fetch conversations:", error);
      return [];
    }
  }, [initialized, isAuthenticated]);


  // Function to set active conversation - without loadMessages dependency to avoid circular dep
  const setActiveConvo = useCallback((recipientId) => {
    log.info(`setActiveConvo called with recipientId: ${recipientId}, current: ${activeConversation}, initialized: ${initialized}`);
    
    if (recipientId === activeConversation) {
      log.debug('Already the active conversation, skipping');
      return;
    }

    setActiveConversation(recipientId);

    // Mark conversation as read when it becomes active
    if (recipientId) {
      if (initialized) {
        log.info(`Loading messages for conversation: ${recipientId}`);
        chatService.markConversationRead(recipientId);

        // Reset pagination when changing conversations
        setPage(1);
        setHasMore(true);

        // Reset typing status
        setTypingStatus(false);

        // We'll use an effect to trigger message loading instead
      } else {
        log.warn(`Chat not initialized yet, will load messages for ${recipientId} when ready`);
      }
    }
  }, [activeConversation, initialized]);

  // Function to load messages for a conversation
  const loadMessages = useCallback(async (recipientId, forceRefresh = false) => {
    if (!recipientId || !initialized || (loading && !forceRefresh)) {
      log.debug(`Skipping loadMessages - recipientId: ${recipientId}, initialized: ${initialized}, loading: ${loading}, forceRefresh: ${forceRefresh}`);
      return messages;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await chatService.getMessages(recipientId);
      const fetchedMessages = response?.messages || [];

      if (!mountedRef.current) return [];

      // Only update if this is still the active conversation
      if (activeConversation === recipientId) {
        // Messages are already validated as an array from the service
        
        // Deduplicate and sort messages
        const uniqueMessages = [];
        const seenIds = new Set();

        // Use spread and reverse to avoid mutating original array
        [...fetchedMessages].reverse().forEach(msg => {
          if (!seenIds.has(msg._id)) {
            uniqueMessages.push(msg);
            seenIds.add(msg._id);
          }
        });

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
  }, [activeConversation, initialized, loading, messages]);
  
  // Load messages when active conversation changes or when initialized
  useEffect(() => {
    if (initialized && activeConversation) {
      log.info(`Loading messages for conversation: ${activeConversation}`);
      loadMessages(activeConversation);
    }
  }, [initialized, activeConversation, loadMessages]);

  // Function to load more messages (pagination)
  const loadMoreMessages = useCallback(async () => {
    if (!activeConversation || !initialized || loadingMore || !hasMore) {
      return [];
    }

    setLoadingMore(true);

    try {
      const nextPage = page + 1;
      const response = await chatService.getMessages(activeConversation, nextPage);
      const moreMessages = response?.messages || [];

      if (!mountedRef.current) return [];

      if (moreMessages.length > 0) {
        setMessages(prev => {
          // Combine with existing messages, avoiding duplicates
          const combined = [...prev];
          const seenIds = new Set(prev.map(m => m._id));

          moreMessages.forEach(msg => {
            if (!seenIds.has(msg._id)) {
              combined.push(msg);
              seenIds.add(msg._id);
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

      // Create optimistic message
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const tempMessage = {
        _id: tempId,
        tempId,
        sender: user._id,
        recipient: activeConversation,
        content,
        type,
        metadata: metadata || {},
        createdAt: new Date().toISOString(),
        status: 'sending',
        pending: true
      };

      // Add optimistic message to UI
      setMessages(prev => [...prev, tempMessage].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      ));

      // Send actual message
      const result = await chatService.sendMessage(
        activeConversation,
        content,
        type,
        metadata
      );

      if (!mountedRef.current) return result;

      // Update message status
      setMessages(prev => prev.map(m =>
        m.tempId === tempId
          ? { ...m, ...result, status: 'sent', pending: false }
          : m
      ));

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
      chatService.sendTypingIndicator(activeConversation);
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
      return chatService.markConversationRead(recipientId);
    }
    return Promise.resolve(null);
  }, [initialized]);

  // Create combined context value
  const contextValue = {
    // State
    initialized,
    loading,
    error,
    isConnected,
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
    markConversationRead
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}

// Custom hook to use chat context
export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};

// Export the context
export default ChatContext;