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
  
  // Initialize socket connection with improved race condition handling
  useEffect(() => {
    // Create connection identifier to track this specific effect instance
    const connectionEffectId = Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    console.log(`Initializing socket connection effect [${connectionEffectId}]`);
    
    // Flag to track if this effect instance is still active
    let isEffectActive = true;
    
    // Safe state updater that checks if the effect is still active
    const safeSetState = (stateSetter, newValue) => {
      if (isEffectActive) {
        stateSetter(newValue);
      }
    };
    
    // Extract options safely with defaults
    const userId = options?.userId;
    const token = options?.token;
    const autoConnect = options?.autoConnect !== false; // Default to true
    
    // Determine if we should connect now - with proper type checks
    const shouldConnect = autoConnect && 
                         typeof userId === 'string' && userId.length > 0 && 
                         typeof token === 'string' && token.length > 0;
    
    // Synchronize our state with the actual socket state to avoid inconsistencies
    const syncConnectionState = () => {
      const actualConnected = socketService.isConnected();
      if (actualConnected !== connected) {
        safeSetState(setConnected, actualConnected);
      }
    };
    
    // First synchronize state
    syncConnectionState();
    
    // Track if the connection attempt is running
    let connectionAttemptRunning = false;
    
    // Only attempt to connect if required credentials are available
    // and we're not already connected and autoConnect is enabled
    if (shouldConnect && !socketService.isConnected() && !connectionAttemptRunning) {
      connectionAttemptRunning = true;
      console.log(`[${connectionEffectId}] Initiating connection with userId: ${userId}`);
      
      // Use a non-blocking approach to prevent blocking the effect
      connectSocket(userId, token)
        .then(success => {
          if (!isEffectActive) return;
          connectionAttemptRunning = false;
          console.log(`[${connectionEffectId}] Connection attempt result: ${success ? 'connected' : 'failed'}`);
        })
        .catch(error => {
          if (!isEffectActive) return;
          connectionAttemptRunning = false;
          console.error(`[${connectionEffectId}] Connection attempt error:`, error);
        });
    }
    
    // Setup connection status listeners with improved error handling
    const handleConnect = () => {
      console.log(`[${connectionEffectId}] Socket connected successfully`);
      safeSetState(setConnected, true);
      safeSetState(setConnectionError, null);
      safeSetState(setIsConnecting, false);
    };
    
    const handleDisconnect = (reason) => {
      console.log(`[${connectionEffectId}] Socket disconnected: ${reason}`);
      safeSetState(setConnected, false);
      safeSetState(setIsConnecting, false);
      
      // If disconnected by server, set error
      if (reason === 'io server disconnect') {
        safeSetState(setConnectionError, 'Server disconnected the socket');
      } else if (reason === 'transport close' || reason === 'transport error') {
        // Network issues - don't show error to user but log it
        console.log(`[${connectionEffectId}] Network disconnect - will auto-reconnect`);
      }
    };
    
    const handleError = (err) => {
      const errorMsg = err?.message || 'Connection error';
      console.error(`[${connectionEffectId}] Socket error: ${errorMsg}`);
      safeSetState(setConnectionError, errorMsg);
      safeSetState(setIsConnecting, false);
    };
    
    const handleConnectError = (err) => {
      console.error(`[${connectionEffectId}] Socket connect error: ${err?.message}`);
      safeSetState(setIsConnecting, false);
      
      // Don't show auth errors to user immediately - let retry happen first
      if (err?.message?.includes('auth') || err?.message?.includes('token')) {
        console.log(`[${connectionEffectId}] Auth error in socket - will retry`);
      } else {
        safeSetState(setConnectionError, `Connect error: ${err?.message}`);
      }
    };
    
    // Register socket event listeners with error handling
    let connectListener, disconnectListener, errorListener, connectErrorListener;
    
    try {
      connectListener = socketService.on('connect', handleConnect);
      disconnectListener = socketService.on('disconnect', handleDisconnect);
      errorListener = socketService.on('error', handleError);
      connectErrorListener = socketService.on('connect_error', handleConnectError);
    } catch (error) {
      console.error(`[${connectionEffectId}] Error registering socket event listeners:`, error);
    }
    
    // Cleanup function to remove event listeners
    return () => {
      console.log(`[${connectionEffectId}] Cleaning up socket connection effect`);
      isEffectActive = false;
      
      // Safely remove event listeners
      const safeRemoveListener = (removeListener) => {
        if (typeof removeListener === 'function') {
          try {
            removeListener();
          } catch (error) {
            console.error(`[${connectionEffectId}] Error removing listener:`, error);
          }
        }
      };
      
      safeRemoveListener(connectListener);
      safeRemoveListener(disconnectListener);
      safeRemoveListener(errorListener);
      safeRemoveListener(connectErrorListener);
      
      // Clean up any other event listeners we've registered
      if (eventListenersRef.current.size > 0) {
        console.log(`[${connectionEffectId}] Cleaning up ${eventListenersRef.current.size} socket event listeners`);
        eventListenersRef.current.forEach(safeRemoveListener);
        eventListenersRef.current.clear();
      }
    };
  }, [options.userId, options.token, options.autoConnect, connectSocket, connected]);
  
  /**
   * Connect to socket server with enhanced race condition prevention
   * @param {string} userId - User ID for authentication
   * @param {string} token - Auth token
   * @returns {Promise} Connection result
   */
  const connectSocket = useCallback(async (userId, token) => {
    // Create a unique identifier for this connection attempt to track it
    const connectionAttemptId = useRef(Date.now().toString() + Math.random().toString(36).substring(2, 9)).current;
    
    // Use a ref to track this specific connection attempt
    const isActiveConnectionAttempt = useRef(true);
    
    // Check current connection state in an atomic way
    const currentlyConnected = socketService.isConnected();
    if (currentlyConnected) {
      console.log('Socket already connected, skipping connection attempt');
      return true;
    }
    
    // Use atomic operation to check and update connecting state
    const wasAlreadyConnecting = isConnecting;
    if (wasAlreadyConnecting) {
      console.log('Connection already in progress, skipping duplicate attempt');
      return false;
    }
    
    // Mark as connecting
    console.log(`Starting connection attempt ${connectionAttemptId}`);
    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      // Track the connection state to prevent race conditions
      const connectionResult = await socketService.init(userId, token);
      
      // Check if this connection attempt is still relevant (not canceled or superseded)
      if (!isActiveConnectionAttempt.current) {
        console.log(`Connection attempt ${connectionAttemptId} was superseded, ignoring result`);
        return false;
      }
      
      // Update state based on the connection result
      setConnected(!!connectionResult);
      setIsConnecting(false);
      return !!connectionResult;
    } catch (err) {
      // Only update state if this connection attempt is still active
      if (isActiveConnectionAttempt.current) {
        console.error(`Connection attempt ${connectionAttemptId} failed:`, err.message);
        setConnectionError(err.message || 'Failed to connect to socket server');
        setIsConnecting(false);
        setConnected(false);
      }
      return false;
    } finally {
      // Cleanup - mark this connection attempt as inactive
      isActiveConnectionAttempt.current = false;
    }
  }, []);
  
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
   * Emit an event to the server with improved race condition handling
   * @param {string} event - Event name
   * @param {any} data - Event data
   * @param {Function} ack - Acknowledgement callback
   * @returns {boolean} Whether emit was successful
   */
  const emit = useCallback((event, data, ack) => {
    // Capture connection state at the beginning to avoid race conditions
    const isSocketConnected = socketService.isConnected();
    
    // If not connected, attempt to reconnect if appropriate
    if (!isSocketConnected) {
      console.log(`Socket disconnected when attempting to emit ${event}, checking reconnect options`);
      
      // Implement an emit queue for important events when disconnected
      const importantEvents = ['message', 'read', 'typing', 'activity'];
      if (importantEvents.includes(event) || event.includes('call')) {
        console.log(`Queueing important event ${event} for later emission`);
        // Note: socketService handles queuing internally
      }
      
      if (options.autoReconnect) {
        // Extract reconnection parameters safely
        const userId = options?.userId;
        const token = options?.token;
        
        // Only attempt reconnection with valid credentials
        if (userId && token) {
          console.log(`Attempting reconnection before emitting ${event}`);
          
          // Don't await - we want a non-blocking implementation
          // The socket service will queue important messages
          connectSocket(userId, token).then(connected => {
            if (connected) {
              console.log(`Reconnection successful, socket service will handle queued events including ${event}`);
              // The socketService will automatically process queued messages
            }
          });
        } else {
          console.warn('Cannot reconnect: missing userId or token');
        }
      }
      
      // Return false to indicate the immediate emission failed
      return false;
    }
    
    // Connected, so attempt to emit the event
    try {
      return socketService.emit(event, data, ack);
    } catch (error) {
      console.error(`Error emitting ${event}:`, error);
      return false;
    }
  }, [options.autoReconnect, options.userId, options.token, connectSocket]);
  
  /**
   * Create a custom hook for a specific socket event with enhanced cleanup
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @param {Array} deps - Dependencies for the effect
   */
  const useSocketEvent = useCallback((event, handler, deps = []) => {
    useEffect(() => {
      // Skip if invalid inputs
      if (!event || typeof handler !== 'function') {
        console.warn('Invalid parameters passed to useSocketEvent', { event, handlerType: typeof handler });
        return () => {};
      }
      
      // Create a stable reference to the handler to avoid unnecessary re-registrations
      const stableHandler = (...args) => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in socket event handler for ${event}:`, error);
        }
      };
      
      console.log(`Registering socket event listener for ${event}`);
      const removeListener = on(event, stableHandler);
      
      // Enhanced cleanup function
      return () => {
        console.log(`Cleaning up socket event listener for ${event}`);
        try {
          removeListener();
        } catch (error) {
          console.error(`Error cleaning up socket event listener for ${event}:`, error);
        }
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event, on, ...deps]);
  }, [on]);
  
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