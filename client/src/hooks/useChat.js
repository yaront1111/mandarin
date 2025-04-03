// client/src/hooks/useChat.js
/**
 * Refactored chat hook for conversation management
 * Provides messages, conversation state, and actions with improved stability
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
export const useChat = (recipientId = null) => {
  // Ensure recipientId is treated as a string if it exists
  const normalizedRecipientId = recipientId ? String(recipientId) : null;
  const { user, isAuthenticated } = useAuth();
  
  // Component state
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typingStatus, setTypingStatus] = useState(false);
  const [isConnected, setIsConnected] = useState(chatService.isConnected());
  const [initialized, setInitialized] = useState(false);

  // Refs for tracking state in callbacks and event listeners
  const messagesRef = useRef(messages);
  const typingTimeoutRef = useRef(null);
  const listenerCleanupRef = useRef(null);
  const mountedRef = useRef(true);
  const loadingTimeoutRef = useRef(null);

  // Update refs when state changes
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Initialize chat service when component mounts with retry mechanism
  useEffect(() => {
    mountedRef.current = true;
    
    // Retry counter for initialization
    let retryCount = 0;
    const maxRetries = 3;
    let retryTimeoutId = null;
    
    const initChat = async () => {
      if (isAuthenticated && user?._id) {
        try {
          console.log(`Initializing chat service (attempt ${retryCount + 1})...`, {
            userId: user._id,
            isAuthenticated
          });
          
          // Initialize chat service with user data
          await chatService.initialize(user);
          
          if (mountedRef.current) {
            console.log("Chat service initialized successfully!");
            setInitialized(true);
            setIsConnected(chatService.isConnected());
          }
        } catch (err) {
          log.error("Failed to initialize chat service:", err);
          console.error("Chat service initialization error:", err);
          
          if (mountedRef.current) {
            if (retryCount < maxRetries) {
              // Retry with exponential backoff
              retryCount++;
              const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
              console.log(`Retrying chat initialization in ${delay}ms (attempt ${retryCount + 1}/${maxRetries + 1})`);
              
              retryTimeoutId = setTimeout(initChat, delay);
            } else {
              setError("Failed to initialize chat. Please refresh and try again.");
            }
          }
        }
      } else {
        console.warn("Cannot initialize chat: missing user ID or not authenticated", {
          userId: user?._id,
          isAuthenticated,
        });
      }
    };
    
    initChat();

    // Cleanup function with retry timeout clearance
    return () => {
      mountedRef.current = false;
      
      // Clear timeouts
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      
      // Clear the retry timeout if it exists
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
      
      // Clear event listeners
      if (listenerCleanupRef.current) {
        listenerCleanupRef.current.forEach(cleanup => {
          if (typeof cleanup === 'function') {
            cleanup();
          }
        });
        listenerCleanupRef.current = null;
      }
    };
  }, [isAuthenticated, user]);

  // Setup event listeners for the current conversation
  useEffect(() => {
    // Skip setup if missing required data or not initialized
    if (!normalizedRecipientId || !isAuthenticated || !user?._id || !initialized) {
      return;
    }
    
    // Clear previous listeners
    if (listenerCleanupRef.current) {
      listenerCleanupRef.current.forEach(cleanup => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });
    }
    
    // Create new listeners array
    const listeners = [];
    
    // 0. Message updated listener (for existing messages)
    const updateListener = chatService.on('messageUpdated', (message) => {
      if (!mountedRef.current) return;
      
      // Update messages state specifically for existing messages
      setMessages(prev => {
        // Find the message to update (by ID or tempId)
        return prev.map(m => {
          if (m._id === message._id || 
              (message.tempId && m.tempId === message.tempId) ||
              (message.tempMessageId && m.tempId === message.tempMessageId)) {
            return { ...m, ...message, updated: true };
          }
          return m;
        });
      });
    });
    listeners.push(updateListener);
    
    // 1. Message received listener
    const messageListener = chatService.on('messageReceived', (message) => {
      if (!mountedRef.current) return;
      
      // Only process messages for this conversation
      if (
        // Only handle INCOMING messages from the recipient
        // This prevents duplications with messageSent events
        message.sender === normalizedRecipientId && message.recipient === user._id
      ) {
        log.debug(`Received message from ${normalizedRecipientId}`);
        
        // Update messages state, preventing duplicates
        setMessages(prev => {
          // IMPORTANT: Skip duplicate messages by ID to prevent triple display
          // Check if message already exists by ID or tempID
          const exists = prev.some(m => 
            m._id === message._id || 
            (message.tempMessageId && m.tempId === message.tempMessageId)
          );
          
          // If the message already exists in our state, don't add it again
          if (exists) {
            log.debug(`Skipping duplicate message ${message._id} - already exists in state`);
            return prev;
          }
          
          // Add new message to the bottom (newest last)
          return [...prev, message];
        });
        
        // Mark message as read since we're looking at it
        chatService.markConversationRead(normalizedRecipientId);
      }
    });
    listeners.push(messageListener);
    
    // 2. Message sent confirmation listener
    const sentListener = chatService.on('messageSent', (message) => {
      if (!mountedRef.current) return;
      
      // Only handle messages for this conversation
      if (message.recipient === normalizedRecipientId) {
        log.debug(`Message sent confirmation for ${normalizedRecipientId}`);
        
        // Update message state with confirmed message
        setMessages(prev => {
          // Find temp message by ID or tempId
          const messageIndex = prev.findIndex(m => 
            m._id === message._id || 
            m.tempId === message.tempMessageId
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
          
          // Don't add as new if not found - prevent duplication
          log.debug("Message with tempId not found - this shouldn't happen normally");
          return prev;
        });
      }
    });
    listeners.push(sentListener);
    
    // 3. Typing indicator listener
    const typingListener = chatService.on('userTyping', (data) => {
      if (!mountedRef.current) return;
      
      if (data.userId === normalizedRecipientId) {
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
    
    // 4. Connection status listener
    const connectionListener = chatService.on('connectionChanged', ({ connected }) => {
      if (!mountedRef.current) return;
      
      setIsConnected(connected);
      
      // Reload messages if connection was restored
      if (connected) {
        loadMessages(true);
      }
    });
    listeners.push(connectionListener);
    
    // 5. Message error listener
    const errorListener = chatService.on('messageError', (error) => {
      if (!mountedRef.current) return;
      
      if (error.tempMessageId) {
        // Update the message with error status
        setMessages(prev => {
          return prev.map(m => {
            if (m.tempId === error.tempMessageId) {
              return {
                ...m,
                error: true,
                status: 'error',
                errorMessage: error.error || 'Failed to send message'
              };
            }
            return m;
          });
        });
      }
      
      setError(error.error || 'Error sending message');
    });
    listeners.push(errorListener);
    
    // Save listeners for cleanup
    listenerCleanupRef.current = listeners;
    
    // Initial load of messages
    loadMessages();
    
    // Mark conversation as read when opened
    chatService.markConversationRead(normalizedRecipientId);
    
    // Cleanup function
    return () => {
      // Clean up listeners when unmounting or recipientId changes
      if (listeners && listeners.length) {
        listeners.forEach(cleanup => {
          if (typeof cleanup === 'function') {
            cleanup();
          }
        });
      }
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [normalizedRecipientId, isAuthenticated, user, initialized]);

  /**
   * Load messages for the current conversation
   * @param {boolean} forceRefresh - Whether to force a fresh load
   * @returns {Promise<Array>} - Loaded messages
   */
  const loadMessages = useCallback(async (forceRefresh = false) => {
    // Check for required data
    if (!normalizedRecipientId || !isAuthenticated || !user?._id || !initialized) {
      log.warn('Cannot load messages: Missing required data');
      return [];
    }
    
    // Skip if already loading and not forcing refresh
    if (loading && !forceRefresh) {
      log.debug('Already loading messages, skipping duplicate request');
      return messagesRef.current;
    }
    
    // Set loading state
    setLoading(true);
    setError(null);
    
    // Safety timeout to prevent stuck loading state
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    
    loadingTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current && loading) {
        log.warn('Message loading timeout reached');
        setLoading(false);
        setError('Loading timed out. Please try again.');
        
        // Return empty messages array rather than hanging
        return [];
      }
    }, 10000); // Reduced to 10 seconds for better user experience
    
    try {
      log.debug(`Loading messages for conversation with ${normalizedRecipientId}`);
      
      // Try to get messages, with retry on failure
      let loadedMessages;
      try {
        loadedMessages = await chatService.getMessages(normalizedRecipientId, 1, 20);
      } catch (firstError) {
        log.warn('First attempt to load messages failed, retrying:', firstError);
        
        // Wait a moment before retry
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Try again
        loadedMessages = await chatService.getMessages(normalizedRecipientId, 1, 20);
      }
      
      // Clear the timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      
      // Skip updates if unmounted
      if (!mountedRef.current) return [];
      
      // Ensure we have an array, even if empty
      const messages = Array.isArray(loadedMessages) ? loadedMessages : [];
      
      // Reverse the order so newest messages are at the bottom
      // Also, deduplicate messages by ID to prevent triplication
      const uniqueMessages = [];
      const seenIds = new Set();
      
      // Process messages to deduplicate
      [...messages].reverse().forEach(msg => {
        // Only add if we haven't seen this ID before
        if (msg._id && !seenIds.has(msg._id)) {
          uniqueMessages.push(msg);
          seenIds.add(msg._id);
        }
      });
      
      // Update state with unique messages
      setMessages(uniqueMessages);
      setHasMore(uniqueMessages.length >= 20);
      setPage(1);
      setLoading(false);
      
      log.debug(`Loaded ${messages.length} messages`);
      return messages;
    } catch (error) {
      log.error('Failed to load messages:', error);
      
      // Clear the timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      
      // Skip updates if unmounted
      if (!mountedRef.current) return [];
      
      // Update error state
      setError(error.message || 'Failed to load messages');
      setLoading(false);
      
      return [];
    }
  }, [normalizedRecipientId, isAuthenticated, user, loading, initialized]);

  /**
   * Load more messages (pagination)
   * @returns {Promise<Array>} - Newly loaded messages
   */
  const loadMoreMessages = useCallback(async () => {
    // Check prerequisites
    if (!normalizedRecipientId || !isAuthenticated || loadingMore || !hasMore || !initialized) {
      return [];
    }
    
    setLoadingMore(true);
    
    try {
      const nextPage = page + 1;
      log.debug(`Loading more messages, page ${nextPage}`);
      
      const moreMessages = await chatService.getMessages(normalizedRecipientId, nextPage, 20);
      
      // Skip updates if unmounted
      if (!mountedRef.current) return [];
      
      // Handle non-array response
      const messages = Array.isArray(moreMessages) ? moreMessages : [];
      
      if (messages.length > 0) {
        setMessages(prev => {
          // Combine messages, avoiding duplicates
          const combined = [...prev];
          
          // Reverse the order of messages so oldest are first
          const reversedMessages = [...messages].reverse();
          
          reversedMessages.forEach(newMsg => {
            // Skip if already exists
            if (!combined.some(m => m._id === newMsg._id)) {
              combined.push(newMsg);
            }
          });
          
          // Don't sort - maintain chronological order (oldest first, newest last)
          return combined;
        });
        
        setPage(nextPage);
      }
      
      // Update pagination state
      setHasMore(messages.length >= 20);
      setLoadingMore(false);
      
      return messages;
    } catch (error) {
      log.error('Failed to load more messages:', error);
      
      // Skip updates if unmounted
      if (!mountedRef.current) return [];
      
      // Update error state
      setError(error.message || 'Failed to load more messages');
      setLoadingMore(false);
      
      return [];
    }
  }, [normalizedRecipientId, isAuthenticated, loadingMore, hasMore, page, initialized]);

  /**
   * Send a message to the recipient
   * @param {string} content - Message content
   * @param {string} type - Message type
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} - The sent message
   */
  const sendMessage = useCallback(async (content, type = 'text', metadata = null) => {
    // Validate prerequisites
    if (!normalizedRecipientId || !isAuthenticated || !user?._id || !initialized) {
      const errMsg = 'Cannot send message: Missing required data';
      log.error(errMsg);
      throw new Error(errMsg);
    }
    
    // Set sending state
    setSending(true);
    
    try {
      log.debug(`Sending ${type} message to ${normalizedRecipientId}`);
      
      // Create a temporary ID for optimistic UI updates
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      
      // Create a temporary message for optimistic UI update
      const tempMessage = {
        _id: tempId,
        tempId,
        sender: user._id,
        recipient: normalizedRecipientId,
        content,
        type,
        metadata: metadata || {},
        createdAt: new Date().toISOString(),
        status: 'sending',
        pending: true
      };
      
      // Update UI optimistically - add to the end for newest last
      // But first check if we already have a message with the same content to prevent duplication
      setMessages(prev => {
        // Prevent sending duplicate messages - check if we already have a message
        // with identical content sent within the last 5 seconds
        const now = new Date();
        const recentDuplicates = prev.filter(m => 
          m.content === tempMessage.content &&
          m.sender === tempMessage.sender &&
          m.recipient === tempMessage.recipient &&
          now - new Date(m.createdAt) < 5000 // Within the last 5 seconds
        );
        
        if (recentDuplicates.length > 0) {
          log.debug("Skipping duplicate message send - already have same content");
          return prev;
        }
        
        return [...prev, tempMessage];
      });
      
      // Send the actual message
      const message = await chatService.sendMessage(
        normalizedRecipientId, 
        content, 
        type, 
        metadata,
        tempId
      );
      
      // Skip updates if unmounted
      if (!mountedRef.current) return message;
      
      // Update the message in the UI
      setMessages(prev => {
        // Find the temp message
        const index = prev.findIndex(m => 
          m.tempId === tempId || m._id === message._id
        );
        
        if (index >= 0) {
          // Replace temp message with real one
          const updated = [...prev];
          updated[index] = {
            ...message,
            tempId,
            status: 'sent',
            pending: false
          };
          return updated;
        }
        
        // Don't add as new if not found - prevent duplication
        log.debug("Message with tempId not found - this shouldn't happen normally");
        return prev;
      });
      
      // Reset sending state
      setSending(false);
      
      return message;
    } catch (error) {
      log.error('Failed to send message:', error);
      
      // Skip updates if unmounted
      if (!mountedRef.current) throw error;
      
      // Update error state
      setError(error.message || 'Failed to send message');
      setSending(false);
      
      throw error;
    }
  }, [normalizedRecipientId, isAuthenticated, user, initialized]);

  /**
   * Send typing indicator to recipient
   */
  const sendTyping = useCallback(() => {
    if (normalizedRecipientId && isAuthenticated && initialized && chatService.isConnected()) {
      chatService.sendTypingIndicator(normalizedRecipientId);
    }
  }, [normalizedRecipientId, isAuthenticated, initialized]);

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

  // Return the hook API
  return {
    // State
    messages,
    loading,
    sending,
    error,
    hasMore,
    typingStatus,
    isConnected,
    initialized,
    
    // Actions
    loadMessages,
    loadMoreMessages,
    sendMessage,
    sendTyping,
    refresh,
    resetError
  };
};

// Export the hook as default
export default useChat;