// client/src/hooks/useChatConnection.js
/**
 * Hook for managing chat connection state
 * Handles socket connection management separately from chat logic
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context';
import socketService from '../services/socketService';
import { logger } from '../utils';

// Create a logger for this hook
const log = logger.create('useChatConnection');

/**
 * Hook for socket connection management
 * @returns {Object} Connection state and methods
 */
export const useChatConnection = () => {
  const { user, isAuthenticated, token } = useAuth();
  const [connected, setConnected] = useState(socketService.isConnected());
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Initialize connection when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id && token) {
      // Only initialize if not already connected
      if (!socketService.isConnected() && !connecting) {
        log.debug('Initializing socket connection');
        connectSocket();
      }
    } else {
      // If not authenticated, disconnect if needed
      if (socketService.isConnected()) {
        log.debug('User not authenticated, disconnecting socket');
        disconnectSocket();
      }
    }
    
    // Setup event listeners
    const handleConnect = () => {
      log.info('Socket connected');
      setConnected(true);
      setConnecting(false);
      setError(null);
      setReconnectAttempts(0);
    };
    
    const handleDisconnect = (reason) => {
      log.warn(`Socket disconnected: ${reason}`);
      setConnected(false);
    };
    
    const handleConnectError = (err) => {
      log.error('Socket connection error:', err);
      setConnected(false);
      setConnecting(false);
      setError(err.message || 'Failed to connect');
      setReconnectAttempts((prev) => prev + 1);
    };
    
    const handleAuthError = (err) => {
      log.error('Socket authentication error:', err);
      setError('Authentication error: ' + (err.message || 'Please log out and log in again'));
      setConnected(false);
      setConnecting(false);
    };

    // Register listeners
    const unsubscribe = [
      socketService.on('connect', handleConnect),
      socketService.on('disconnect', handleDisconnect),
      socketService.on('connect_error', handleConnectError),
      socketService.on('auth_error', handleAuthError)
    ];
    
    // Cleanup on unmount
    return () => {
      unsubscribe.forEach(fn => fn());
    };
  }, [isAuthenticated, user, token, connecting]);

  /**
   * Connect to socket server
   */
  const connectSocket = useCallback(() => {
    if (isAuthenticated && user?.id && token) {
      setConnecting(true);
      setError(null);
      
      try {
        log.info(`Connecting socket for user ${user.id}`);
        socketService.init(user.id, token);
      } catch (err) {
        log.error('Error connecting socket:', err);
        setError(err.message || 'Failed to connect');
        setConnecting(false);
      }
    } else {
      setError('Cannot connect: Not authenticated');
    }
  }, [isAuthenticated, user, token]);

  /**
   * Disconnect from socket server
   */
  const disconnectSocket = useCallback(() => {
    socketService.disconnect();
    setConnected(false);
    setConnecting(false);
    log.debug('Manually disconnected socket');
  }, []);

  /**
   * Force reconnection
   */
  const reconnect = useCallback(() => {
    if (connecting) return;
    
    log.debug('Forcing socket reconnection');
    setReconnectAttempts((prev) => prev + 1);
    
    // Disconnect first
    socketService.disconnect();
    
    // Short delay before reconnecting
    setTimeout(() => {
      connectSocket();
    }, 500);
  }, [connecting, connectSocket]);

  return {
    connected,
    connecting,
    error,
    reconnectAttempts,
    connect: connectSocket,
    disconnect: disconnectSocket,
    reconnect
  };
};

export default useChatConnection;
