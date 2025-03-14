// client/src/context/ChatContext.js
import React, { createContext, useReducer, useContext, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import apiService from '../services/apiService';
import socketService from '../services/socketService';
import { useAuth } from './AuthContext';

// Create chat context
const ChatContext = createContext();

/**
 * Chat reducer to handle chat state changes
 * @param {Object} state - Current chat state
 * @param {Object} action - Dispatch action
 * @returns {Object} - New chat state
 */
const chatReducer = (state, action) => {
  switch (action.type) {
    case 'GET_MESSAGES':
      return { ...state, messages: action.payload, loading: false };
    case 'SEND_MESSAGE':
      return {
        ...state,
        messages: [action.payload, ...state.messages],
        sendingMessage: false
      };
    case 'SENDING_MESSAGE':
      return { ...state, sendingMessage: true };
    case 'RECEIVE_MESSAGE':
      if (
        (state.currentChat && action.payload.sender === state.currentChat._id) ||
        (state.currentChat && action.payload.recipient === state.currentChat._id)
      ) {
        return { ...state, messages: [action.payload, ...state.messages] };
      }
      return { ...state, unreadMessages: [...state.unreadMessages, action.payload] };
    case 'SET_CURRENT_CHAT':
      return {
        ...state,
        currentChat: action.payload,
        unreadMessages: state.unreadMessages.filter(msg => msg.sender !== action.payload?._id),
        messageError: null
      };
    case 'USER_TYPING':
      return {
        ...state,
        typingUsers: { ...state.typingUsers, [action.payload.userId]: Date.now() }
      };
    case 'USER_ONLINE':
      return { ...state, userOnline: action.payload };
    case 'USER_OFFLINE':
      return { ...state, userOffline: action.payload };
    case 'INCOMING_CALL':
      toast.info(`Incoming call from ${action.payload.userId}`);
      return { ...state, incomingCall: action.payload };
    case 'CALL_ANSWERED':
      return { ...state, callAnswered: action.payload };
    case 'END_CALL':
      return { ...state, incomingCall: null, callAnswered: null };
    case 'CHAT_ERROR':
      toast.error(action.payload);
      return { ...state, error: action.payload, sendingMessage: false };
    case 'MESSAGE_ERROR':
      return { ...state, messageError: action.payload, sendingMessage: false };
    case 'CLEAR_ERROR':
      return { ...state, error: null, messageError: null };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
};

/**
 * Chat provider component
 */
export const ChatProvider = ({ children }) => {
  const initialState = {
    messages: [],
    unreadMessages: [],
    currentChat: null,
    typingUsers: {},
    incomingCall: null,
    callAnswered: null,
    loading: false,
    sendingMessage: false,
    error: null,
    messageError: null,
  };

  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { user, token } = useAuth();

  // Use refs to track socket event handlers for cleanup
  const eventHandlers = useRef({});

  // Initialize socket connection when user is authenticated
  useEffect(() => {
    if (user && token) {
      // Initialize socket connection
      socketService.init(user._id, token);

      // Set up socket event listeners
      const newMessageHandler = (message) => {
        dispatch({ type: 'RECEIVE_MESSAGE', payload: message });

        // Show notification if it's not from current chat
        if (state.currentChat && message.sender !== state.currentChat._id) {
          // Get sender nickname if available
          const senderName = message.senderName || 'Someone';
          toast.info(`New message from ${senderName}`);
        }
      };

      const userOnlineHandler = (data) => {
        dispatch({ type: 'USER_ONLINE', payload: data });
      };

      const userOfflineHandler = (data) => {
        dispatch({ type: 'USER_OFFLINE', payload: data });
      };

      const userTypingHandler = (data) => {
        dispatch({ type: 'USER_TYPING', payload: data });
      };

      const incomingCallHandler = (data) => {
        dispatch({ type: 'INCOMING_CALL', payload: data });
      };

      const callAnsweredHandler = (data) => {
        dispatch({ type: 'CALL_ANSWERED', payload: data });
      };

      const errorHandler = (error) => {
        dispatch({ type: 'CHAT_ERROR', payload: error.message || 'Socket error' });
      };

      // Store handlers in ref for cleanup
      eventHandlers.current = {
        newMessage: newMessageHandler,
        userOnline: userOnlineHandler,
        userOffline: userOfflineHandler,
        userTyping: userTypingHandler,
        incomingCall: incomingCallHandler,
        callAnswered: callAnsweredHandler,
        error: errorHandler
      };

      // Register event handlers
      socketService.on('newMessage', newMessageHandler);
      socketService.on('userOnline', userOnlineHandler);
      socketService.on('userOffline', userOfflineHandler);
      socketService.on('userTyping', userTypingHandler);
      socketService.on('incomingCall', incomingCallHandler);
      socketService.on('callAnswered', callAnsweredHandler);
      socketService.on('error', errorHandler);

      // Clean up function
      return () => {
        // Remove all handlers
        Object.entries(eventHandlers.current).forEach(([event, handler]) => {
          socketService.off(event, handler);
        });
      };
    }
  }, [user, token, state.currentChat]); // Added state.currentChat as a dependency

  // Additional cleanup for component unmount
  useEffect(() => {
    return () => {
      // This ensures we clean up when the provider is unmounted
      if (user) {
        Object.entries(eventHandlers.current).forEach(([event, handler]) => {
          socketService.off(event, handler);
        });
      }
    };
  }, [user]);

  /**
   * Get message history with a specific user
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  const getMessages = async (userId) => {
    if (!userId) return;

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const data = await apiService.get(`/messages/${userId}`);

    if (data.success) {
      // Sort messages by date descending
      const sortedMessages = data.data.sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      dispatch({ type: 'GET_MESSAGES', payload: sortedMessages });
    }
    } catch (err) {
      const errorMsg = err.error || err.message || 'Failed to fetch messages';
      dispatch({ type: 'CHAT_ERROR', payload: errorMsg });
    }
  };

  /**
   * Send a message to a user
   * @param {string} recipient - Recipient user ID
   * @param {string} type - Message type (text, wink, video)
   * @param {string} content - Message content
   * @returns {Promise<Object|null>} - Sent message or null if failed
   */
  const sendMessage = async (recipient, type, content) => {
    dispatch({ type: 'SENDING_MESSAGE' });

    try {
      // First send through API
      const data = await apiService.post('/messages', { recipient, type, content });

      if (!data.success) {
        throw new Error(data.error || 'Failed to send message');
      }

      const message = data.data;

      // Then emit through socket for real-time delivery
      try {
        await socketService.sendMessage(recipient, type, content);
      } catch (socketErr) {
        console.warn('Socket delivery failed, but message is saved:', socketErr);
        // Don't throw here - the message was saved, just not delivered in real-time
      }

      dispatch({ type: 'SEND_MESSAGE', payload: message });
      return message;
    } catch (err) {
      const errorMsg = err.error || err.message || 'Failed to send message';
      dispatch({ type: 'MESSAGE_ERROR', payload: errorMsg });
      return null;
    }
  };

  /**
   * Set current chat user
   * @param {Object} user - User to chat with
   */
  const setCurrentChat = (user) => {
    dispatch({ type: 'SET_CURRENT_CHAT', payload: user });

    // If user is set, fetch messages
    if (user && user._id) {
      getMessages(user._id);
    }
  };

  /**
   * Send typing indicator to a user
   * @param {string} recipient - Recipient user ID
   */
  const sendTyping = (recipient) => {
    if (!recipient) return;
    socketService.sendTyping(recipient);
  };

  /**
   * Initiate a video call with a user
   * @param {string} recipient - Recipient user ID
   * @returns {Promise<void>}
   */
  const initiateVideoCall = async (recipient) => {
    try {
      await socketService.initiateVideoCall(recipient);
      toast.info('Calling...');
    } catch (err) {
      toast.error('Could not initiate call. Please try again.');
      dispatch({ type: 'CHAT_ERROR', payload: err.message || 'Failed to initiate call' });
    }
  };

  /**
   * Answer a video call
   * @param {string} caller - Caller user ID
   * @param {boolean} answer - Accept or decline the call
   * @returns {Promise<void>}
   */
  const answerVideoCall = async (caller, answer) => {
    try {
      await socketService.answerVideoCall(caller, answer);

      if (answer) {
        toast.success('Call accepted');
      } else {
        toast.info('Call declined');
        dispatch({ type: 'END_CALL' });
      }
    } catch (err) {
      toast.error('Could not answer call. Please try again.');
      dispatch({ type: 'CHAT_ERROR', payload: err.message || 'Failed to answer call' });
    }
  };

  /**
   * End an ongoing call
   */
  const endCall = () => {
    dispatch({ type: 'END_CALL' });
    toast.info('Call ended');
  };

  /**
   * Clear error state
   */
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Check for unread messages count
  const unreadMessagesCount = state.unreadMessages.length;

  return (
    <ChatContext.Provider
      value={{
        messages: state.messages,
        unreadMessages: state.unreadMessages,
        unreadMessagesCount,
        currentChat: state.currentChat,
        typingUsers: state.typingUsers,
        incomingCall: state.incomingCall,
        callAnswered: state.callAnswered,
        loading: state.loading,
        sendingMessage: state.sendingMessage,
        error: state.error,
        messageError: state.messageError,
        getMessages,
        sendMessage,
        setCurrentChat,
        sendTyping,
        initiateVideoCall,
        answerVideoCall,
        endCall,
        clearError,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

/**
 * Custom hook to use chat context
 * @returns {Object} - Chat context
 */
export const useChat = () => {
  const context = useContext(ChatContext);

  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }

  return context;
};
