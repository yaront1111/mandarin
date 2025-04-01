import { useState, useEffect, useCallback, useRef } from 'react';
import socketService from '../services/socketService';

/**
 * Custom hook to manage socket connection and events
 * @param {Object} options - Configuration options
 * @returns {Object} Socket connection state and methods
 */
export const useSocketConnection = (options = {}) => {
  const [connected, setConnected] = useState(socketService.isConnected());
  const [connectionError, setConnectionError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Keep track of registered event listeners for cleanup
  const eventListenersRef = useRef(new Map());
  
  // Initialize socket connection
  useEffect(() => {
    const { userId, token, autoConnect = true } = options;
    
    // Determine if we should connect now
    const shouldConnect = autoConnect && userId && token;
    
    // Get current connection status
    const isCurrentlyConnected = socketService.isConnected();
    
    // Update our state to match actual socket state
    if (isCurrentlyConnected !== connected) {
      setConnected(isCurrentlyConnected);
    }
    
    // Only attempt to connect if required credentials are available 
    // and we're not already connected and autoConnect is enabled
    if (shouldConnect && !isCurrentlyConnected) {
      connectSocket(userId, token);
    }
    
    // Setup connection status listeners
    const handleConnect = () => {
      setConnected(true);
      setConnectionError(null);
      setIsConnecting(false);
      console.log("Socket connected successfully");
    };
    
    const handleDisconnect = (reason) => {
      setConnected(false);
      setIsConnecting(false);
      console.log(`Socket disconnected: ${reason}`);
      
      // If disconnected by server, set error
      if (reason === 'io server disconnect') {
        setConnectionError('Server disconnected the socket');
      } else if (reason === 'transport close' || reason === 'transport error') {
        // Network issues - don't show error to user but log it
        console.log("Network disconnect - will auto-reconnect");
      }
    };
    
    const handleError = (err) => {
      const errorMsg = err?.message || 'Connection error';
      console.error(`Socket error: ${errorMsg}`);
      setConnectionError(errorMsg);
      setIsConnecting(false);
    };
    
    // Register socket event listeners
    const connectListener = socketService.on('connect', handleConnect);
    const disconnectListener = socketService.on('disconnect', handleDisconnect);
    const errorListener = socketService.on('error', handleError);
    
    // Add connect error handler
    const connectErrorListener = socketService.on('connect_error', (err) => {
      console.error(`Socket connect error: ${err?.message}`);
      setIsConnecting(false);
      
      // Don't show auth errors to user immediately - let retry happen first
      if (err?.message?.includes('auth') || err?.message?.includes('token')) {
        console.log("Auth error in socket - will retry");
      } else {
        setConnectionError(`Connect error: ${err?.message}`);
      }
    });
    
    // Cleanup function to remove event listeners
    return () => {
      connectListener();
      disconnectListener();
      errorListener();
      connectErrorListener();
      
      // Clean up any other event listeners we've registered
      eventListenersRef.current.forEach(removeListener => {
        if (typeof removeListener === 'function') {
          removeListener();
        }
      });
      eventListenersRef.current.clear();
    };
  }, [options.userId, options.token, options.autoConnect]);
  
  /**
   * Connect to socket server
   * @param {string} userId - User ID for authentication
   * @param {string} token - Auth token
   * @returns {Promise} Connection result
   */
  const connectSocket = useCallback(async (userId, token) => {
    // Don't reconnect if already connected
    if (socketService.isConnected()) {
      return true;
    }
    
    // Don't attempt connection if we're already trying
    if (isConnecting) {
      return false;
    }
    
    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      await socketService.init(userId, token);
      setConnected(true);
      setIsConnecting(false);
      return true;
    } catch (err) {
      setConnectionError(err.message || 'Failed to connect to socket server');
      setIsConnecting(false);
      setConnected(false);
      return false;
    }
  }, [isConnecting]);
  
  /**
   * Register an event listener with automatic tracking for cleanup
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   * @returns {Function} Function to remove the listener
   */
  const on = useCallback((event, callback) => {
    // Register with the socket service
    const removeListener = socketService.on(event, callback);
    
    // Track this listener for cleanup
    eventListenersRef.current.set(`${event}:${callback.toString().slice(0, 20)}`, removeListener);
    
    // Return the removal function
    return removeListener;
  }, []);
  
  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event handler to remove
   */
  const off = useCallback((event, callback) => {
    const key = `${event}:${callback.toString().slice(0, 20)}`;
    
    if (eventListenersRef.current.has(key)) {
      const removeListener = eventListenersRef.current.get(key);
      removeListener();
      eventListenersRef.current.delete(key);
    }
  }, []);
  
  /**
   * Emit an event to the server
   * @param {string} event - Event name
   * @param {any} data - Event data
   * @param {Function} ack - Acknowledgement callback
   * @returns {boolean} Whether emit was successful
   */
  const emit = useCallback((event, data, ack) => {
    if (!socketService.isConnected()) {
      if (options.autoReconnect) {
        // Try to reconnect if configured
        const { userId, token } = options;
        if (userId && token) {
          connectSocket(userId, token);
        }
      }
      return false;
    }
    
    return socketService.emit(event, data, ack);
  }, [options.autoReconnect, options.userId, options.token, connectSocket]);
  
  /**
   * Create a custom hook for a specific socket event
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @param {Array} deps - Dependencies for the effect
   */
  const useSocketEvent = (event, handler, deps = []) => {
    useEffect(() => {
      const removeListener = on(event, handler);
      return removeListener;
    }, [event, ...deps]);
  };
  
  return {
    connected,
    connectionError,
    isConnecting,
    connect: connectSocket,
    reconnect: socketService.reconnect,
    disconnect: socketService.disconnect,
    on,
    off,
    emit,
    useSocketEvent,
    getStatus: socketService.getStatus
  };
};

export default useSocketConnection;