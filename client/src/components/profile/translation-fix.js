// DEPRECATED: This file is deprecated and maintained only for backward compatibility.
// All translations have been moved to the main translation files.

import logger from '../../utils/logger';

const log = logger.create('translation-fix-deprecated');

// Translations have been moved to main translation files, but kept here for reference
const photoTranslations = {
  // English translations
  en: {
    "profile.photos": "Photos",
    "profile.photo": "Photo",
    "profile.currentlyPrivate": "Currently private",
    "profile.currentlyPublic": "Currently public",
    "profile.currentlyFriendsOnly": "Currently visible to friends only",
    "profile.makePublic": "Make public",
    "profile.makePrivate": "Make private",
    "profile.makeFriendsOnly": "Make friends only",
    "profile.setAsProfilePhoto": "Set as profile photo",
    "profile.deletePhoto": "Delete photo"
  },
  
  // Hebrew translations
  he: {
    "profile.photos": "תמונות",
    "profile.photo": "תמונה",
    "profile.currentlyPrivate": "כרגע פרטי",
    "profile.currentlyPublic": "כרגע ציבורי",
    "profile.currentlyFriendsOnly": "כרגע גלוי לחברים בלבד",
    "profile.makePublic": "הפוך לציבורי",
    "profile.makePrivate": "הפוך לפרטי",
    "profile.makeFriendsOnly": "הפוך לחברים בלבד",
    "profile.setAsProfilePhoto": "הגדר כתמונת פרופיל",
    "profile.deletePhoto": "מחק תמונה"
  }
};

// DEPRECATED: This function is deprecated. Translations are now included in the main files.
export const addPhotoTranslations = (i18n) => {
  log.warn('addPhotoTranslations is deprecated and will be removed in a future version.');
  log.warn('Translations are now included directly in the main translation files via i18n.js.');
  
  // Function body kept for backward compatibility but doesn't do anything
  return i18n;
};

export default photoTranslations;