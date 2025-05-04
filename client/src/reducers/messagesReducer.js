// client/src/reducers/messagesReducer.js
import { logger } from "../utils/logger";

const log = logger.create("messagesReducer");

// Define action types as constants to avoid typos
export const ACTIONS = {
  // Conversation actions
  SET_CONVERSATIONS: "SET_CONVERSATIONS",
  APPEND_CONVERSATIONS: "APPEND_CONVERSATIONS",
  SET_ACTIVE_CONVERSATION: "SET_ACTIVE_CONVERSATION",
  UPDATE_CONVERSATION: "UPDATE_CONVERSATION",
  
  // Message actions
  SET_MESSAGES: "SET_MESSAGES",
  ADD_MESSAGE: "ADD_MESSAGE",
  UPDATE_MESSAGE: "UPDATE_MESSAGE",
  DELETE_MESSAGE: "DELETE_MESSAGE",
  
  // Input actions
  SET_MESSAGE_INPUT: "SET_MESSAGE_INPUT",
  SET_ATTACHMENT: "SET_ATTACHMENT",
  RESET_INPUT: "RESET_INPUT",
  
  // UI actions
  TOGGLE_SIDEBAR: "TOGGLE_SIDEBAR",
  TOGGLE_EMOJIS: "TOGGLE_EMOJIS",
  SET_TYPING_USER: "SET_TYPING_USER",
  
  // Status actions
  SET_COMPONENT_LOADING: "SET_COMPONENT_LOADING",
  SET_MESSAGES_LOADING: "SET_MESSAGES_LOADING",
  SET_SENDING: "SET_SENDING",
  SET_UPLOADING: "SET_UPLOADING",
  SET_UPLOAD_PROGRESS: "SET_UPLOAD_PROGRESS",
  SET_ERROR: "SET_ERROR",
  CLEAR_ERROR: "CLEAR_ERROR",
  
  // Call actions
  SET_CALL_ACTIVE: "SET_CALL_ACTIVE",
  SET_INCOMING_CALL: "SET_INCOMING_CALL",
  
  // Mobile actions
  SET_SHOW_INSTALL_BANNER: "SET_SHOW_INSTALL_BANNER",
  SET_REFRESHING: "SET_REFRESHING",
  SET_TOUCH_START: "SET_TOUCH_START",
  SET_PULL_DISTANCE: "SET_PULL_DISTANCE",
  SET_SWIPE_DIRECTION: "SET_SWIPE_DIRECTION"
};

// Initial state for the messages component
export const initialState = {
  // Chat data
  chat: {
    conversations: [],
    activeConversation: null,
    messages: [],
    messageInput: "",
    typingUser: null,
  },
  
  // UI state
  ui: {
    showSidebar: true,
    showEmojis: false,
    isRefreshing: false,
    showInstallBanner: false,
    pullDistance: 0,
    swipeDirection: null,
  },
  
  // Media state
  media: {
    attachment: null,
    isUploading: false,
    uploadProgress: 0,
  },
  
  // Call state
  call: {
    isCallActive: false,
    incomingCall: null,
  },
  
  // Loading and error state
  status: {
    componentLoading: true,
    messagesLoading: false,
    isSending: false,
    error: null,
  },
  
  // Touch state for mobile
  touch: {
    touchStartX: 0,
    touchStartY: 0,
  }
};

/**
 * Reducer function for Messages component
 * @param {Object} state - Current state
 * @param {Object} action - Action to perform
 * @returns {Object} New state
 */
export function messagesReducer(state, action) {
  const { type, payload } = action;
  log.debug(`Reducer action: ${type}`, payload); // Add logging
  
  try {
    switch (type) {
      // Conversation actions
      case ACTIONS.SET_CONVERSATIONS:
        log.debug(`SET_CONVERSATIONS: Received ${payload?.length || 0} conversations`);
        if (!payload || !Array.isArray(payload)) {
          log.warn("SET_CONVERSATIONS: Invalid payload, defaulting to empty array");
          return {
            ...state,
            chat: {
              ...state.chat,
              conversations: []
            }
          };
        }
        
        // Ensure we're updating with valid data
        const validConversations = payload.filter(c => c && typeof c === 'object');
        if (validConversations.length !== payload.length) {
          log.warn(`SET_CONVERSATIONS: Filtered out ${payload.length - validConversations.length} invalid conversations`);
        }
        
        return {
          ...state,
          chat: {
            ...state.chat,
            conversations: validConversations
          }
        };
        
      case ACTIONS.APPEND_CONVERSATIONS:
        return {
          ...state,
          chat: {
            ...state.chat,
            conversations: [...state.chat.conversations, ...payload]
          }
        };
        
      case ACTIONS.SET_ACTIVE_CONVERSATION:
        log.debug(`SET_ACTIVE_CONVERSATION: Setting active conversation`, payload);
        
        // Validate payload
        if (!payload || !payload._id) {
          log.warn("SET_ACTIVE_CONVERSATION: Invalid payload", payload);
          return state;
        }
        
        return {
          ...state,
          chat: {
            ...state.chat,
            activeConversation: payload
          }
        };
        
      case ACTIONS.UPDATE_CONVERSATION:
        return {
          ...state,
          chat: {
            ...state.chat,
            conversations: state.chat.conversations.map(conv => 
              conv._id === payload._id ? { ...conv, ...payload } : conv
            )
          }
        };
        
      // Message actions
      case ACTIONS.SET_MESSAGES:
        return {
          ...state,
          chat: {
            ...state.chat,
            messages: payload
          }
        };
        
      case ACTIONS.ADD_MESSAGE:
        // Prevent adding duplicates more robustly
        const messageExists = state.chat.messages.some(m =>
          (payload._id && m._id === payload._id) ||
          (payload.tempId && m.tempId === payload.tempId)
        );
        if (messageExists) {
          log.warn(`Attempted to add duplicate message: ${payload._id || payload.tempId}`);
          return state; // Return current state if duplicate
        }
        // Ensure messages are sorted correctly after adding
        const newMessagesAdd = [...state.chat.messages, payload].sort((a, b) => 
          new Date(a.createdAt) - new Date(b.createdAt)
        );
        return {
          ...state,
          chat: {
            ...state.chat,
            messages: newMessagesAdd
          }
        };
        
      case ACTIONS.UPDATE_MESSAGE:
        let messageUpdated = false;
        const updatedMessages = state.chat.messages.map(msg => {
          // Match by actual ID first, then by tempId
          if ((msg._id && msg._id === payload._id) || (msg.tempId && msg.tempId === payload.tempId)) {
            messageUpdated = true;
            // Merge existing message with payload, prioritizing payload for updated fields
            // but keeping potentially local-only fields like 'status' or 'error' if not in payload
            return { ...msg, ...payload, tempId: msg.tempId }; // Preserve original tempId if matched by _id
          }
          return msg;
        });

        // If the message to update wasn't found, potentially add it (depends on desired behavior)
        if (!messageUpdated && payload._id) {
          log.warn(`Message update target not found (ID: ${payload._id}, TempID: ${payload.tempId}), adding instead.`);
          // Avoid adding if it's just a status update for a message already sent
          if (!state.chat.messages.some(m => m._id === payload._id)) {
            updatedMessages.push(payload);
            updatedMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          }
        }

        return {
          ...state,
          chat: {
            ...state.chat,
            messages: updatedMessages
          }
        };
        
      case ACTIONS.DELETE_MESSAGE:
        return {
          ...state,
          chat: {
            ...state.chat,
            messages: state.chat.messages.filter(msg => msg._id !== payload)
          }
        };
        
      // Input actions
      case ACTIONS.SET_MESSAGE_INPUT:
        return {
          ...state,
          chat: {
            ...state.chat,
            messageInput: payload
          }
        };
        
      case ACTIONS.SET_ATTACHMENT:
        return {
          ...state,
          media: {
            ...state.media,
            attachment: payload
          }
        };
        
      case ACTIONS.RESET_INPUT:
        return {
          ...state,
          chat: {
            ...state.chat,
            messageInput: ""
          },
          media: {
            ...state.media,
            attachment: null,
            uploadProgress: 0
          }
        };
        
      // UI actions
      case ACTIONS.TOGGLE_SIDEBAR:
        return {
          ...state,
          ui: {
            ...state.ui,
            showSidebar: payload !== undefined ? payload : !state.ui.showSidebar
          }
        };
        
      case ACTIONS.TOGGLE_EMOJIS:
        return {
          ...state,
          ui: {
            ...state.ui,
            showEmojis: payload !== undefined ? payload : !state.ui.showEmojis
          }
        };
        
      case ACTIONS.SET_TYPING_USER:
        return {
          ...state,
          chat: {
            ...state.chat,
            typingUser: payload
          }
        };
        
      // Status actions
      case ACTIONS.SET_COMPONENT_LOADING:
        return {
          ...state,
          status: {
            ...state.status,
            componentLoading: payload
          }
        };
        
      case ACTIONS.SET_MESSAGES_LOADING:
        return {
          ...state,
          status: {
            ...state.status,
            messagesLoading: payload
          }
        };
        
      case ACTIONS.SET_SENDING:
        return {
          ...state,
          status: {
            ...state.status,
            isSending: payload
          }
        };
        
      case ACTIONS.SET_UPLOADING:
        return {
          ...state,
          media: {
            ...state.media,
            isUploading: payload
          }
        };
        
      case ACTIONS.SET_UPLOAD_PROGRESS:
        return {
          ...state,
          media: {
            ...state.media,
            uploadProgress: payload
          }
        };
        
      case ACTIONS.SET_ERROR:
        return {
          ...state,
          status: {
            ...state.status,
            error: payload
          }
        };
        
      case ACTIONS.CLEAR_ERROR:
        return {
          ...state,
          status: {
            ...state.status,
            error: null
          }
        };
        
      // Call actions
      case ACTIONS.SET_CALL_ACTIVE:
        return {
          ...state,
          call: {
            ...state.call,
            isCallActive: payload
          }
        };
        
      case ACTIONS.SET_INCOMING_CALL:
        return {
          ...state,
          call: {
            ...state.call,
            incomingCall: payload
          }
        };
        
      // Mobile actions
      case ACTIONS.SET_SHOW_INSTALL_BANNER:
        return {
          ...state,
          ui: {
            ...state.ui,
            showInstallBanner: payload
          }
        };
        
      case ACTIONS.SET_REFRESHING:
        return {
          ...state,
          ui: {
            ...state.ui,
            isRefreshing: payload
          }
        };
        
      case ACTIONS.SET_TOUCH_START:
        return {
          ...state,
          touch: {
            touchStartX: payload.x,
            touchStartY: payload.y
          }
        };
        
      case ACTIONS.SET_PULL_DISTANCE:
        return {
          ...state,
          ui: {
            ...state.ui,
            pullDistance: payload
          }
        };
        
      case ACTIONS.SET_SWIPE_DIRECTION:
        return {
          ...state,
          ui: {
            ...state.ui,
            swipeDirection: payload
          }
        };
        
      default:
        log.warn(`Unknown action type: ${type}`);
        return state;
    }
  } catch (error) {
    log.error(`Error in messagesReducer:`, error, { state, action }); // Log state and action on error
    // Return previous state on error to prevent crashing
    return state;
  }
}

// Helper action creators for common operations
export const loadConversations = (conversations) => ({
  type: ACTIONS.SET_CONVERSATIONS,
  payload: conversations
});

export const setActiveConversation = (conversation) => ({
  type: ACTIONS.SET_ACTIVE_CONVERSATION,
  payload: conversation
});

export const loadMessages = (messages) => ({
  type: ACTIONS.SET_MESSAGES,
  payload: messages
});

export const addMessage = (message) => ({
  type: ACTIONS.ADD_MESSAGE,
  payload: message
});

export const setMessageInput = (text) => ({
  type: ACTIONS.SET_MESSAGE_INPUT,
  payload: text
});

export const toggleSidebar = (show) => ({
  type: ACTIONS.TOGGLE_SIDEBAR,
  payload: show
});

export const setError = (error) => ({
  type: ACTIONS.SET_ERROR,
  payload: error
});

export const setLoadingState = (loading) => ({
  type: ACTIONS.SET_COMPONENT_LOADING,
  payload: loading
});

export const resetInput = () => ({
  type: ACTIONS.RESET_INPUT
});