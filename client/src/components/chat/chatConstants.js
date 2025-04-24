// src/components/chat/chatConstants.js

/**
 * File Settings
 */
// Maximum allowed file size for uploads (5MB)
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

// List of allowed MIME types for file uploads
export const ALLOWED_FILE_TYPES = [
    // Images
    "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
    // Documents
    "application/pdf",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    // Media
    "audio/mpeg", "audio/wav", "audio/ogg",
    "video/mp4", "video/quicktime", "video/webm"
];

/**
 * UI Constants
 */
// Common emojis available in the emoji picker
export const COMMON_EMOJIS = ["😊", "😂", "😍", "❤️", "👍", "🙌", "🔥", "✨", "🎉", "🤔", "😉", "🥰"];

/**
 * Timeouts and Delays
 */
// Time before showing timeout message for loading (10 seconds)
export const LOADING_TIMEOUT_MS = 10000;

// Delay before attempting reconnection (1.5 seconds)
export const RECONNECT_DELAY_MS = 1500;

// Delay before focusing input field (300ms)
export const INPUT_FOCUS_DELAY_MS = 300;

// Debounce time for typing indicator (400ms)
export const TYPING_DEBOUNCE_MS = 400;

// Debounce time for smooth scrolling (100ms)
export const SMOOTH_SCROLL_DEBOUNCE_MS = 100;

// Delay before clearing upload UI after completion (500ms)
export const UPLOAD_COMPLETE_DELAY_MS = 500;

/**
 * Mobile Specific Constants
 */
// Threshold for swipe gesture detection
export const SWIPE_THRESHOLD = 50;

// Threshold for pull-to-refresh gesture
export const PULL_TO_REFRESH_THRESHOLD = 50;

/**
 * Account Tiers
 */
export const ACCOUNT_TIER = {
    FREE: "FREE",
    PREMIUM: "PREMIUM",
    // Add future tiers here
};

/**
 * Message Types
 */
export const MESSAGE_TYPE = {
    TEXT: "text",
    WINK: "wink",
    FILE: "file",
    SYSTEM: "system",
    VIDEO: "video", // For call-related system messages
};
