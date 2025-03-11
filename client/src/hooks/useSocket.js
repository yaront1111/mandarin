// src/hooks/useSocket.js
import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * A React hook for managing Socket.IO connections with graceful fallback
 * and improved reliability when the server isn't available
 *
 * @param {string} token - Authentication token
 * @returns {Object} - Socket instance and connection state
 */
export default function useSocket(token) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const reconnectTimerRef = useRef(null);
  const maxReconnectAttempts = 10;

  // Function to connect socket with proper error handling
  const connectSocket = useCallback(async () => {
    if (!token) {
      setError('No authentication token provided');
      return;
    }

    try {
      // Dynamically import socket.io-client to prevent errors when it's not installed
      const io = await import('socket.io-client')
        .then(module => module.io)
        .catch(() => {
          console.warn('Socket.io client not available');
          setError('Socket.io client not available');
          return null;
        });

      if (!io) return;

      // Clean up any existing connection
      if (socketRef.current && typeof socketRef.current.disconnect === 'function') {
        socketRef.current.disconnect();
      }

      // Connect to Socket.IO with token
      socketRef.current = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000', {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
        autoConnect: true,
        forceNew: true
      });

      // Set up event listeners
      socketRef.current.on('connect', () => {
        console.log('Socket connected successfully');
        setConnected(true);
        setError(null);
        setReconnectAttempts(0); // Reset reconnect counter on successful connection

        // Clear any pending reconnect timers
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      });

      socketRef.current.on('connect_error', (err) => {
        console.warn('Socket connection error:', err.message);
        setError(`Connection error: ${err.message}`);

        // Don't set connected to false here as the socket will try to reconnect automatically
        // But we can track reconnect attempts
        setReconnectAttempts(prev => prev + 1);
      });

      socketRef.current.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setConnected(false);

        // If the server forcibly closed the connection, try to reconnect
        if (reason === 'io server disconnect') {
          const attemptReconnect = () => {
            if (reconnectAttempts < maxReconnectAttempts) {
              console.log(`Attempting to reconnect (${reconnectAttempts + 1}/${maxReconnectAttempts})...`);
              socketRef.current.connect();
            } else {
              setError('Maximum reconnection attempts reached. Please refresh the page.');
            }
          };

          // Wait a bit before trying to reconnect
          reconnectTimerRef.current = setTimeout(attemptReconnect, 3000);
        }
      });

      // Add more error handling
      socketRef.current.on('error', (err) => {
        console.error('Socket error:', err);
        setError(`Socket error: ${err.message || 'Unknown error'}`);
      });

      // Handle ping timeouts
      socketRef.current.on('ping', () => {
        console.log('Socket ping received');
      });

      socketRef.current.on('pong', (latency) => {
        console.log(`Socket pong received (latency: ${latency}ms)`);
      });

    } catch (err) {
      console.error('Error initializing socket:', err);
      setError(`Failed to initialize socket: ${err.message}`);
      setConnected(false);
    }
  }, [token, reconnectAttempts, maxReconnectAttempts]);

  // Handle manual reconnection
  const reconnect = useCallback(() => {
    setReconnectAttempts(0); // Reset counter
    setError(null); // Clear errors
    connectSocket(); // Try to connect again
  }, [connectSocket]);

  // Connect when token changes
  useEffect(() => {
    if (token) {
      connectSocket();
    } else {
      // Clean up existing connection if token is removed
      if (socketRef.current) {
        try {
          socketRef.current.disconnect();
        } catch (error) {
          console.warn('Error disconnecting socket:', error);
        }
        socketRef.current = null;
        setConnected(false);
      }
    }

    // Cleanup function for disconnecting socket and clearing timers
    return () => {
      if (socketRef.current) {
        try {
          socketRef.current.disconnect();
        } catch (error) {
          console.warn('Error disconnecting socket during cleanup:', error);
        }
        socketRef.current = null;
        setConnected(false);
      }

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [token, connectSocket]);

  // Public event emitter with error handling
  const emit = useCallback((event, ...args) => {
    if (!socketRef.current || !connected) {
      console.warn(`Cannot emit ${event}: Socket not connected`);
      return false;
    }

    try {
      socketRef.current.emit(event, ...args);
      return true;
    } catch (error) {
      console.error(`Error emitting ${event}:`, error);
      return false;
    }
  }, [connected]);

  // Return both the socket, connection status, and helper functions
  return {
    socket: socketRef.current,
    connected,
    error,
    reconnect,
    emit,
    reconnectAttempts
  };
}
