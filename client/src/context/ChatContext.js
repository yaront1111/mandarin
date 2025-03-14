// client/src/context/ChatContext.js
import React, { createContext, useReducer, useContext, useCallback } from 'react';
import apiService from '../services/apiService';
import socketService from '../services/socketService';

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
    default:
      return state;
  }
};

export const ChatProvider = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  /**
   * Send a message to a recipient with proper formatting.
   * Supports types: text, wink, video, location.
   *
   * @param {string} recipient - Recipient user ID.
   * @param {string} type - Message type.
   * @param {string|object} content - Message content or location data.
   * @param {object} metadata - Optional metadata.
   * @returns {Promise<object|null>} - Sent message or null if failed.
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
        // Handle location messages: Accept various formats
        if (content && typeof content === 'object' && 'lat' in content && 'lng' in content) {
          const { lat, lng, name, address } = content;
          const latitude = parseFloat(lat);
          const longitude = parseFloat(lng);
          if (isNaN(latitude) || isNaN(longitude)) {
            throw new Error('Invalid location coordinates');
          }
          messageData.metadata = {
            location: {
              coordinates: [longitude, latitude], // [longitude, latitude] order
              name: name || '',
              address: address || ''
            }
          };
          messageData.content = address || name || 'Shared location';
        } else if (content && typeof content === 'object' && 'coordinates' in content) {
          const { coordinates, name, address } = content;
          if (!Array.isArray(coordinates) || coordinates.length !== 2 ||
              isNaN(parseFloat(coordinates[0])) || isNaN(parseFloat(coordinates[1]))) {
            throw new Error('Invalid coordinates format');
          }
          const longitude = parseFloat(coordinates[0]);
          const latitude = parseFloat(coordinates[1]);
          messageData.metadata = {
            location: {
              coordinates: [longitude, latitude],
              name: name || '',
              address: address || ''
            }
          };
          messageData.content = address || name || 'Shared location';
        } else if (metadata && metadata.location && metadata.location.coordinates) {
          let coordinates = metadata.location.coordinates;
          if (!Array.isArray(coordinates) || coordinates.length !== 2) {
            throw new Error('Invalid coordinates array');
          }
          const longitude = parseFloat(coordinates[0]);
          const latitude = parseFloat(coordinates[1]);
          if (isNaN(longitude) || isNaN(latitude)) {
            throw new Error('Coordinates must be valid numbers');
          }
          messageData.metadata = {
            location: {
              coordinates: [longitude, latitude],
              name: metadata.location.name || '',
              address: metadata.location.address || ''
            }
          };
          messageData.content = content || metadata.location.address ||
            metadata.location.name || 'Shared location';
        } else {
          throw new Error('Invalid location data format');
        }
      } else {
        // For any other type, use provided content and metadata
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
   * Accepts various location data formats.
   *
   * @param {string} recipient - Recipient user ID.
   * @param {object} locationData - Location data (supports {lat, lng}, {coordinates: [...]}, or {longitude, latitude}).
   * @returns {Promise<object|null>} - Sent message or null if failed.
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

  return (
    <ChatContext.Provider
      value={{
        messages: state.messages,
        sending: state.sending,
        error: state.error,
        sendMessage,
        sendLocationMessage,
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
