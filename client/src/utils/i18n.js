// Utility functions for internationalization

import logger from './logger';

const log = logger.create('i18n-utils');

/**
 * Safely translates a key using multiple formats for backward compatibility.
 * This function handles the transition from inconsistent translation key formats
 * to the standardized dot notation format.
 * 
 * @param {string} key - The translation key in dot notation format (e.g., 'profile.photos.upload')
 * @param {Function} t - The translation function from useTranslation hook
 * @param {string} defaultValue - Default value to return if translation is not found
 * @return {string} The translated string or default value
 */
export const translate = (key, t, defaultValue = '') => {
  if (!key || typeof key !== 'string') {
    log.warn('Invalid translation key:', key);
    return defaultValue;
  }

  if (!t || typeof t !== 'function') {
    log.warn('Invalid translation function provided');
    return defaultValue;
  }

  try {
    // Try direct translation with the provided key (dot notation)
    const directTranslation = t(key);
    if (typeof directTranslation === 'string' && directTranslation !== key) {
      return directTranslation;
    }

    // Try underscore format (for backward compatibility)
    const underscoreKey = key.replace(/\./g, '_');
    const underscoreTranslation = t(underscoreKey);
    if (typeof underscoreTranslation === 'string' && underscoreTranslation !== underscoreKey) {
      return underscoreTranslation;
    }

    // Try accessing nested objects
    const parts = key.split('.');
    if (parts.length > 1) {
      // Try parent object access
      try {
        const parentKey = parts[0];
        const childPath = parts.slice(1);
        const parent = t(parentKey, { returnObjects: true });

        if (typeof parent === 'object' && parent !== null) {
          let value = parent;
          for (const pathPart of childPath) {
            if (value && typeof value === 'object' && pathPart in value) {
              value = value[pathPart];
            } else {
              value = null;
              break;
            }
          }

          if (typeof value === 'string') {
            return value;
          }
        }
      } catch (e) {
        // Continue with other methods
      }
    }

    // If all attempts fail, return default or key
    return defaultValue || key.split('.').pop().replace(/_/g, ' ');
  } catch (error) {
    log.error(`Translation error for key '${key}':`, error);
    return defaultValue;
  }
};

/**
 * Formats and translates tag values with proper namespace
 * 
 * @param {string} tagType - The type of tag (identity, lookingFor, etc.)
 * @param {string} tag - The tag value
 * @param {Function} t - The translation function
 * @return {string} Translated tag value
 */
export const translateTag = (tagType, tag, t) => {
  if (!tag || !tagType) return '';

  const normalizedTag = tag.toLowerCase().replace(/\s+/g, '_');
  const key = `profile.${tagType}.${normalizedTag}`;

  return translate(key, t, tag);
};

/**
 * Specialized translation function for profile section
 * Encapsulates common profile translation patterns
 * 
 * @param {string} subKey - The key within the profile namespace
 * @param {Function} t - The translation function
 * @param {string} defaultValue - Default fallback value
 * @return {string} Translated string
 */
export const translateProfile = (subKey, t, defaultValue = '') => {
  return translate(`profile.${subKey}`, t, defaultValue);
};

export default {
  translate,
  translateTag,
  translateProfile
};