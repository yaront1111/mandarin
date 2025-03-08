// src/config/constants.js

/**
 * Application constants for the Mandarin dating app
 * Centralizes configuration values, thresholds, and options
 */

// ===== USER ROLES AND PERMISSIONS =====
export const USER_ROLES = {
  FREE: 'free',
  PREMIUM: 'premium',
  PREMIUM_PLUS: 'premium_plus', // Higher tier with more features
  MODERATOR: 'moderator',
  ADMIN: 'admin',
};

export const ROLE_PERMISSIONS = {
  [USER_ROLES.FREE]: {
    maxPrivatePhotos: 3,
    maxLikesPerDay: 25,
    canAccessMapFeature: false,
    maxMessageThreads: 10,
  },
  [USER_ROLES.PREMIUM]: {
    maxPrivatePhotos: 15,
    maxLikesPerDay: 100,
    canAccessMapFeature: true,
    maxMessageThreads: 50,
  },
  [USER_ROLES.PREMIUM_PLUS]: {
    maxPrivatePhotos: -1, // Unlimited
    maxLikesPerDay: -1,   // Unlimited
    canAccessMapFeature: true,
    maxMessageThreads: -1, // Unlimited
  },
};

// ===== PROFILE INFORMATION =====
export const GENDERS = {
  MALE: 'male',
  FEMALE: 'female',
  NON_BINARY: 'non_binary',
  TRANSGENDER_MALE: 'transgender_male',
  TRANSGENDER_FEMALE: 'transgender_female',
  GENDER_FLUID: 'gender_fluid',
  OTHER: 'other',
};

export const RELATIONSHIP_STATUSES = {
  SINGLE: 'single',
  OPEN_RELATIONSHIP: 'open_relationship',
  POLYAMOROUS: 'polyamorous',
  PARTNERED: 'partnered',
  MARRIED: 'married',
  OTHER: 'other',
};

export const RELATIONSHIP_GOALS = {
  CASUAL: 'casual',
  DATING: 'dating',
  LONG_TERM: 'long_term',
  FRIENDS: 'friends',
  PLAY_PARTNERS: 'play_partners',
  EXPERIMENTATION: 'experimentation',
};

// ===== COMPATIBILITY SETTINGS =====
export const COMPATIBILITY_THRESHOLD = {
  HIGHLIGHT: 75,     // Highlight matches above this percentage
  EXCEPTIONAL: 90,   // Label as "exceptional match" above this
  MINIMUM_SHOW: 40,  // Only show matches above this threshold
};

export const DEFAULT_COMPATIBILITY_WEIGHT = {
  INTERESTS: 0.4,
  PREFERENCES: 0.3,
  RELATIONSHIP_GOALS: 0.2,
  LOCATION: 0.1,
};

// ===== CONTENT LIMITS =====
export const MAX_PHOTO_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_STORY_VIDEO_LENGTH = 30; // Seconds
export const MAX_STORY_DURATION = 24; // Hours until expiration
export const MAX_PROFILE_PHOTOS = 9;

// ===== DISCOVERY SETTINGS =====
export const DISTANCE_UNITS = {
  MILES: 'miles',
  KILOMETERS: 'kilometers',
};

export const DEFAULT_SEARCH_RADIUS = 10; // miles
export const MAX_SEARCH_RADIUS = {
  [USER_ROLES.FREE]: 25,
  [USER_ROLES.PREMIUM]: 50,
  [USER_ROLES.PREMIUM_PLUS]: 100,
};

export const MAP_ZOOM_LEVELS = {
  NEIGHBORHOOD: 14,
  CITY: 10,
  REGION: 8,
};

// ===== PRIVACY SETTINGS =====
export const PRIVACY_MODES = {
  PUBLIC: 'public',        // Visible to all users
  RESTRICTED: 'restricted', // Visible to matches only
  STEALTH: 'stealth',      // Hidden from discovery
};

export const PRIVATE_PHOTO_ACCESS_STATES = {
  PENDING: 'pending',
  GRANTED: 'granted',
  DENIED: 'denied',
  REVOKED: 'revoked',
};

// ===== MODERATION =====
export const REPORT_REASONS = {
  FAKE_PROFILE: 'fake_profile',
  INAPPROPRIATE_CONTENT: 'inappropriate_content',
  HARASSMENT: 'harassment',
  NON_CONSENSUAL: 'non_consensual',
  SPAM: 'spam',
  UNDERAGE: 'underage',
};

export const MODERATION_ACTIONS = {
  WARNING: 'warning',
  CONTENT_REMOVAL: 'content_removal',
  TEMPORARY_BAN: 'temporary_ban',
  PERMANENT_BAN: 'permanent_ban',
};

// ===== UI SETTINGS =====
export const UI_THEME = {
  DARK: 'dark',
  LIGHT: 'light',
  SYSTEM: 'system',
};

export const ANIMATION_DURATION = {
  SHORT: 150,
  MEDIUM: 300,
  LONG: 500,
};

// ===== API SETTINGS =====
export const API_RATE_LIMITS = {
  [USER_ROLES.FREE]: 100,      // Requests per hour
  [USER_ROLES.PREMIUM]: 500,
  [USER_ROLES.PREMIUM_PLUS]: 1000,
};

export const API_TIMEOUT = 30000; // 30 seconds

// ===== FEATURE FLAGS =====
export const FEATURES = {
  STORIES_ENABLED: true,
  MAP_DISCOVERY_ENABLED: true,
  ICEBREAKER_SUGGESTIONS_ENABLED: true,
  VIDEO_CHAT_ENABLED: false, // Coming soon
  EVENTS_ENABLED: false,     // Coming soon
};
