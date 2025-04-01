// client/src/hooks/useChat.js
/**
 * Comprehensive hook for chat functionality
 * Provides messages, conversation state, and actions
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context';
import chatService from '../services/ChatService';
import { logger } from '../utils';

// Create a logger for this hook
const log = logger.create('useChat');

/**
 * Main chat hook for conversation management
 * @param {string} recipientId - ID of the conversation partner
 * @returns {Object} - Chat state and methods
 */
export const useChat = (recipientId) => {
  const { user, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typingStatus, setTypingStatus] = useState(false);
  const [isConnected, setIsConnected] = useState(chatService.isConnected());

  // Refs for tracking state in callbacks and event listeners
  const messagesRef = useRef(messages);
  const typingTimeoutRef = useRef(null);
  const listenerCleanupRef = useRef(null);
  const mountedRef = useRef(true);

  // Update refs when state changes
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Initialize chat service when component mounts
  useEffect(() => {
    if (isAuthenticated && user?._id) {
      chatService.initialize(user);
    }

    return () => {
      mountedRef.current = false;
      
      // Clean up typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Clean up event listeners
      if (listenerCleanupRef.current) {
        listenerCleanupRef.current.forEach(cleanup => cleanup());
        listenerCleanupRef.current = null;
      }
    };
  }, [isAuthenticated, user]);

  // Set up event listeners
  useEffect(() => {
    if (!recipientId || !isAuthenticated || !user?._id) return;
    
    // Remove previous listeners
    if (listenerCleanupRef.current) {
      listenerCleanupRef.current.forEach(cleanup => cleanup());
    }
    
    // Initialize cleanup array
    const listeners = [];
    
    // Listen for new messages
    const messageListener = chatService.on('messageReceived', (message) => {
      if (!mountedRef.current) return;
      
      // Only add messages relevant to this conversation
      if (
        (message.sender === recipientId && message.recipient === user._id) ||
        (message.sender === user._id && message.recipient === recipientId)
      ) {
        log.debug(`Received new message in conversation with ${recipientId}`);
        
        // Update messages state
        setMessages(prev => {
          // Check if message already exists
          const exists = prev.some(m => m._id === message._id);
          if (exists) {
            return prev.map(m => m._id === message._id ? { ...m, ...message } : m);
          }
          return [message, ...prev].sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
          );
        });
        
        // Mark the message as read if it's from the recipient
        if (message.sender === recipientId && !message.read) {
          chatService.markConversationRead(recipientId);
        }
      }
    });
    listeners.push(messageListener);
    
    // Listen for sent message confirmations
    const sentListener = chatService.on('messageSent', (message) => {
      if (!mountedRef.current) return;
      
      if (message.recipient === recipientId) {
        log.debug(`Message sent confirmation for conversation with ${recipientId}`);
        
        // Update messages state
        setMessages(prev => {
          const messageIndex = prev.findIndex(m => 
            m._id === message._id || m.tempId === message.tempMessageId
          );
          
          if (messageIndex >= 0) {
            // Update existing message
            const newMessages = [...prev];
            newMessages[messageIndex] = {
              ...newMessages[messageIndex],
              ...message,
              status: 'sent',
              pending: false
            };
            return newMessages;
          }
          
          // Add new message if not found
          return [
            { ...message, status: 'sent', pending: false },
            ...prev
          ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        });
      }
    });
    listeners.push(sentListener);
    
    // Listen for typing indicators
    const typingListener = chatService.on('userTyping', (data) => {
      if (!mountedRef.current) return;
      
      if (data.userId === recipientId) {
        log.debug(`${recipientId} is typing...`);
        setTypingStatus(true);
        
        // Auto-clear typing indicator after 3 seconds
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        
        typingTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setTypingStatus(false);
          }
        }, 3000);
      }
    });
    listeners.push(typingListener);
    
    // Listen for connection changes
    const connectionListener = chatService.on('connectionChanged', ({ connected }) => {
      if (!mountedRef.current) return;
      setIsConnected(connected);
      
      // Reload messages if connection was re-established
      if (connected) {
        loadMessages(true);
      }
    });
    listeners.push(connectionListener);
    
    // Save listeners for cleanup
    listenerCleanupRef.current = listeners;
    
    // Initial load
    loadMessages();
    
    // Mark conversation as read when opened
    chatService.markConversationRead(recipientId);
    
    return () => {
      // Clean up listeners when component unmounts or recipientId changes
      listeners.forEach(cleanup => cleanup());
      
      // Clean up typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [recipientId, isAuthenticated, user]);

  /**
   * Load messages for the current conversation
   * @param {boolean} forceRefresh - Whether to force a fresh load
   * @returns {Promise<Array>} - Loaded messages
   */
  const loadMessages = useCallback(async (forceRefresh = false) => {
    if (!recipientId || !isAuthenticated || !user?._id) {
      setLoading(false);
      return [];
    }
    
    // Don't reload if already loading
    if (loading && !forceRefresh) {
      return [];
    }
    
    // Set a timeout to ensure loading state doesn't get stuck
    const timeoutId = setTimeout(() => {
      if (mountedRef.current) {
        log.warn('Message loading timeout reached. Resetting loading state.');
        setLoading(false);
        setError('Loading timed out. Please try again.');
      }
    }, 10000); // 10 second timeout
    
    setLoading(true);
    setError(null);
    
    try {
      log.debug(`Loading messages with ${recipientId}`);
      
      // Check socket connection first
      if (!chatService.isConnected()) {
        log.warn('Socket not connected. Attempting to use API directly.');
      }
      
      const loadedMessages = await chatService.getMessages(recipientId, 1, 20);
      
      // Clear the timeout since we got a response
      clearTimeout(timeoutId);
      
      if (!mountedRef.current) return [];
      
      // Handle empty messages as a successful but empty result
      setMessages(loadedMessages || []);
      setHasMore((loadedMessages || []).length >= 20); // Assume there's more if we got a full page
      setPage(1);
      setLoading(false);
      
      return loadedMessages || [];
    } catch (err) {
      log.error(`Error loading messages:`, err);
      
      // Clear the timeout since we got a response
      clearTimeout(timeoutId);
      
      if (!mountedRef.current) return [];
      
      setError(err.message || "Failed to load messages");
      setLoading(false);
      return [];
    }
  }, [recipientId, isAuthenticated, user, loading]);

  /**
   * Load more messages (pagination)
   * @returns {Promise<Array>} - Newly loaded messages
   */
  const loadMoreMessages = useCallback(async () => {
    if (!recipientId || !isAuthenticated || loadingMore || !hasMore) {
      return [];
    }
    
    setLoadingMore(true);
    
    try {
      const nextPage = page + 1;
      log.debug(`Loading more messages, page ${nextPage}`);
      
      const moreMessages = await chatService.getMessages(recipientId, nextPage, 20);
      
      if (!mountedRef.current) return [];
      
      if (moreMessages.length > 0) {
        setMessages(prev => {
          // Combine and sort all messages, removing duplicates
          const combined = [...prev];
          
          moreMessages.forEach(newMsg => {
            // Check if message already exists
            const exists = combined.some(m => m._id === newMsg._id);
            if (!exists) {
              combined.push(newMsg);
            }
          });
          
          // Sort by creation date (newest first)
          return combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        });
        
        setPage(nextPage);
      }
      
      setHasMore(moreMessages.length >= 20); // If we got a full page, assume more
      setLoadingMore(false);
      
      return moreMessages;
    } catch (err) {
      log.error(`Error loading more messages:`, err);
      
      if (!mountedRef.current) return [];
      
      setError(err.message || "Failed to load more messages");
      setLoadingMore(false);
      return [];
    }
  }, [recipientId, isAuthenticated, loadingMore, hasMore, page]);

  /**
   * Send a message to the recipient
   * @param {string} content - Message content
   * @param {string} type - Message type
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} - The sent message
   */
  const sendMessage = useCallback(async (content, type = 'text', metadata = null) => {
    if (!recipientId || !isAuthenticated || !user?._id) {
      log.error('Cannot send message: Missing recipient or not authenticated');
      throw new Error('Cannot send message: Authentication required');
    }
    
    setSending(true);
    
    try {
      log.debug(`Sending ${type} message to ${recipientId}`);
      
      const message = await chatService.sendMessage(recipientId, content, type, metadata);
      
      if (!mountedRef.current) return message;
      
      // Optimistically update UI
      setMessages(prev => {
        // Check if temporary version exists
        const tempIndex = prev.findIndex(m => m.tempId === message.tempMessageId);
        
        if (tempIndex >= 0) {
          // Replace temp message
          const updated = [...prev];
          updated[tempIndex] = {
            ...updated[tempIndex],
            ...message,
            status: 'sent',
            pending: false
          };
          return updated;
        }
        
        // Add as new message and sort
        return [message, ...prev].sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
      });
      
      setSending(false);
      return message;
    } catch (err) {
      log.error(`Error sending message:`, err);
      
      if (!mountedRef.current) {
        throw err;
      }
      
      setSending(false);
      throw err;
    }
  }, [recipientId, isAuthenticated, user]);

  /**
   * Send typing indicator to recipient
   */
  const sendTyping = useCallback(() => {
    if (recipientId && isAuthenticated && chatService.isConnected()) {
      chatService.sendTypingIndicator(recipientId);
    }
  }, [recipientId, isAuthenticated]);

  /**
   * Manually refresh messages
   */
  const refresh = useCallback(() => {
    return loadMessages(true);
  }, [loadMessages]);

  /**
   * Reset any errors
   */
  const resetError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    loading,
    sending,
    error,
    hasMore,
    loadMoreMessages,
    sendMessage,
    sendTyping,
    typingStatus,
    refresh,
    resetError,
    isConnected
  };
};

export default useChat;