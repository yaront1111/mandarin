// src/hooks/useChat.js
import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMessages, sendMessage, addMessage } from '../store/chatSlice';
import useSocket from './useSocket';

export default function useChat(matchId) {
  const dispatch = useDispatch();
  const { messages, loading, error } = useSelector(state => state.chat);
  const socket = useSocket();
  
  // Fetch messages when matchId changes
  useEffect(() => {
    if (matchId) {
      dispatch(fetchMessages(matchId));
    }
  }, [dispatch, matchId]);
  
  // Listen for new messages via socket
  useEffect(() => {
    if (!socket || !matchId) return;
    
    const handleNewMessage = (message) => {
      if (message.matchId === matchId) {
        dispatch(addMessage(message));
      }
    };
    
    socket.on('chat:message', handleNewMessage);
    
    return () => {
      socket.off('chat:message', handleNewMessage);
    };
  }, [socket, matchId, dispatch]);
  
  // Send message function
  const handleSendMessage = useCallback(
    (content) => {
      if (!matchId || !content.trim()) return;
      
      dispatch(sendMessage({ matchId, content }));
    },
    [dispatch, matchId]
  );
  
  return {
    messages: matchId ? messages.filter(m => m.matchId === matchId) : [],
    loading,
    error,
    sendMessage: handleSendMessage
  };
}
