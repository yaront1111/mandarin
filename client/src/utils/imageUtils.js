// src/utils/imageUtils.js

/**
 * Configuration for image URLs
 */
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Converts a relative image URL to an absolute URL
 * @param {string} url - The relative or absolute URL
 * @returns {string} The absolute URL
 */
export const getFullImageUrl = (url) => {
  if (!url) return '/placeholder.jpg'; // Fallback for missing images
  if (url.startsWith('http')) return url; // Already an absolute URL
  return `${API_BASE_URL}${url}`;
};

/**
 * Creates a URL for a user avatar
 * @param {string} url - The avatar URL or undefined
 * @param {string} fallbackText - Text to use for the initial avatar if no URL
 * @returns {Object} An object with url and type (either 'image' or 'initial')
 */
export const getAvatarUrl = (url, fallbackText = '') => {
  if (url) {
    return {
      url: getFullImageUrl(url),
      type: 'image'
    };
  }

  // If no URL, we'll use the first letter of fallbackText for an initial avatar
  return {
    initial: fallbackText.charAt(0).toUpperCase(),
    type: 'initial'
  };
};

/**
 * Get an object URL for a local file (for previews)
 * @param {File} file - The file to create a URL for
 * @returns {string} The created object URL
 */
export const createLocalImageUrl = (file) => {
  return URL.createObjectURL(file);
};

/**
 * Properly release object URLs to prevent memory leaks
 * @param {string} url - The object URL to revoke
 */
export const revokeLocalImageUrl = (url) => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

/**
 * Check if an image URL is valid by attempting to load it
 * @param {string} url - The image URL to validate
 * @returns {Promise<boolean>} Promise resolving to true if valid, false otherwise
 */
export const isImageUrlValid = (url) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
};
