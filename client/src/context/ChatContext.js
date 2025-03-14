// client/src/context/ChatContext.js
import React, { createContext, useReducer, useContext, useCallback, useState, useEffect } from 'react';
import apiService from '../services/apiService';
import socketService from '../services/socketService';
import { toast } from 'react-toastify';

const ChatContext = createContext();

const initialState = {
  messages: [],
  sending: false,
  error: null,
};

const chatReducer = (state, action) => {
  switch (action.type) {
    case 'SENDING_MESSAGE':
      return { ...state, sending: true, error: null };
    case 'SEND_MESSAGE':
      return { ...state, sending: false, messages: [...state.messages, action.payload] };
    case 'MESSAGE_ERROR':
      return { ...state, sending: false, error: action.payload };
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
};

export const ChatProvider = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const [currentChat, setCurrentChat] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [unreadMessages, setUnreadMessages] = useState([]);
  const [loadingUnread, setLoadingUnread] = useState(false);
  const [unreadError, setUnreadError] = useState(null);
  const [lastUnreadFetch, setLastUnreadFetch] = useState(0);
  const [unreadRetryCount, setUnreadRetryCount] = useState(0);

  // Fetch messages for a conversation
  const getMessages = useCallback(async (userId) => {
    if (!userId) return;

    try {
      const response = await apiService.get(`/messages/${userId}`);
      if (response.success) {
        dispatch({ type: 'SET_MESSAGES', payload: response.data || [] });
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to fetch messages');
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error(error.message || 'Failed to fetch messages');
      return [];
    }
  }, []);

  /**
   * Mark a message as read
   * IMPORTANT: This needs to be defined BEFORE it's used in any hook
   */
  const markMessageRead = useCallback(async (messageId) => {
    try {
      await apiService.put(`/messages/${messageId}/read`);
      // We're defining getUnreadMessages later, so we need to use a function reference here
      setUnreadMessages(prev => {
        // Remove the marked message from unread messages
        return prev.filter(msg => msg._id !== messageId);
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }, []);

  // Get unread messages with improved error handling and retry logic
  const getUnreadMessages = useCallback(async (force = false) => {
    // Prevent frequent calls
    const now = Date.now();
    const minInterval = 10000; // Minimum 10 seconds between calls

    if (!force && now - lastUnreadFetch < minInterval) {
      return;
    }

    // Check if we've attempted too many retries
    if (unreadRetryCount > 5) {
      console.warn('Too many failed attempts to fetch unread messages, giving up');
      setUnreadError('Unable to fetch unread messages after multiple attempts');
      return;
    }

    if (loadingUnread) return;

    setLoadingUnread(true);
    setLastUnreadFetch(now);

    try {
      const response = await apiService.get('/messages/unread/count');
      if (response && response.success) {
        // Reset retry count on success
        setUnreadRetryCount(0);
        setUnreadError(null);

        // Ensure we always have a valid array
        const messageData = Array.isArray(response.bySender) ? response.bySender : [];
        setUnreadMessages(messageData);
        return response;
      } else {
        throw new Error(response?.error || 'Failed to fetch unread messages');
      }
    } catch (error) {
      console.error('Error fetching unread messages:', error);

      // Increment retry count
      setUnreadRetryCount(prev => prev + 1);
      setUnreadError(error.message || 'Error fetching unread messages');

      // Schedule retry with exponential backoff
      const backoffTime = Math.min(30000, 1000 * Math.pow(2, unreadRetryCount));
      setTimeout(() => {
        getUnreadMessages(true);
      }, backoffTime);

      return null;
    } finally {
      setLoadingUnread(false);
    }
  }, [lastUnreadFetch, loadingUnread, unreadRetryCount]);

  /**
   * Send a message to a recipient with proper formatting.
   */
  const sendMessage = useCallback(async (recipient, type, content, metadata = null) => {
    dispatch({ type: 'SENDING_MESSAGE' });
    try {
      // Prepare message data based on message type
      let messageData = { recipient, type };
      if (type === 'text') {
        messageData.content = content;
      } else if (type === 'wink') {
        messageData.content = '😉';
      } else if (type === 'video') {
        messageData.content = 'Video Call';
      } else if (type === 'location') {
        if (metadata && metadata.location) {
          messageData.metadata = { location: metadata.location };
          messageData.content = content || 'Shared location';
        } else {
          throw new Error('Invalid location data');
        }
      } else {
        messageData.content = content || '';
        if (metadata) {
          messageData.metadata = metadata;
        }
      }

      // Send the message to the API endpoint
      const data = await apiService.post('/messages', messageData);
      if (!data.success) {
        throw new Error(data.error || 'Failed to send message');
      }
      const message = data.data;

      // Try to send via socket for real-time delivery
      try {
        await socketService.sendMessage(recipient, type, message._id);
      } catch (socketErr) {
        console.warn('Socket delivery failed, but message is saved:', socketErr);
      }

      dispatch({ type: 'SEND_MESSAGE', payload: message });
      return message;
    } catch (err) {
      const errorMsg = err.error || err.message || 'Failed to send message';
      dispatch({ type: 'MESSAGE_ERROR', payload: errorMsg });
      return null;
    }
  }, []);

  /**
   * Send a location message using proper formatting.
   */
  const sendLocationMessage = useCallback(async (recipient, locationData) => {
    try {
      if (!locationData || typeof locationData !== 'object') {
        throw new Error('Invalid location data');
      }
      let coordinates;
      if ('lat' in locationData && 'lng' in locationData) {
        const lat = parseFloat(locationData.lat);
        const lng = parseFloat(locationData.lng);
        if (isNaN(lat) || isNaN(lng)) {
          throw new Error('Invalid coordinates values');
        }
        coordinates = [lng, lat]; // [longitude, latitude]
      } else if (Array.isArray(locationData.coordinates) && locationData.coordinates.length === 2) {
        const longitude = parseFloat(locationData.coordinates[0]);
        const latitude = parseFloat(locationData.coordinates[1]);
        if (isNaN(longitude) || isNaN(latitude)) {
          throw new Error('Invalid coordinates values');
        }
        coordinates = [longitude, latitude];
      } else if ('longitude' in locationData && 'latitude' in locationData) {
        const longitude = parseFloat(locationData.longitude);
        const latitude = parseFloat(locationData.latitude);
        if (isNaN(longitude) || isNaN(latitude)) {
          throw new Error('Invalid coordinates values');
        }
        coordinates = [longitude, latitude];
      } else {
        throw new Error('Location must include valid coordinates');
      }
      if (coordinates[0] < -180 || coordinates[0] > 180 ||
          coordinates[1] < -90 || coordinates[1] > 90) {
        throw new Error('Coordinates out of valid range');
      }
      const messageData = {
        recipient,
        type: 'location',
        content: locationData.address || locationData.name || 'Shared location',
        metadata: {
          location: {
            coordinates,
            name: locationData.name || '',
            address: locationData.address || ''
          }
        }
      };
      return await sendMessage(
        recipient,
        'location',
        messageData.content,
        messageData.metadata
      );
    } catch (err) {
      const errorMsg = err.message || 'Failed to send location';
      dispatch({ type: 'MESSAGE_ERROR', payload: errorMsg });
      return null;
    }
  }, [sendMessage]);

  /**
   * Send typing indicator
   */
  const sendTyping = useCallback((recipientId) => {
    if (!recipientId) return;
    socketService.sendTyping(recipientId);
  }, []);

  /**
   * Initiate a video call
   */
  const initiateVideoCall = useCallback((recipientId) => {
    if (!recipientId) {
      toast.error('Cannot start call: No recipient selected');
      return;
    }
    try {
      socketService.initiateVideoCall(recipientId);
      toast.info('Calling...');
    } catch (error) {
      console.error('Error initiating call:', error);
      toast.error('Failed to start call');
    }
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // Effect to fetch unread messages on mount and set up socket listeners
  useEffect(() => {
    let isMounted = true;

    // Initial fetch
    getUnreadMessages(true);

    // Set up polling with increasing intervals if there are failures
    let pollInterval = 30000; // Start with 30 seconds
    let pollTimer = null;

    const pollUnreadMessages = () => {
      if (isMounted) {
        getUnreadMessages().finally(() => {
          // Calculate next interval based on success/failure
          if (unreadError) {
            pollInterval = Math.min(pollInterval * 1.5, 300000); // Max 5 minutes
          } else {
            pollInterval = 30000; // Reset to normal on success
          }

          if (isMounted) {
            pollTimer = setTimeout(pollUnreadMessages, pollInterval);
          }
        });
      }
    };

    // Start polling
    pollTimer = setTimeout(pollUnreadMessages, pollInterval);

    // Set up socket listeners for new messages
    const handleNewMessage = (message) => {
      if (currentChat && message.sender === currentChat._id) {
        // Add to current conversation
        dispatch({ type: 'SEND_MESSAGE', payload: message });
        // Mark as read automatically
        markMessageRead(message._id);
      } else {
        // Update unread count
        getUnreadMessages(true);
        // Show notification
        toast.info(`New message from ${message.senderName || 'Someone'}`);
      }
    };

    const handleTyping = (data) => {
      setTypingUsers(prev => ({
        ...prev,
        [data.userId]: Date.now()
      }));
    };

    // Connect socket handlers
    socketService.on('newMessage', handleNewMessage);
    socketService.on('userTyping', handleTyping);

    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
      socketService.off('newMessage', handleNewMessage);
      socketService.off('userTyping', handleTyping);
    };
  }, [currentChat, getUnreadMessages, markMessageRead, unreadError]);

  return (
    <ChatContext.Provider
      value={{
        messages: state.messages,
        sending: state.sending,
        error: state.error,
        unreadMessages,
        typingUsers,
        currentChat,
        loadingUnread,
        unreadError,
        sendMessage,
        sendLocationMessage,
        getMessages,
        getUnreadMessages,
        setCurrentChat,
        sendTyping,
        initiateVideoCall,
        markMessageRead,
        clearError
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
