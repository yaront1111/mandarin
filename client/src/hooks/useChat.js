// src/hooks/useChat.js
import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMessages, sendMessage, addMessage } from '../store/chatSlice';
import useSocket from './useSocket';

export default function useChat(matchId) {
  const dispatch = useDispatch();
  const { messages, loading: messagesLoading, error: messagesError } = useSelector(state => state.chat);
  const { token } = useSelector(state => state.auth);
  const { socket, connected: socketConnected, error: socketError } = useSocket(token);

  // We'll store local preview URLs for any files the user selects,
  // so we can revoke them on component unmount / cleanup.
  const [localMessages, setLocalMessages] = useState([]);
  const [error, setError] = useState(null);

  // Combine real and local messages
  const allMessages = [...messages, ...localMessages].sort((a, b) => {
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  // Handle socket connection and message events
  useEffect(() => {
    setError(messagesError || socketError);
  }, [messagesError, socketError]);

  // Fetch messages on match change
  useEffect(() => {
    if (matchId) {
      dispatch(fetchMessages(matchId)).catch(err => {
        console.error('Error fetching messages:', err);
        setError('Failed to load messages');
      });
    }
  }, [dispatch, matchId]);

  // Listen for incoming messages via socket
  useEffect(() => {
    if (!socket || !matchId || !socketConnected) return;

    const handleNewMessage = (message) => {
      if (message.matchId === matchId) {
        dispatch(addMessage(message));
      }
    };

    socket.on('chat:message', handleNewMessage);

    return () => {
      socket.off('chat:message', handleNewMessage);
    };
  }, [socket, socketConnected, matchId, dispatch]);

  // Function to send a new message
  const handleSendMessage = useCallback(
    async (content) => {
      if (!matchId || !content.trim()) return;

      try {
        // Add an optimistic message right away
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage = {
          id: tempId,
          matchId,
          content,
          createdAt: new Date().toISOString(),
          senderId: 'current-user', // This will be replaced by the server
          pending: true
        };

        setLocalMessages(prev => [...prev, optimisticMessage]);

        // Try to send through Redux/API
        const result = await dispatch(sendMessage({ matchId, content })).unwrap();

        // On success, remove the local message as it will be replaced by the server message
        setLocalMessages(prev => prev.filter(msg => msg.id !== tempId));

        return result;
      } catch (err) {
        console.error('Error sending message:', err);
        setError('Failed to send message');

        // Update the local message to show it failed
        setLocalMessages(prev =>
          prev.map(msg =>
            msg.id.startsWith('temp-')
              ? { ...msg, error: true, pending: false }
              : msg
          )
        );

        throw err;
      }
    },
    [dispatch, matchId]
  );

  return {
    messages: allMessages,
    loading: messagesLoading,
    error,
    sendMessage: handleSendMessage,
    socketConnected
  };
}
