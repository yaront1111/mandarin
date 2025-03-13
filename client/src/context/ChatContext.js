import React, { createContext, useReducer, useContext, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

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
      return { ...state, currentChat: action.payload, unreadMessages: state.unreadMessages.filter(msg => msg.sender !== action.payload._id) };
    case 'USER_TYPING':
      return { ...state, typingUsers: { ...state.typingUsers, [action.payload.userId]: Date.now() } };
    case 'INCOMING_CALL':
      return { ...state, incomingCall: action.payload };
    case 'CALL_ANSWERED':
      return { ...state, callAnswered: action.payload };
    case 'END_CALL':
      return { ...state, incomingCall: null, callAnswered: null };
    case 'CHAT_ERROR':
      return { ...state, error: action.payload };
    case 'SET_SOCKET':
      return { ...state, socket: action.payload };
    default:
      return state;
  }
};

export const ChatProvider = ({ children }) => {
  const initialState = {
    messages: [],
    unreadMessages: [],
    currentChat: null,
    socket: null,
    typingUsers: {},
    incomingCall: null,
    callAnswered: null,
    loading: true,
    error: null,
  };

  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const newSocket = io();
      newSocket.on('connect', () => {
        console.log('Socket connected');
        newSocket.emit('join', { userId: user._id });
      });
      dispatch({ type: 'SET_SOCKET', payload: newSocket });
      newSocket.on('newMessage', (message) => {
        dispatch({ type: 'RECEIVE_MESSAGE', payload: message });
      });
      newSocket.on('userOnline', (data) => {
        dispatch({ type: 'USER_ONLINE', payload: data });
      });
      newSocket.on('userOffline', (data) => {
        dispatch({ type: 'USER_OFFLINE', payload: data });
      });
      newSocket.on('userTyping', (data) => {
        dispatch({ type: 'USER_TYPING', payload: data });
      });
      newSocket.on('incomingCall', (data) => {
        dispatch({ type: 'INCOMING_CALL', payload: data });
      });
      newSocket.on('callAnswered', (data) => {
        dispatch({ type: 'CALL_ANSWERED', payload: data });
      });
      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  const getMessages = async (userId) => {
    try {
      const res = await axios.get(`/messages/${userId}`);
      dispatch({ type: 'GET_MESSAGES', payload: res.data.data });
    } catch (err) {
      dispatch({ type: 'CHAT_ERROR', payload: err.response?.data.error || 'Server Error' });
    }
  };

  const sendMessage = async (recipient, type, content) => {
    try {
      const res = await axios.post('/messages', { recipient, type, content });
      if (state.socket) {
        state.socket.emit('privateMessage', { sender: user._id, recipient, type, content });
      }
      dispatch({ type: 'SEND_MESSAGE', payload: res.data.data });
      return res.data.data;
    } catch (err) {
      dispatch({ type: 'CHAT_ERROR', payload: err.response?.data.error || 'Server Error' });
      return null;
    }
  };

  const setCurrentChat = (user) => {
    dispatch({ type: 'SET_CURRENT_CHAT', payload: user });
  };

  const sendTyping = (recipient) => {
    if (state.socket) {
      state.socket.emit('typing', { sender: user._id, recipient });
    }
  };

  const initiateVideoCall = (recipient) => {
    if (state.socket) {
      state.socket.emit('videoCallRequest', { caller: user._id, recipient });
    }
  };

  const answerVideoCall = (caller, answer) => {
    if (state.socket) {
      state.socket.emit('videoCallAnswer', { caller, recipient: user._id, answer });
    }
  };

  const endCall = () => {
    dispatch({ type: 'END_CALL' });
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
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
