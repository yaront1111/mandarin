"use client"

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import chatService from "../services/ChatService";
import logger from "../utils/logger";
import { SOCKET, TIMEOUTS, CACHE } from "../config";

const log = logger.create("ChatContext");

// Initial state
const initialState = {
  conversations: [],
  messages: [],
  activeConversation: null,
  loading: false,
  sending: false,
  error: null,
  hasMore: true,
  page: 1,
  loadingMore: false,
  typingStatus: false,
  initialized: false,
  isConnected: false,
};

// Action types
const ACTIONS = {
  INIT_START: "INIT_START",
  INIT_SUCCESS: "INIT_SUCCESS",
  INIT_ERROR: "INIT_ERROR",
  SET_CONVERSATIONS: "SET_CONVERSATIONS",
  SET_ACTIVE_CONVERSATION: "SET_ACTIVE_CONVERSATION",
  SET_MESSAGES: "SET_MESSAGES",
  ADD_MESSAGE: "ADD_MESSAGE",
  UPDATE_MESSAGE: "UPDATE_MESSAGE",
  LOAD_START: "LOAD_START",
  LOAD_SUCCESS: "LOAD_SUCCESS",
  LOAD_ERROR: "LOAD_ERROR",
  LOAD_MORE_START: "LOAD_MORE_START",
  LOAD_MORE_SUCCESS: "LOAD_MORE_SUCCESS",
  LOAD_MORE_ERROR: "LOAD_MORE_ERROR",
  SENDING_START: "SENDING_START",
  SENDING_SUCCESS: "SENDING_SUCCESS",
  SENDING_ERROR: "SENDING_ERROR",
  SET_TYPING: "SET_TYPING",
  SET_CONNECTION: "SET_CONNECTION",
  RESET_ERROR: "RESET_ERROR",
  RESET: "RESET",
};

// Reducer function
function chatReducer(state, action) {
  switch (action.type) {
    case ACTIONS.INIT_START:
      return { ...state, loading: true, error: null };
    case ACTIONS.INIT_SUCCESS:
      return { ...state, initialized: true, loading: false };
    case ACTIONS.INIT_ERROR:
      return { ...state, loading: false, error: action.payload, initialized: true };
    case ACTIONS.SET_CONVERSATIONS:
      return { ...state, conversations: action.payload };
    case ACTIONS.SET_ACTIVE_CONVERSATION:
      return { ...state, activeConversation: action.payload };
    case ACTIONS.SET_MESSAGES:
      return { ...state, messages: action.payload };
    case ACTIONS.ADD_MESSAGE:
      // Check for duplicates by _id or tempId
      const exists = state.messages.some(
        m => m._id === action.payload._id || 
        (action.payload.tempId && m.tempId === action.payload.tempId)
      );
      if (exists) return state;
      
      // Add message and sort by createdAt
      return { 
        ...state, 
        messages: [...state.messages, action.payload].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        )
      };
    case ACTIONS.UPDATE_MESSAGE:
      return {
        ...state,
        messages: state.messages.map(m => 
          m._id === action.payload._id || m.tempId === action.payload.tempId
            ? { ...m, ...action.payload, updated: true }
            : m
        )
      };
    case ACTIONS.LOAD_START:
      return { ...state, loading: true, error: null };
    case ACTIONS.LOAD_SUCCESS:
      return { 
        ...state, 
        loading: false, 
        messages: action.payload, 
        hasMore: action.payload.length >= 20,
        page: 1
      };
    case ACTIONS.LOAD_ERROR:
      return { ...state, loading: false, error: action.payload };
    case ACTIONS.LOAD_MORE_START:
      return { ...state, loadingMore: true };
    case ACTIONS.LOAD_MORE_SUCCESS:
      return {
        ...state,
        loadingMore: false,
        messages: action.combined,
        hasMore: action.payload.length >= 20,
        page: state.page + 1
      };
    case ACTIONS.LOAD_MORE_ERROR:
      return { ...state, loadingMore: false, error: action.payload };
    case ACTIONS.SENDING_START:
      return { ...state, sending: true };
    case ACTIONS.SENDING_SUCCESS:
      return { ...state, sending: false };
    case ACTIONS.SENDING_ERROR:
      return { ...state, sending: false, error: action.payload };
    case ACTIONS.SET_TYPING:
      return { ...state, typingStatus: action.payload };
    case ACTIONS.SET_CONNECTION:
      return { ...state, isConnected: action.payload };
    case ACTIONS.RESET_ERROR:
      return { ...state, error: null };
    case ACTIONS.RESET:
      return initialState;
    default:
      return state;
  }
}

// Create context
const ChatContext = createContext();

// Create provider component
export function ChatProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [state, dispatch] = useReducer(chatReducer, initialState);
  
  // Refs
  const typingTimeoutRef = useRef(null);
  const mountedRef = useRef(true);
  const listenerCleanupRef = useRef(null);
  
  // Initialize chat service
  useEffect(() => {
    mountedRef.current = true;
    
    const initializeChat = async () => {
      if (!isAuthenticated || !user?._id) return;
      
      dispatch({ type: ACTIONS.INIT_START });
      
      try {
        log.info("Initializing chat service...");
        await chatService.initialize(user);
        
        if (mountedRef.current) {
          dispatch({ type: ACTIONS.INIT_SUCCESS });
          dispatch({ type: ACTIONS.SET_CONNECTION, payload: chatService.isConnected() });
        }
        
        // Register global chat event listeners
        setupGlobalListeners();
      } catch (error) {
        log.error("Failed to initialize chat service:", error);
        
        if (mountedRef.current) {
          dispatch({ 
            type: ACTIONS.INIT_ERROR, 
            payload: error.message || "Failed to initialize chat" 
          });
        }
      }
    };
    
    initializeChat();
    
    return () => {
      mountedRef.current = false;
      
      // Clean up all event listeners
      if (listenerCleanupRef.current) {
        listenerCleanupRef.current.forEach(cleanup => {
          if (typeof cleanup === 'function') {
            cleanup();
          }
        });
      }
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [isAuthenticated, user]);
  
  // Set up global chat listeners (these apply to all conversations)
  const setupGlobalListeners = useCallback(() => {
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
    
    // Listen for connection status changes
    const connectionListener = chatService.on('connectionChanged', ({ connected }) => {
      if (!mountedRef.current) return;
      
      dispatch({ type: ACTIONS.SET_CONNECTION, payload: connected });
    });
    listeners.push(connectionListener);
    
    // Save listeners for cleanup
    listenerCleanupRef.current = listeners;
  }, []);
  
  // Setup event listeners for the active conversation
  useEffect(() => {
    if (!state.activeConversation || !isAuthenticated || !user?._id || !state.initialized) {
      return;
    }
    
    const recipientId = state.activeConversation;
    
    // Clear previous conversation-specific listeners
    if (listenerCleanupRef.current) {
      // Filter out global listeners (like connectionChanged) and keep them
      const globalListeners = listenerCleanupRef.current.filter(
        listener => typeof listener === 'object' && listener.isGlobal
      );
      
      // Clear other listeners
      listenerCleanupRef.current.forEach(cleanup => {
        if (typeof cleanup === 'function' && !cleanup.isGlobal) {
          cleanup();
        }
      });
      
      // Reset to keep only global listeners
      listenerCleanupRef.current = globalListeners;
    }
    
    // Create new conversation-specific listeners
    const listeners = [];
    
    // 1. Message updated listener 
    const updateListener = chatService.on('messageUpdated', (message) => {
      if (!mountedRef.current) return;
      
      dispatch({ type: ACTIONS.UPDATE_MESSAGE, payload: message });
    });
    listeners.push(updateListener);
    
    // 2. Message received listener
    const messageListener = chatService.on('messageReceived', (message) => {
      if (!mountedRef.current) return;
      
      // Only process messages for this conversation
      if (message.sender === recipientId && message.recipient === user._id) {
        log.debug(`Received message from ${recipientId}`);
        
        dispatch({ type: ACTIONS.ADD_MESSAGE, payload: message });
        
        // Mark conversation as read
        chatService.markConversationRead(recipientId);
      }
    });
    listeners.push(messageListener);
    
    // 3. Message sent confirmation listener
    const sentListener = chatService.on('messageSent', (message) => {
      if (!mountedRef.current) return;
      
      // Only handle messages for this conversation
      if (message.recipient === recipientId) {
        log.debug(`Message sent confirmation for ${recipientId}`);
        
        dispatch({ 
          type: ACTIONS.UPDATE_MESSAGE, 
          payload: {
            ...message,
            status: 'sent',
            pending: false
          }
        });
      }
    });
    listeners.push(sentListener);
    
    // 4. Typing indicator listener
    const typingListener = chatService.on('userTyping', (data) => {
      if (!mountedRef.current) return;
      
      if (data.userId === recipientId) {
        dispatch({ type: ACTIONS.SET_TYPING, payload: true });
        
        // Auto-clear typing indicator after 3 seconds
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        
        typingTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            dispatch({ type: ACTIONS.SET_TYPING, payload: false });
          }
        }, 3000);
      }
    });
    listeners.push(typingListener);
    
    // 5. Message error listener
    const errorListener = chatService.on('messageError', (error) => {
      if (!mountedRef.current) return;
      
      if (error.tempMessageId) {
        // Update the message with error status
        dispatch({ 
          type: ACTIONS.UPDATE_MESSAGE, 
          payload: {
            tempId: error.tempMessageId,
            error: true,
            status: 'error',
            errorMessage: error.error || 'Failed to send message'
          }
        });
      }
      
      dispatch({ 
        type: ACTIONS.SENDING_ERROR, 
        payload: error.error || 'Error sending message'
      });
    });
    listeners.push(errorListener);
    
    // Add conversation-specific listeners to the global listeners list
    if (listenerCleanupRef.current) {
      listenerCleanupRef.current = [...listenerCleanupRef.current, ...listeners];
    } else {
      listenerCleanupRef.current = listeners;
    }
    
    // Initial load of messages
    loadMessages(recipientId);
    
    // Mark conversation as read when opened
    chatService.markConversationRead(recipientId);
    
    return () => {
      // Clean up conversation-specific listeners
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
  }, [state.activeConversation, isAuthenticated, user, state.initialized]);
  
  // Function to load messages for a conversation
  const loadMessages = useCallback(async (recipientId, forceRefresh = false) => {
    if (!recipientId || !isAuthenticated || !user?._id || !state.initialized) {
      log.warn('Cannot load messages: Missing required data');
      return [];
    }
    
    if (state.loading && !forceRefresh) {
      log.debug('Already loading messages, skipping duplicate request');
      return state.messages;
    }
    
    dispatch({ type: ACTIONS.LOAD_START });
    
    try {
      log.debug(`Loading messages for conversation with ${recipientId}`);
      
      // Try to get messages, with retry on failure
      let loadedMessages;
      try {
        loadedMessages = await chatService.getMessages(recipientId, 1, 20);
      } catch (firstError) {
        log.warn('First attempt to load messages failed, retrying:', firstError);
        
        // Wait a moment before retry
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Try again
        loadedMessages = await chatService.getMessages(recipientId, 1, 20);
      }
      
      // Skip updates if unmounted
      if (!mountedRef.current) return [];
      
      // Ensure we have an array, even if empty
      const messages = Array.isArray(loadedMessages) ? loadedMessages : [];
      
      // Deduplicate messages by ID
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
      
      dispatch({ type: ACTIONS.LOAD_SUCCESS, payload: uniqueMessages });
      
      log.debug(`Loaded ${messages.length} messages`);
      return messages;
    } catch (error) {
      log.error('Failed to load messages:', error);
      
      // Skip updates if unmounted
      if (!mountedRef.current) return [];
      
      dispatch({ 
        type: ACTIONS.LOAD_ERROR, 
        payload: error.message || 'Failed to load messages'
      });
      
      return [];
    }
  }, [isAuthenticated, user, state.loading, state.initialized]);
  
  // Function to load more messages (pagination)
  const loadMoreMessages = useCallback(async () => {
    if (!state.activeConversation || !isAuthenticated || state.loadingMore || !state.hasMore || !state.initialized) {
      return [];
    }
    
    dispatch({ type: ACTIONS.LOAD_MORE_START });
    
    try {
      const nextPage = state.page + 1;
      log.debug(`Loading more messages, page ${nextPage}`);
      
      const moreMessages = await chatService.getMessages(state.activeConversation, nextPage, 20);
      
      // Skip updates if unmounted
      if (!mountedRef.current) return [];
      
      // Handle non-array response
      const messages = Array.isArray(moreMessages) ? moreMessages : [];
      
      if (messages.length > 0) {
        // Combine messages, avoiding duplicates
        const combined = [...state.messages];
        
        // Reverse the order of messages so oldest are first
        const reversedMessages = [...messages].reverse();
        
        reversedMessages.forEach(newMsg => {
          // Skip if already exists
          if (!combined.some(m => m._id === newMsg._id)) {
            combined.push(newMsg);
          }
        });
        
        dispatch({ 
          type: ACTIONS.LOAD_MORE_SUCCESS,
          payload: messages,
          combined
        });
      } else {
        dispatch({ 
          type: ACTIONS.LOAD_MORE_SUCCESS,
          payload: [],
          combined: state.messages
        });
      }
      
      return messages;
    } catch (error) {
      log.error('Failed to load more messages:', error);
      
      // Skip updates if unmounted
      if (!mountedRef.current) return [];
      
      dispatch({ 
        type: ACTIONS.LOAD_MORE_ERROR, 
        payload: error.message || 'Failed to load more messages'
      });
      
      return [];
    }
  }, [state.activeConversation, isAuthenticated, state.loadingMore, state.hasMore, state.page, state.initialized, state.messages]);
  
  // Function to send a message
  const sendMessage = useCallback(async (content, type = 'text', metadata = null) => {
    if (!state.activeConversation || !isAuthenticated || !user?._id || !state.initialized) {
      const errMsg = 'Cannot send message: Missing required data';
      log.error(errMsg);
      throw new Error(errMsg);
    }
    
    dispatch({ type: ACTIONS.SENDING_START });
    
    try {
      log.debug(`Sending ${type} message to ${state.activeConversation}`);
      
      // Create a temporary ID for optimistic UI updates
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      
      // Create a temporary message for optimistic UI update
      const tempMessage = {
        _id: tempId,
        tempId,
        sender: user._id,
        recipient: state.activeConversation,
        content,
        type,
        metadata: metadata || {},
        createdAt: new Date().toISOString(),
        status: 'sending',
        pending: true
      };
      
      // Prevent sending duplicate messages - check if we already have a message
      // with identical content sent within the last 5 seconds
      const now = new Date();
      const recentDuplicates = state.messages.filter(m => 
        m.content === tempMessage.content &&
        m.sender === tempMessage.sender &&
        m.recipient === tempMessage.recipient &&
        now - new Date(m.createdAt) < 5000 // Within the last 5 seconds
      );
      
      if (recentDuplicates.length > 0) {
        log.debug("Skipping duplicate message send - already have same content");
        dispatch({ type: ACTIONS.SENDING_SUCCESS });
        return null;
      }
      
      // Add to messages for optimistic UI update
      dispatch({ type: ACTIONS.ADD_MESSAGE, payload: tempMessage });
      
      // Send the actual message
      const message = await chatService.sendMessage(
        state.activeConversation, 
        content, 
        type, 
        metadata,
        tempId
      );
      
      // Skip updates if unmounted
      if (!mountedRef.current) return message;
      
      // Update message status
      dispatch({ 
        type: ACTIONS.UPDATE_MESSAGE, 
        payload: {
          ...message,
          tempId,
          status: 'sent',
          pending: false
        }
      });
      
      dispatch({ type: ACTIONS.SENDING_SUCCESS });
      
      return message;
    } catch (error) {
      log.error('Failed to send message:', error);
      
      // Skip updates if unmounted
      if (!mountedRef.current) throw error;
      
      dispatch({ 
        type: ACTIONS.SENDING_ERROR, 
        payload: error.message || 'Failed to send message'
      });
      
      throw error;
    }
  }, [state.activeConversation, isAuthenticated, user, state.initialized, state.messages]);
  
  // Function to fetch all conversations
  const getConversations = useCallback(async () => {
    if (!isAuthenticated || !user?._id || !state.initialized) {
      log.warn('Cannot fetch conversations: Not authenticated or initialized');
      return [];
    }
    
    try {
      log.debug("Fetching conversations");
      const conversations = await chatService.getConversations();
      
      if (!mountedRef.current) return [];
      
      if (Array.isArray(conversations)) {
        dispatch({ type: ACTIONS.SET_CONVERSATIONS, payload: conversations });
        return conversations;
      }
      
      return [];
    } catch (error) {
      log.error('Failed to fetch conversations:', error);
      return [];
    }
  }, [isAuthenticated, user, state.initialized]);
  
  // Function to set the active conversation
  const setActiveConversation = useCallback((recipientId) => {
    if (recipientId !== state.activeConversation) {
      dispatch({ type: ACTIONS.SET_ACTIVE_CONVERSATION, payload: recipientId });
    }
  }, [state.activeConversation]);
  
  // Function to send typing indicator
  const sendTyping = useCallback(() => {
    if (state.activeConversation && isAuthenticated && state.initialized && chatService.isConnected()) {
      chatService.sendTypingIndicator(state.activeConversation);
    }
  }, [state.activeConversation, isAuthenticated, state.initialized]);
  
  // Function to reset error state
  const resetError = useCallback(() => {
    dispatch({ type: ACTIONS.RESET_ERROR });
  }, []);
  
  // Function to manually refresh messages
  const refresh = useCallback(() => {
    if (state.activeConversation) {
      return loadMessages(state.activeConversation, true);
    }
    return Promise.resolve([]);
  }, [state.activeConversation, loadMessages]);
  
  // Provide the chat context value
  const value = {
    // State
    ...state,
    user, // Expose user for filtering
    isAuthenticated, // Expose auth status
    
    // Actions
    getConversations,
    setActiveConversation,
    loadMessages,
    loadMoreMessages,
    sendMessage,
    sendTyping,
    resetError,
    refresh
  };
  
  return (
    <ChatContext.Provider value={value}>
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