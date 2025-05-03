// client/src/config.js
// Centralized configuration values for the client application

// API Configuration
export const API = {
  BASE_URL: '/api',
  TIMEOUT: 15000,
  ENDPOINTS: {
    AUTH: {
      LOGIN: '/auth/login',
      REGISTER: '/auth/register',
      VERIFY: '/auth/verify-email',
      ME: '/auth/me',
      REFRESH: '/auth/refresh-token',
      TEST: '/auth/test-connection'
    },
    USERS: {
      PROFILE: '/users/profile',
      AVATAR: '/users/avatar',
      SEARCH: '/users/search',
      SUGGEST: '/users/suggest'
    },
    MESSAGES: {
      BASE: '/messages',
      CONVERSATIONS: '/messages/conversations'
    },
    NOTIFICATIONS: {
      BASE: '/notifications',
      READ: '/notifications/read',
      READ_ALL: '/notifications/read-all'
    },
    SUBSCRIPTIONS: {
      STATUS: '/subscription/status',
      UPGRADE: '/subscription/upgrade',
      CANCEL: '/subscription/cancel'
    },
    STORIES: {
      BASE: '/stories',
      USER: (userId) => `/stories/user/${userId}`
    }
  }
};

// Cache Configuration
export const CACHE = {
  SIZE: Number.parseInt(import.meta.env.VITE_CACHE_SIZE || '100', 10),
  TTL: {
    DEFAULT: Number.parseInt(import.meta.env.VITE_CACHE_TTL || '60000', 10), // 1 minute default
    MESSAGES: 10000, // 10 seconds for messages
    USER_PROFILE: 120000, // 2 minutes for user profiles
    STORIES: 60000, // 1 minute for stories
    CONVERSATIONS: 60000 // 1 minute for conversations
  }
};

// Socket Configuration
export const SOCKET = {
  RECONNECT: {
    MAX_ATTEMPTS: 5,
    DELAY: 5000,
    DELAY_MAX: 30000
  },
  EVENTS: {
    // Chat events
    MESSAGE_RECEIVED: 'messageReceived',
    MESSAGE_SENT: 'messageSent',
    MESSAGE_ERROR: 'messageError',
    TYPING: 'typing',
    
    // Call events
    INCOMING_CALL: 'incomingCall',
    CALL_ANSWERED: 'callAnswered',
    CALL_INITIATED: 'callInitiated',
    CALL_ERROR: 'callError',
    VIDEO_SIGNAL: 'videoSignal',
    VIDEO_HANGUP: 'videoHangup',
    
    // Notification events
    NEW_LIKE: 'newLike',
    NEW_COMMENT: 'newComment',
    NEW_STORY: 'newStory',
    PHOTO_PERMISSION_REQUEST: 'photoPermissionRequestReceived',
    PHOTO_PERMISSION_RESPONSE: 'photoPermissionResponseReceived',
    
    // Connection events
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    CONNECT_ERROR: 'connect_error'
  },
  TIMEOUT: {
    ACK: 2000, // 2 seconds for socket message acknowledgement
    INIT: 5000 // 5 seconds for initialization
  }
};

// File Upload Configuration
export const UPLOADS = {
  MAX_SIZE: {
    AVATAR: 5 * 1024 * 1024, // 5MB
    PHOTO: 10 * 1024 * 1024, // 10MB
    MESSAGE: 50 * 1024 * 1024, // 50MB
    STORY: 20 * 1024 * 1024 // 20MB
  },
  ALLOWED_TYPES: {
    IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    VIDEOS: ['video/mp4', 'video/webm', 'video/quicktime'],
    AUDIO: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
    DOCUMENTS: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  }
};

// Timeouts and intervals
export const TIMEOUTS = {
  DEBOUNCE: {
    SEARCH: 300, // 300ms for search input
    TYPING: 1000 // 1s for typing indicator
  },
  POLL: {
    NOTIFICATIONS: 60000 // 1 minute notification polling (fallback)
  }
};

// Feature flags
export const FEATURES = {
  STORIES: true,
  VIDEO_CALLS: true,
  SUBSCRIPTIONS: true,
  PHOTO_PERMISSIONS: true
};

export default {
  API,
  CACHE,
  SOCKET,
  UPLOADS,
  TIMEOUTS,
  FEATURES
};