import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useApi } from './useApi';
import { useSocketConnection } from './useSocketConnection';
import { useAuth } from '../context/AuthContext';
import { logger } from '../utils';

const log = logger.create('useChatMessages');

// Helper function to create a temp ID for optimistic updates
const generateTempId = () => `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

/**
 * Custom hook for managing chat messages with a specific recipient
 * 
 * Provides comprehensive chat functionality including:
 * - Loading and managing message history
 * - Sending and receiving messages in real-time
 * - File message handling and uploads
 * - Typing indicators
 * - Read receipts
 * - Error handling
 * - Socket connection management
 * 
 * The hook manages both the connection to the server API and socket.io
 * for real-time messaging. It provides optimistic UI updates for message sending
 * and automatically handles reconnection and message synchronization.
 * 
 * @param {string} recipientId - MongoDB ID of the recipient user
 * @returns {Object} Chat methods and state object containing:
 *   @property {Array} messages - Array of message objects
 *   @property {boolean} loading - Whether messages are currently loading
 *   @property {string|null} error - Error message if any
 *   @property {boolean} isTyping - Whether the recipient is currently typing
 *   @property {Function} sendMessage - Function to send a text message
 *   @property {Function} sendTypingIndicator - Function to send typing indicator
 *   @property {Function} markMessagesAsRead - Function to mark messages as read
 *   @property {Function} loadMessages - Function to manually load/refresh messages
 *   @property {Function} clearError - Function to clear any error state
 *   @property {Function} sendFileMessage - Function to send a file message
 */
export const useChatMessages = (recipientId) => {
  const { user } = useAuth();
  const api = useApi();
  const { connected, on, emit } = useSocketConnection({
    userId: user?._id,
    token: localStorage.getItem('token')
  });
  
  // Message state
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [typingIndicator, setTypingIndicator] = useState(false);
  
  // Refs for tracking
  const typingTimeoutRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const messagesInitializedRef = useRef(false);
  const fetchingRef = useRef(false); // Track if a fetch is in progress
  const lastFetchTimeRef = useRef(0); // Track when last fetch occurred
  
  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  // Load messages for the current recipient
  const loadMessages = useCallback(async () => {
    if (!recipientId || !user) {
      log.debug('Cannot load messages: missing recipientId or user');
      return [];
    }
    
    // Prevent duplicate API calls
    if (fetchingRef.current) {
      log.debug('Skipping message fetch - already in progress');
      return [];
    }
    
    // Add cooldown to prevent hammering the API
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    const minFetchInterval = 5000; // 5 seconds minimum between fetches
    
    if (timeSinceLastFetch < minFetchInterval) {
      log.debug(`Skipping message fetch - cooldown period (${Math.round((minFetchInterval - timeSinceLastFetch)/1000)}s remaining)`);
      return [];
    }
    
    // Set flags to prevent duplicate calls
    fetchingRef.current = true;
    lastFetchTimeRef.current = now;
    setLoading(true);
    setError(null);
    
    try {
      log.debug(`Fetching messages for recipient ${recipientId}`);
      const response = await api.get(`/messages/${recipientId}`);
      
      if (!response) {
        log.warn(`No response received when fetching messages for recipient ${recipientId}`);
        return [];
      }
      
      if (response.error) {
        throw new Error(response.error || 'Failed to load messages');
      }
      
      // Sort messages by timestamp
      const sortedMessages = Array.isArray(response) 
        ? [...response].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        : [];
      
      log.debug(`Loaded ${sortedMessages.length} messages with ${recipientId}`);
      setMessages(sortedMessages);
      messagesInitializedRef.current = true;
      
      // Track last message ID
      if (sortedMessages.length > 0) {
        lastMessageIdRef.current = sortedMessages[sortedMessages.length - 1]._id;
      }
      
      // Mark unread messages as read
      const unreadMessages = sortedMessages.filter(
        msg => msg.recipient === user._id && !msg.read
      );
      if (unreadMessages.length > 0) {
        markMessagesAsRead(unreadMessages.map(msg => msg._id));
      }
      
      return sortedMessages;
    } catch (err) {
      const errorMsg = err.message || 'Failed to load messages';
      log.error(`Error loading messages: ${errorMsg}`);
      setError(errorMsg);
      return [];
    } finally {
      setLoading(false);
      // Clear the fetching flag after a delay to prevent immediate re-fetching
      setTimeout(() => {
        fetchingRef.current = false;
      }, 1000);
    }
  }, [recipientId, user, api]);
  
  // Send a text message
  const sendMessage = useCallback(async (content, type = 'text', metadata = {}) => {
    if (!recipientId || !user) {
      log.error('Cannot send message: missing recipientId or user');
      setError('Cannot send message: missing recipient or user');
      return null;
    }
    
    if (type === 'text' && (!content || !content.trim())) {
      log.error('Cannot send empty message');
      setError('Cannot send empty message');
      return null;
    }
    
    // Generate a temporary message ID for optimistic updates
    const tempId = generateTempId();
    
    // Create temporary message for optimistic UI
    const tempMessage = {
      _id: tempId,
      sender: user._id,
      recipient: recipientId,
      content: content.trim(),
      type,
      metadata: { ...metadata, tempId },
      createdAt: new Date().toISOString(),
      read: false,
      pending: true
    };
    
    // Add to UI immediately
    setMessages(prev => [...prev, tempMessage]);
    
    try {
      let response;
      
      // Try to send via socket first if connected
      if (connected) {
        try {
          log.debug('Sending message via socket');
          response = await new Promise((resolve, reject) => {
            emit('sendMessage', {
              recipient: recipientId,
              content: content.trim(),
              type,
              metadata: { ...metadata, tempId }
            }, (result) => {
              if (result && result.success) {
                resolve(result.data);
              } else {
                reject(new Error(result?.error || 'Failed to send message via socket'));
              }
            });
            
            // Set a timeout in case socket doesn't respond
            setTimeout(() => {
              reject(new Error('Socket message timeout'));
            }, 5000);
          });
        } catch (socketErr) {
          log.warn('Socket message failed, falling back to API', socketErr);
          // Continue to API fallback
        }
      }
      
      // If socket failed or not connected, use API
      if (!response) {
        log.debug('Sending message via API');
        const apiResponse = await api.post('/messages', {
          recipient: recipientId,
          content: content.trim(),
          type,
          metadata: { ...metadata, tempId }
        });
        
        if (apiResponse) {
          response = apiResponse;
        } else {
          throw new Error('Failed to send message via API');
        }
      }
      
      // Update the temporary message with the real message data
      setMessages(prev => 
        prev.map(msg => 
          msg._id === tempId || (msg.metadata?.tempId === tempId) 
            ? { ...response, pending: false } 
            : msg
        )
      );
      
      // Update last message ID
      lastMessageIdRef.current = response._id;
      
      return response;
    } catch (err) {
      const errorMsg = err.message || 'Failed to send message';
      log.error(`Error sending message: ${errorMsg}`);
      setError(errorMsg);
      
      // Mark the temporary message as failed
      setMessages(prev => 
        prev.map(msg => 
          msg._id === tempId || (msg.metadata?.tempId === tempId)
            ? { ...msg, error: true, pending: false }
            : msg
        )
      );
      
      return null;
    }
  }, [recipientId, user, connected, emit, api]);
  
  // Send a typing indicator
  const sendTypingIndicator = useCallback(() => {
    if (!recipientId || !user || !connected) return;
    
    // Clear existing timeout if there is one
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Send typing event
    emit('typing', { recipientId });
    
    // Set a timeout to clear typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 3000);
  }, [recipientId, user, connected, emit]);
  
  // Mark messages as read
  const markMessagesAsRead = useCallback((messageIds) => {
    if (!Array.isArray(messageIds) || messageIds.length === 0 || !user || !recipientId) {
      return;
    }
    
    log.debug(`Marking ${messageIds.length} messages as read`);
    
    // Update local state first for optimistic UI
    setMessages(prev => 
      prev.map(msg => 
        messageIds.includes(msg._id) ? { ...msg, read: true } : msg
      )
    );
    
    // Send read status via socket if connected
    if (connected) {
      emit('messageRead', {
        reader: user._id,
        sender: recipientId,
        messageIds
      });
    }
    
    // Also update via API for persistence
    api.post('/messages/read', { messageIds })
      .catch(err => {
        log.error('Error marking messages as read:', err);
      });
  }, [user, recipientId, connected, emit, api]);
  
  // The socket handlers are now centralized in the registerSocketHandlers function
  // and automatically registered when the component mounts or the recipient changes
  
  // Setup message handlers (but don't register them yet)
  const messageHandlers = useMemo(() => {
    // Message received handler
    const handleMessageReceived = (message) => {
      // Make sure this message is relevant to this chat
      if (!message || 
          !user || 
          !recipientId ||
          (message.sender !== recipientId && message.sender._id !== recipientId) ||
          (message.recipient !== user._id && message.recipient._id !== user._id)) {
        return;
      }
      
      log.debug('Received new message:', message);
      
      // Check if we already have this message
      setMessages(prev => {
        // Normalize IDs for comparison
        const senderId = typeof message.sender === 'object' ? message.sender._id : message.sender;
        const recipientId = typeof message.recipient === 'object' ? message.recipient._id : message.recipient;
        
        // Skip if message already exists
        if (prev.some(m => m._id === message._id)) {
          return prev;
        }
        
        // If this is an update to a temp message, replace it
        if (message.metadata?.tempId) {
          const updatedMessages = prev.map(m => 
            (m.metadata?.tempId === message.metadata.tempId) 
              ? { ...message, pending: false } 
              : m
          );
          
          // If we didn't replace any message, add it as new
          if (JSON.stringify(updatedMessages) === JSON.stringify(prev)) {
            return [...prev, message].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          }
          
          return updatedMessages;
        }
        
        // Add new message
        return [...prev, message].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      });
      
      // Mark message as read if it's from the other user and we have the required dependencies
      try {
        if ((message.sender === recipientId || message.sender._id === recipientId) && 
            user && typeof markMessagesAsRead === 'function') {
          markMessagesAsRead([message._id]);
        }
      } catch (err) {
        log.warn('Error marking message as read:', err);
      }
    };
    
    // Typing indicator handler
    const handleTyping = (data) => {
      // Skip if not from current recipient
      if (!data || !recipientId || data.sender !== recipientId) {
        return;
      }
      
      log.debug('Recipient is typing');
      
      // Show typing indicator
      setTypingIndicator(true);
      
      // Clear after delay
      setTimeout(() => {
        setTypingIndicator(false);
      }, 3000);
    };
    
    // Message read handler
    const handleMessageRead = (data) => {
      if (!data || !data.messageIds || !Array.isArray(data.messageIds) || !recipientId) {
        return;
      }
      
      // Only update if the reader is the recipient of this chat
      if (data.reader !== recipientId) {
        return;
      }
      
      log.debug(`Messages marked as read by recipient: ${data.messageIds.length} messages`);
      
      // Update read status in our messages
      setMessages(prev => 
        prev.map(msg => 
          data.messageIds.includes(msg._id) ? { ...msg, read: true } : msg
        )
      );
    };
    
    return {
      handleMessageReceived,
      handleTyping,
      handleMessageRead
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, recipientId]); // Deliberately exclude markMessagesAsRead to prevent circular dependencies
  
  // Register socket event handlers in a separate useEffect
  useEffect(() => {
    if (!user || !recipientId || !connected || !on) {
      return () => {};
    }
    
    log.debug(`Registering socket handlers for chat with ${recipientId}`);
    
    // Register handlers
    const unregisterMessageReceived = on('messageReceived', messageHandlers.handleMessageReceived);
    const unregisterTyping = on('userTyping', messageHandlers.handleTyping);
    const unregisterMessageRead = on('messageRead', messageHandlers.handleMessageRead);
    
    // Return cleanup function
    return () => {
      unregisterMessageReceived();
      unregisterTyping();
      unregisterMessageRead();
      log.debug(`Unregistered socket handlers for chat with ${recipientId}`);
    };
  }, [user, recipientId, connected, on, messageHandlers]);
  
  // Load messages when recipient changes
  useEffect(() => {
    // Skip if we don't have both user and recipient
    if (!recipientId || !user) return;
    
    // Reset state when recipient changes
    setMessages([]);
    messagesInitializedRef.current = false;
    fetchingRef.current = false;
    lastFetchTimeRef.current = 0; // Reset the cooldown timer
    
    log.debug(`Recipient changed to ${recipientId}, loading messages`);
    loadMessages();
    
    // No need to register socket handlers here, that's handled by separate useEffect
    
    // Reset when component unmounts or recipient changes
    return () => {
      if (recipientId) {
        log.debug(`Clearing state for recipient ${recipientId}`);
      }
      messagesInitializedRef.current = false;
    };
  }, [recipientId, user?._id]); // Deliberately exclude loadMessages to prevent infinite loop
  
  // Handle component unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);
  
  // Send a file message
  const sendFileMessage = useCallback(async (file, onProgress) => {
    if (!recipientId || !user) {
      log.error('Cannot send file: missing recipientId or user');
      setError('Cannot send file: missing recipient or user');
      return null;
    }
    
    if (!file) {
      log.error('Cannot send file: no file provided');
      setError('Cannot send file: no file provided');
      return null;
    }
    
    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      const errorMsg = 'File is too large. Maximum size is 5MB.';
      log.error(errorMsg);
      setError(errorMsg);
      return null;
    }
    
    // Validate file type
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
      const errorMsg = 'File type not supported.';
      log.error(errorMsg);
      setError(errorMsg);
      return null;
    }
    
    // Generate a temporary message ID for optimistic updates
    const tempId = generateTempId();
    
    // Create temporary message for optimistic UI
    const tempMessage = {
      _id: tempId,
      sender: user._id,
      recipient: recipientId,
      content: 'Sending file...',
      type: 'file',
      metadata: {
        tempId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      },
      createdAt: new Date().toISOString(),
      read: false,
      pending: true
    };
    
    // Add to UI immediately
    setMessages(prev => [...prev, tempMessage]);
    
    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('recipientId', recipientId);
      formData.append('tempId', tempId);
      
      // Upload the file
      const response = await api.upload('/messages/file', formData, onProgress);
      
      if (!response) {
        throw new Error('File upload failed');
      }
      
      log.debug('File sent successfully');
      
      // Update the temporary message with the real message data
      setMessages(prev => 
        prev.map(msg => 
          msg._id === tempId || (msg.metadata?.tempId === tempId) 
            ? { ...response, pending: false } 
            : msg
        )
      );
      
      // Update last message ID if response has an ID
      if (response._id) {
        lastMessageIdRef.current = response._id;
      }
      
      return response;
    } catch (err) {
      const errorMsg = err.message || 'Failed to send file';
      log.error(`Error sending file: ${errorMsg}`);
      setError(errorMsg);
      
      // Mark the temporary message as failed
      setMessages(prev => 
        prev.map(msg => 
          msg._id === tempId || (msg.metadata?.tempId === tempId)
            ? { ...msg, error: true, pending: false }
            : msg
        )
      );
      
      return null;
    }
  }, [recipientId, user, api]);
  
  return {
    messages,
    loading,
    error,
    isTyping: typingIndicator,
    sendMessage,
    sendTypingIndicator,
    markMessagesAsRead,
    loadMessages,
    clearError,
    sendFileMessage
  };
};

export default useChatMessages;