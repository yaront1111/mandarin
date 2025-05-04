// src/components/chat/chatConstants.js
import { UPLOADS, TIMEOUTS, SOCKET, ACCOUNT_TIER, MESSAGE_TYPES, UI } from '../../config';

/**
 * File Settings
 */
// Maximum allowed file size for uploads (5MB)
export const MAX_FILE_SIZE = UPLOADS.MAX_SIZE.AVATAR;

// List of allowed MIME types for file uploads (combined from config)
export const ALLOWED_FILE_TYPES = [
    ...UPLOADS.ALLOWED_TYPES.IMAGES,
    ...UPLOADS.ALLOWED_TYPES.DOCUMENTS,
    ...UPLOADS.ALLOWED_TYPES.AUDIO,
    ...UPLOADS.ALLOWED_TYPES.VIDEOS,
    "text/plain" // Additional type not in config
];

/**
 * UI Constants
 */
// Common emojis available in the emoji picker
export const COMMON_EMOJIS = UI.EMOJI.COMMON;

// Time before showing timeout message for loading
export const LOADING_TIMEOUT_MS = TIMEOUTS.UI.LOADING_TIMEOUT;

// Delay before attempting reconnection
export const RECONNECT_DELAY_MS = SOCKET.CONNECTION.RECONNECT_DELAY_MIN;

// Delay before focusing input field
export const INPUT_FOCUS_DELAY_MS = TIMEOUTS.UI.INPUT_FOCUS_DELAY;

// Debounce time for typing indicator
export const TYPING_DEBOUNCE_MS = TIMEOUTS.DEBOUNCE.TYPING;

// Debounce time for smooth scrolling
export const SMOOTH_SCROLL_DEBOUNCE_MS = TIMEOUTS.DEBOUNCE.SMOOTH_SCROLL;

// Delay before clearing upload UI after completion
export const UPLOAD_COMPLETE_DELAY_MS = TIMEOUTS.UI.UPLOAD_COMPLETE_DELAY;

/**
 * Mobile Specific Constants
 */
// Threshold for swipe gesture detection
export const SWIPE_THRESHOLD = UI.MOBILE.GESTURE.SWIPE_THRESHOLD;

// Threshold for pull-to-refresh gesture
export const PULL_TO_REFRESH_THRESHOLD = UI.MOBILE.GESTURE.PULL_TO_REFRESH_THRESHOLD;

/**
 * Account Tiers and Message Types
 */
// Re-export for backward compatibility
export { ACCOUNT_TIER };
export const MESSAGE_TYPE = MESSAGE_TYPES;
