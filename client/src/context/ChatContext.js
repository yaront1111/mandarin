import React, { createContext, useReducer, useContext, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import apiService from '../services/apiService';
import socketService from '../services/socketService';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

const chatReducer = (state, action) => {
  switch (action.type) {
    case 'GET_MESSAGES':
      return { ...state, messages: action.payload, loading: false };
    case 'SEND_MESSAGE':
      return { ...state, messages: [action.payload, ...state.messages], sendingMessage: false };
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
        unreadMessages: state.unreadMessages.filter(
          (msg) => msg.sender.toString() !== action.payload?._id.toString()
        ),
        messageError: null
      };
    case 'USER_TYPING':
      return { ...state, typingUsers: { ...state.typingUsers, [action.payload.userId]: Date.now() } };
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
    messageError: null
  };

  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { user, token } = useAuth();
  const eventHandlers = useRef({});

  useEffect(() => {
    if (user && token) {
      socketService.init(user._id, token);
      const handlers = {
        newMessage: (message) => {
          dispatch({ type: 'RECEIVE_MESSAGE', payload: message });
          if (state.currentChat && message.sender !== state.currentChat._id) {
            const senderName = message.senderName || 'Someone';
            toast.info(`New message from ${senderName}`);
          }
        },
        userOnline: (data) => dispatch({ type: 'USER_ONLINE', payload: data }),
        userOffline: (data) => dispatch({ type: 'USER_OFFLINE', payload: data }),
        userTyping: (data) => dispatch({ type: 'USER_TYPING', payload: data }),
        incomingCall: (data) => dispatch({ type: 'INCOMING_CALL', payload: data }),
        callAnswered: (data) => dispatch({ type: 'CALL_ANSWERED', payload: data }),
        error: (error) => dispatch({ type: 'CHAT_ERROR', payload: error.message || 'Socket error' })
      };
      eventHandlers.current = handlers;
      Object.entries(handlers).forEach(([event, handler]) => {
        socketService.on(event, handler);
      });
      return () => {
        Object.entries(eventHandlers.current).forEach(([event, handler]) => {
          socketService.off(event, handler);
        });
      };
    }
  }, [user, token]);

  const getMessages = async (userId) => {
    if (!userId) return;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const data = await apiService.get(`/messages/${userId}`);
      if (data.success) {
        const sortedMessages = data.data.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        dispatch({ type: 'GET_MESSAGES', payload: sortedMessages });
      }
    } catch (err) {
      const errorMsg = err.error || err.message || 'Failed to fetch messages';
      dispatch({ type: 'CHAT_ERROR', payload: errorMsg });
    }
  };

  const sendMessage = async (recipient, type, content) => {
    dispatch({ type: 'SENDING_MESSAGE' });
    try {
      const data = await apiService.post('/messages', { recipient, type, content });
      if (!data.success) throw new Error(data.error || 'Failed to send message');
      const message = data.data;
      try {
        await socketService.sendMessage(recipient, type, content);
      } catch (socketErr) {
        console.warn('Socket delivery failed, but message is saved:', socketErr);
      }
      dispatch({ type: 'SEND_MESSAGE', payload: message });
      return message;
    } catch (err) {
      const errorMsg = err.error || err.message || 'Failed to send message';
      dispatch({ type: 'MESSAGE_ERROR', payload: errorMsg });
      return null;
    }
  };

  const setCurrentChat = (userObj) => {
    dispatch({ type: 'SET_CURRENT_CHAT', payload: userObj });
    if (userObj && userObj._id) {
      getMessages(userObj._id);
    }
  };

  const sendTyping = (recipient) => {
    if (recipient) socketService.sendTyping(recipient);
  };

  const initiateVideoCall = async (recipient) => {
    try {
      await socketService.initiateVideoCall(recipient);
      toast.info('Calling...');
    } catch (err) {
      toast.error('Could not initiate call. Please try again.');
      dispatch({ type: 'CHAT_ERROR', payload: err.message || 'Failed to initiate call' });
    }
  };

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

  const endCall = () => {
    dispatch({ type: 'END_CALL' });
    toast.info('Call ended');
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

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
        clearError
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
