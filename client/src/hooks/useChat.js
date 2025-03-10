// src/hooks/useChat.js
import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMessages, sendMessage, addMessage } from '../store/chatSlice';
import useSocket from './useSocket';

export default function useChat(matchId) {
  const dispatch = useDispatch();
  const { messages, loading, error } = useSelector(state => state.chat);
  const { token } = useSelector(state => state.auth);
  const socket = useSocket(token);
  
  // Generate mock messages for testing when API is not available
  const [mockMessages, setMockMessages] = useState([]);

  useEffect(() => {
    if (matchId && mockMessages.length === 0) {
      // Generate some mock messages for testing
      const now = new Date();
      const mockData = [
        {
          id: '1',
          matchId,
          content: 'Hey there! How are you doing?',
          createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
          senderId: 'other-user-id',
        },
        {
          id: '2',
          matchId,
          content: "I'm good! Just checking out this new app.",
          createdAt: new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString(),
          senderId: 'current-user',
        },
        {
          id: '3',
          matchId,
          content: 'It looks pretty cool so far!',
          createdAt: new Date(now.getTime() - 22 * 60 * 60 * 1000).toISOString(),
          senderId: 'other-user-id',
        },
        {
          id: '4',
          matchId,
          content: 'Yeah, I like the design. Want to meet up sometime?',
          createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
          senderId: 'current-user',
        },
      ];
      setMockMessages(mockData);
    }
  }, [matchId, mockMessages.length]);

  // Fetch messages on match change
  useEffect(() => {
    if (matchId) {
      dispatch(fetchMessages(matchId)).catch(err => {
        console.log('Error fetching messages or API not implemented yet:', err);
        // We'll use mock data instead
      });
    }
  }, [dispatch, matchId]);

  // Listen for incoming messages via socket
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

  // Function to send a new message
  const handleSendMessage = useCallback(
    (content) => {
      if (!matchId || !content.trim()) return;

      // Try to send through Redux/API
      dispatch(sendMessage({ matchId, content })).catch(err => {
        console.log('Error sending message or API not implemented yet:', err);

        // If API fails, add a mock message
        const newMessage = {
          id: `mock-${Date.now()}`,
          matchId,
          content,
          createdAt: new Date().toISOString(),
          senderId: 'current-user', // Assume this is the current user ID
        };

        setMockMessages(prev => [...prev, newMessage]);
      });
    },
    [dispatch, matchId]
  );

  // Combine real messages from API with mock messages if needed
  const allMessages = messages.length > 0
    ? messages.filter(m => m.matchId === matchId)
    : mockMessages;

  return {
    messages: allMessages,
    loading,
    error,
    sendMessage: handleSendMessage
  };
}
