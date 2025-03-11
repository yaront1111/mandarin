// src/hooks/useSocket.js
import { useEffect, useRef, useState } from 'react';

/**
 * A React hook for managing Socket.IO connections with graceful fallback
 * when the server isn't available
 * 
 * @param {string} token - Authentication token
 * @returns {Object|null} - Socket instance or null if not connected
 */
export default function useSocket(token) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  // We're tracking the error state but not using it directly in this hook
  // eslint-disable-next-line no-unused-vars
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;

    // Only import socket.io-client if we have a token
    const connectSocket = async () => {
      try {
        // Dynamically import socket.io-client to prevent errors when it's not installed
        const io = await import('socket.io-client').then(module => module.io).catch(() => null);

        if (!io) {
          console.warn('Socket.io client not available');
          return;
        }

        // Connect to Socket.IO with token
        socketRef.current = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000', {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 5000
        });

        // Set up event listeners
        socketRef.current.on('connect', () => {
          console.log('Socket connected');
          setConnected(true);
          setError(null);
        });

        socketRef.current.on('connect_error', (err) => {
          console.warn('Socket connection error:', err.message);
          setError(err.message);
          // Don't set connected to false here as the socket will try to reconnect
        });

        socketRef.current.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          setConnected(false);

          // If the server forcibly closed the connection, don't try to reconnect
          if (reason === 'io server disconnect') {
            socketRef.current.connect();
          }
        });

        // Add more error handling
        socketRef.current.on('error', (err) => {
          console.error('Socket error:', err);
          setError(err.message);
        });

        // Create a mock implementation of common socket methods in case the real socket fails
        const mockSocket = {
          emit: (...args) => {
            console.warn('Socket not connected, emitting event', args[0]);
            return mockSocket;
          },
          on: () => mockSocket,
          off: () => mockSocket,
          once: () => mockSocket,
          connect: () => mockSocket,
          disconnect: () => mockSocket,
          connected: false
        };

        // If connection fails, use the mock socket
        setTimeout(() => {
          if (!connected && !socketRef.current?.connected) {
            console.warn('Socket failed to connect within timeout, using mock implementation');
            socketRef.current = mockSocket;
          }
        }, 5000);
      } catch (err) {
        console.error('Error initializing socket:', err);
        setError(err.message);
      }
    };

    connectSocket();

    return () => {
      if (socketRef.current) {
        try {
          socketRef.current.disconnect();
        } catch (error) {
          console.warn('Error disconnecting socket:', error);
        }
        socketRef.current = null;
        setConnected(false);
      }
    };
  }, [token, connected]);

  // Return both the socket and connection status
  return {
    socket: socketRef.current,
    connected,
    error
  };
}
