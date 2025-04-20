"use client"

import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import socketService from '../services/socketService';
import { logger } from '../utils';

// Create a logger for this context
const log = logger.create("ChatConnectionContext");

// Create context
const ChatConnectionContext = createContext();

// Hook to use the context
export const useChatConnection = () => useContext(ChatConnectionContext);

export const ChatConnectionProvider = ({ children }) => {
  const { user, isAuthenticated, token } = useAuth();
  const [connected, setConnected] = useState(socketService.isConnected());
  const [connecting, setConnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [error, setError] = useState(null);

  // Initialize socket connection when auth state changes
  useEffect(() => {
    // Track if component is mounted for cleanup
    let isMounted = true;
    
    const setupConnection = async () => {
      // Wait a bit to make sure auth is fully processed
      if (isAuthenticated && user?._id && token) {
        // Small delay to allow auth context to fully stabilize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (isMounted) {
          log.debug(`User authenticated, initializing socket`);
          initializeSocket();
        }
      } else if (!isAuthenticated) {
        // Reset connection state when not authenticated
        setConnected(false);
        setConnecting(false);
        setError(null);
      }
    };
    
    setupConnection();
    
    return () => {
      // Mark as unmounted to prevent state updates after unmount
      isMounted = false;
      
      // Clean up socket connection
      try {
        if (socketService.isConnected()) {
          log.debug('Disconnecting socket on cleanup');
          socketService.disconnect();
        }
      } catch (err) {
        console.error("Error during socket cleanup:", err);
      }
    };
  }, [isAuthenticated, user, token]);

  // Initialize the socket connection with more robust error handling
  const initializeSocket = () => {
    // Check authentication status first
    if (!isAuthenticated) {
      log.warn('Cannot initialize socket: Not authenticated');
      return;
    }

    // Ensure we have a user object
    if (!user) {
      log.warn('Cannot initialize socket: No user object available');
      if (process.env.NODE_ENV === "development") {
        log.info("Development mode: attempting socket initialization despite missing user");
      } else {
        setError('User data is missing. Please refresh the page or log in again.');
        return;
      }
    }
    
    // Ensure we have a user ID
    const userId = user?._id;
    if (!userId) {
      log.warn('Cannot initialize socket: No user ID available');
      
      // In development, we can try to use a fake ID from localStorage to allow testing
      if (process.env.NODE_ENV === "development" && localStorage.getItem("token")) {
        log.info("Development mode: using temporary ID for socket connection");
        // We'll use the temp ID below
      } else {
        setError('User ID is missing. Please refresh the page or log in again.');
        return;
      }
    }
    
    // Use direct validation without external utilities
    let validUserId;
    try {
      // Simple validation function
      const isValidId = (id) => id && /^[0-9a-fA-F]{24}$/.test(id.toString());
      
      // Try multiple approaches to get a valid ID
      
      // 1. First try to clean up the existing ID
      if (userId) {
        // If it's already a valid string, use it directly
        if (typeof userId === 'string' && isValidId(userId)) {
          validUserId = userId;
        } 
        // If it's an object (like MongoDB ObjectId), try toString()
        else if (typeof userId === 'object' && userId !== null) {
          try {
            const idString = userId.toString();
            // Look for valid ObjectId format in the string
            const match = idString.match(/([0-9a-fA-F]{24})/);
            if (match && match[1]) {
              validUserId = match[1];
              log.debug(`Extracted ObjectId from complex object: ${validUserId}`);
            }
          } catch (err) {
            log.error(`Failed to extract valid ID from object: ${err.message}`);
          }
        }
      }
      
      // 2. If that fails, try getting from token
      if (!validUserId || !isValidId(validUserId)) {
        log.warn(`User has invalid ID: ${userId}, trying token-based ID`);
        
        // Extract directly from token
        try {
          const token = sessionStorage.getItem("token") || localStorage.getItem("token");
          if (token) {
            const base64Url = token.split(".")[1];
            const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
            const payload = JSON.parse(atob(base64));
            
            // Try various common JWT payload formats
            const tokenId = payload.id || payload.sub || 
                           (payload.user && (payload.user._id || payload.user._id));
                           
            if (tokenId && isValidId(tokenId)) {
              validUserId = tokenId;
              log.info(`Using ID from token payload: ${validUserId}`);
            }
          }
        } catch (tokenErr) {
          log.error(`Failed to extract ID from token: ${tokenErr.message}`);
        }
      }
      
      // 3. Last resort - use development fallback ID
      if (!validUserId && process.env.NODE_ENV === "development") {
        log.warn('Using fallback ID for development');
        validUserId = "5f50c31f72c5e315b4b3e1c5";
      }
    } catch (error) {
      log.error('Error validating user ID:', error);
      // Fall back to simple regex validation
      validUserId = userId && /^[0-9a-fA-F]{24}$/.test(userId) 
        ? userId 
        : (process.env.NODE_ENV === "development" ? "5f50c31f72c5e315b4b3e1c5" : null);
    }
    
    if (!validUserId) {
      log.error(`Cannot initialize socket: Invalid user ID format: ${userId}`);
      setError('Invalid user ID format. Please try logging out and in again.');
      return;
    }
    
    if (socketService.isConnected()) {
      log.debug('Socket already connected');
      setConnected(true);
      setConnecting(false);
      return;
    }
    
    // Get the token
    const authToken = token || localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!authToken) {
      log.error('Cannot initialize socket: No auth token available');
      setError('Authentication token missing. Please log in again.');
      return;
    }
    
    log.debug(`Initializing socket for user ${validUserId}`);
    setConnecting(true);
    
    try {
      // Initialize the socket with the validated user ID
      socketService.init(validUserId, authToken);
      
      // Set up event listeners with better error handling
      const connectHandler = () => {
        log.info('Socket connected successfully');
        setConnected(true);
        setConnecting(false);
        setError(null);
        setReconnectAttempts(0);
      };
      
      const disconnectHandler = (reason) => {
        log.warn(`Socket disconnected: ${reason}`);
        setConnected(false);
        
        // Different handling for different disconnect reasons
        if (reason === 'io server disconnect') {
          // Server forced disconnect
          setConnecting(false);
          setError('The server disconnected your session. Please refresh the page.');
        } else if (reason === 'transport close' || reason === 'transport error') {
          // Network issues - we'll try to reconnect
          log.info('Network disconnect - will attempt reconnection');
          // Keep connecting state true to show we're trying to reconnect
        } else {
          // Other disconnects
          setConnecting(false);
        }
      };
      
      const errorHandler = (err) => {
        const errorMsg = err?.message || 'Unknown error';
        log.error(`Socket error: ${errorMsg}`);
        setError(`Connection error: ${errorMsg}`);
        setConnecting(false);
      };
      
      const connectErrorHandler = (err) => {
        const errorMsg = err?.message || 'Unknown error';
        log.error(`Socket connection error: ${errorMsg}`);
        setConnecting(false);
        
        // Increment reconnect attempts counter
        const newAttempts = reconnectAttempts + 1;
        setReconnectAttempts(newAttempts);
        
        // Only show auth errors after multiple failures
        if ((err?.message?.includes('auth') || err?.message?.includes('token')) && newAttempts > 2) {
          setError('Authentication failed. Please try refreshing the page or log out and log in again.');
        } else if (newAttempts > 3) {
          // Only show general error after multiple attempts
          setError(`Connection error: ${errorMsg}`);
        } else {
          // For initial attempts, don't show error to user
          log.info(`Connection attempt ${newAttempts} failed, will retry`);
        }
      };
      
      // Register event handlers with cleanup
      const handlers = [
        socketService.on('connect', connectHandler),
        socketService.on('disconnect', disconnectHandler),
        socketService.on('error', errorHandler),
        socketService.on('connect_error', connectErrorHandler)
      ];
      
      // Setup auto-reconnect logic
      const checkConnectionInterval = setInterval(() => {
        if (!socketService.isConnected() && isAuthenticated && user?._id) {
          const shouldAttemptReconnect = reconnectAttempts < 5; // Limit attempts
          
          if (shouldAttemptReconnect) {
            log.debug(`Auto reconnect attempt ${reconnectAttempts + 1}`);
            setReconnectAttempts(prev => prev + 1);
            socketService.reconnect();
          }
        }
      }, 30000); // Check every 30 seconds
      
      // Return cleanup function
      return () => {
        handlers.forEach(unsubscribe => unsubscribe());
        clearInterval(checkConnectionInterval);
      };
    } catch (err) {
      log.error(`Error initializing socket: ${err.message}`);
      setConnecting(false);
      setError(`Failed to connect: ${err.message}`);
    }
  };

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isAuthenticated && user?._id && !socketService.isConnected() && !connecting) {
        log.debug('Page became visible, reconnecting socket');
        socketService.reconnect();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, user, connecting]);

  // Context value
  const value = {
    connected,
    connecting,
    error,
    reconnectAttempts,
    initializeSocket
  };

  return (
    <ChatConnectionContext.Provider value={value}>
      {children}
    </ChatConnectionContext.Provider>
  );
};

export default ChatConnectionContext;
