// client/src/config.js
// Centralized configuration values for the client application

// API Configuration
export const API = {
  BASE_URL: '/api',
  TIMEOUT: 15000,
  RETRIES: {
    MAX_QUEUE_RETRIES: 3,      // Max retries for queued requests
    RETRY_DELAY_MS: 1000       // Delay between retries
  },
  HEALTH_CHECK: {
    TIMEOUT: 3000,             // Timeout for health checks
    CONNECTION_TEST_TIMEOUT: 5000, // Timeout for connection tests
    INTERVAL: 300000           // 5 minutes between automated checks
  },
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
  CONNECTION: {
    TIMEOUT: 30000, // Connection timeout in milliseconds
    HEARTBEAT_INTERVAL: 30000, // Heartbeat ping interval in milliseconds (30 seconds)
    HEARTBEAT_TIMEOUT: 60000, // Time to wait for pong response before reconnecting (60 seconds)
    MONITOR_INTERVAL: 45000, // Connection monitoring interval for notifications (45 seconds)
    RECONNECT_DELAY_MIN: 1000, // Minimum random delay before reconnection attempt
    RECONNECT_DELAY_MAX: 3000, // Maximum random delay before reconnection attempt
    ONLINE_RECONNECT_DELAY: 2000 // Delay before reconnection after browser comes online
  },
  TRANSPORT: {
    DEFAULT: ["polling", "websocket"], // Default transport options
    FALLBACK: ["polling"] // Fallback transport when WebSocket fails
  },
  URLS: {
    DEV: 'http://localhost:5000',
    PROD: window?.location?.origin || 'https://flirtss.com'
  },
  EVENTS: {
    // Chat events
    MESSAGE_RECEIVED: 'messageReceived',
    MESSAGE_SENT: 'messageSent',
    MESSAGE_ERROR: 'messageError',
    TYPING: 'userTyping',
    
    // Call events
    INCOMING_CALL: 'incomingCall',
    CALL_ANSWERED: 'callAnswered',
    CALL_INITIATED: 'callInitiated',
    CALL_ERROR: 'callError',
    VIDEO_SIGNAL: 'videoSignal',
    VIDEO_HANGUP: 'videoHangup',
    VIDEO_ERROR: 'videoError',
    VIDEO_MEDIA_CONTROL: 'videoMediaControl',
    
    // User events
    USER_ONLINE: 'userOnline',
    USER_OFFLINE: 'userOffline',
    
    // Notification events
    NOTIFICATION: 'notification',
    NEW_LIKE: 'newLike',
    NEW_COMMENT: 'newComment',
    NEW_STORY: 'newStory',
    NEW_MESSAGE: 'newMessage',
    PHOTO_PERMISSION_REQUEST: 'photoPermissionRequestReceived',
    PHOTO_PERMISSION_RESPONSE: 'photoPermissionResponseReceived',
    
    // Connection events
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    CONNECT_ERROR: 'connect_error',
    RECONNECT: 'reconnect',
    RECONNECT_ATTEMPT: 'reconnect_attempt',
    RECONNECT_ERROR: 'reconnect_error',
    RECONNECT_FAILED: 'reconnect_failed',
    
    // Server events
    WELCOME: 'welcome',
    PONG: 'pong',
    ERROR: 'error',
    AUTH_ERROR: 'auth_error',
    
    // Custom events
    SOCKET_CONNECTED: 'socketConnected',
    SOCKET_DISCONNECTED: 'socketDisconnected',
    SOCKET_RECONNECTED: 'socketReconnected',
    SOCKET_CONNECTION_FAILED: 'socketConnectionFailed',
    SOCKET_RECONNECT_FAILED: 'socketReconnectFailed',
    NOTIFICATION_SOCKET_RECONNECTED: 'notificationSocketReconnected'
  },
  NOTIFICATION: {
    SYNC_CHANNEL_NAME: 'notification_sync',
    SYNC_EVENT_TYPES: [
      'notification',
      'newMessage',
      'newLike',
      'photoPermissionRequestReceived',
      'photoPermissionResponseReceived',
      'newComment',
      'incomingCall', 
      'newStory'
    ],
    SYNC_ACTIONS: {
      NEW_NOTIFICATION: 'NEW_NOTIFICATION',
      MARK_READ: 'MARK_READ',
      MARK_ALL_READ: 'MARK_ALL_READ'
    }
  },
  TIMEOUT: {
    ACK: 2000, // 2 seconds for socket message acknowledgement
    INIT: 5000, // 5 seconds for initialization
    PERMISSION_REQUEST: 10000 // 10 seconds for permission request timeout
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
    TYPING: 1000, // 1s for typing indicator
    SMOOTH_SCROLL: 100 // 100ms for smooth scrolling
  },
  POLL: {
    NOTIFICATIONS: 60000 // 1 minute notification polling (fallback)
  },
  FETCH: {
    MESSAGES: 8000, // 8 seconds for fetching messages
    PROFILES: 5000  // 5 seconds for user profiles
  },
  MESSAGE: {
    DEDUPLICATION: 1500,   // 1.5 seconds for message deduplication
    PENDING_EXPIRY: 600000 // 10 minutes max age for pending messages
  },
  UI: {
    LOADING_TIMEOUT: 10000, // 10 seconds before showing timeout message
    INPUT_FOCUS_DELAY: 300, // 300ms delay before focusing input field
    UPLOAD_COMPLETE_DELAY: 500 // 500ms delay before clearing upload UI
  }
};

// Feature flags
export const FEATURES = {
  STORIES: true,
  VIDEO_CALLS: true,
  SUBSCRIPTIONS: true,
  PHOTO_PERMISSIONS: true
};

// Account tiers
export const ACCOUNT_TIER = {
  FREE: "FREE",
  PREMIUM: "PREMIUM",
  FEMALE: "FEMALE", // Special tier with enhanced features
  COUPLE: "COUPLE"  // Couples account type
};

// Message types
export const MESSAGE_TYPES = {
  TEXT: "text",
  WINK: "wink",
  FILE: "file",
  SYSTEM: "system",
  VIDEO: "video" // For call-related system messages
};

// UI Configuration
export const UI = {
  ANIMATIONS: {
    DIRECTION_CHANGE_MS: 50,    // Time for direction change animation
    CHAT_OPEN_DELAY_MS: 50      // Small delay for chat opening animation
  },
  TOAST: {
    AUTO_CLOSE_MS: 3000,        // Time before toast auto-closes
    MAX_TOASTS: 5,              // Maximum number of simultaneous toasts
    POSITION: 'top-right'       // Toast position
  },
  ANALYTICS: {
    GA4_ID: import.meta.env.VITE_GA4_MEASUREMENT_ID || 'G-Y9EQ02574T' // Google Analytics ID
  },
  MOBILE: {
    GESTURE: {
      SWIPE_THRESHOLD: 50,      // Threshold for swipe gesture detection
      PULL_TO_REFRESH_THRESHOLD: 50 // Threshold for pull-to-refresh gesture
    }
  },
  EMOJI: {
    // Common emojis available in the emoji picker
    COMMON: ["😊", "😂", "😍", "❤️", "👍", "🙌", "🔥", "✨", "🎉", "🤔", "😉", "🥰"]
  }
};

export default {
  API,
  CACHE,
  SOCKET,
  UPLOADS,
  TIMEOUTS,
  FEATURES,
  UI,
  ACCOUNT_TIER,
  MESSAGE_TYPES
};