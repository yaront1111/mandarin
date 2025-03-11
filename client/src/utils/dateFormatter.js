// src/utils/dateFormatter.js

/**
 * Format a date to show how long ago it occurred
 * @param {Date|string} date - The date to format
 * @returns {string} - Formatted string (e.g., "5 minutes ago", "2 hours ago", "3 days ago")
 */
export const formatDistanceToNow = (date) => {
  if (!date) return '';

  const now = new Date();
  const past = new Date(date);
  const diff = now - past;

  // Convert diff to seconds, minutes, hours, days
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) {
    // If more than 30 days, show the date
    return past.toLocaleDateString();
  } else if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'just now';
  }
};

/**
 * Format a timestamp for messages
 * @param {Date|string} date - The date to format
 * @returns {string} - Formatted time string (e.g., "14:30")
 */
export const formatMessageTime = (date) => {
  if (!date) return '';

  const messageDate = new Date(date);
  return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Check if a date is today
 * @param {Date|string} date - The date to check
 * @returns {boolean} - True if the date is today
 */
export const isToday = (date) => {
  if (!date) return false;

  const today = new Date();
  const checkDate = new Date(date);

  return checkDate.getDate() === today.getDate() &&
         checkDate.getMonth() === today.getMonth() &&
         checkDate.getFullYear() === today.getFullYear();
};
