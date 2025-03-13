// client/src/context/ChatContext.js
import React, { createContext, useReducer, useContext, useEffect } from 'react';
import { toast } from 'react-toastify';
import apiService from '../services/apiService';
import socketService from '../services/socketService';
import { useAuth } from './AuthContext';

/**
 * @typedef {Object} ChatState
 * @property {Array} messages - List of messages
 * @property {Array} unreadMessages - List of unread messages
 * @property {Object|null} currentChat - Current selected chat user
 * @property {Object} typingUsers - Users who are currently typing
 * @property {Object|null} incomingCall - Incoming call information
 * @property {Object|null} callAnswered - Call answer information
 * @property {boolean} loading - Loading status
 * @property {string|null} error - Error message
 */

// Create chat context
const ChatContext = createContext();

/**
 * Chat reducer to handle chat state changes
 * @param {ChatState} state - Current chat state
 * @param {Object} action - Dispatch action
 * @returns {ChatState} - New chat state
 */
const chatReducer = (state, action) => {
  switch (action.type) {
    case 'GET_MESSAGES':
      return { ...state, messages: action.payload, loading: false };
    case 'SEND_MESSAGE':
      return { ...state, messages: [action.payload, ...state.messages] };
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
        unreadMessages: state.unreadMessages.filter(msg => msg.sender !== action.payload._id) 
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
      return { ...state, error: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
};

/**
 * Chat provider component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element} - Chat provider component
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
    error: null,
  };

  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { user, token } = useAuth();

  // Initialize socket connection when user is authenticated
  useEffect(() => {
    if (user && token) {
      // Initialize socket connection
      socketService.init(user._id, token);
      
      // Set up socket event listeners
      const newMessageHandler = (message) => {
        dispatch({ type: 'RECEIVE_MESSAGE', payload: message });
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
      
      // Register event handlers
      socketService.on('newMessage', newMessageHandler);
      socketService.on('userOnline', userOnlineHandler);
      socketService.on('userOffline', userOfflineHandler);
      socketService.on('userTyping', userTypingHandler);
      socketService.on('incomingCall', incomingCallHandler);
      socketService.on('callAnswered', callAnsweredHandler);
      socketService.on('error', errorHandler);
      
      // Clean up event listeners on unmount
      return () => {
        socketService.off('newMessage', newMessageHandler);
        socketService.off('userOnline', userOnlineHandler);
        socketService.off('userOffline', userOfflineHandler);
        socketService.off('userTyping', userTypingHandler);
        socketService.off('incomingCall', incomingCallHandler);
        socketService.off('callAnswered', callAnsweredHandler);
        socketService.off('error', errorHandler);
        
        // Disconnect socket
        socketService.disconnect();
      };
    }
  }, [user, token]);

  /**
   * Get message history with a specific user
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  const getMessages = async (userId) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const data = await apiService.get(`/messages/${userId}`);
      
      if (data.success) {
        dispatch({ type: 'GET_MESSAGES', payload: data.data });
      } else {
        throw new Error(data.error || 'Failed to fetch messages');
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to fetch messages';
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
      }
      
      dispatch({ type: 'SEND_MESSAGE', payload: message });
      return message;
    } catch (err) {
      const errorMsg = err.message || 'Failed to send message';
      dispatch({ type: 'CHAT_ERROR', payload: errorMsg });
      return null;
    }
  };

  /**
   * Set current chat user
   * @param {Object} user - User to chat with
   */
  const setCurrentChat = (user) => {
    dispatch({ type: 'SET_CURRENT_CHAT', payload: user });
  };

  /**
   * Send typing indicator to a user
   * @param {string} recipient - Recipient user ID
   */
  const sendTyping = (recipient) => {
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

  return (
    <ChatContext.Provider
      value={{
        messages: state.messages,
        unreadMessages: state.unreadMessages,
        currentChat: state.currentChat,
        typingUsers: state.typingUsers,
        incomingCall: state.incomingCall,
        callAnswered: state.callAnswered,
        loading: state.loading,
        error: state.error,
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
