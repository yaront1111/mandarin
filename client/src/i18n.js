import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import logger from "./utils/logger";

// Import the translation files
import enTranslations from './en.json';
import heTranslations from './he.json';

// Initialize i18next with all required modules
i18n
  .use(LanguageDetector)
  .use(initReactI18next);

const log = logger.create('i18n');

// Consolidated photo translations (migrated from translation-fix.js)
// These are now part of the main translation files and added here for backward compatibility
const photoTranslations = {
  // English translations
  en: {
    profile: {
      photos: "Photos",
      photo: "Photo",
      currentlyPrivate: "Currently private",
      currentlyPublic: "Currently public",
      currentlyFriendsOnly: "Currently visible to friends only",
      makePublic: "Make public",
      makePrivate: "Make private",
      makeFriendsOnly: "Make friends only",
      setAsProfilePhoto: "Set as profile photo",
      deletePhoto: "Delete photo"
    }
  },
  
  // Hebrew translations
  he: {
    profile: {
      photos: "תמונות",
      photo: "תמונה",
      currentlyPrivate: "כרגע פרטי",
      currentlyPublic: "כרגע ציבורי",
      currentlyFriendsOnly: "כרגע גלוי לחברים בלבד",
      makePublic: "הפוך לציבורי",
      makePrivate: "הפוך לפרטי",
      makeFriendsOnly: "הפוך לחברים בלבד",
      setAsProfilePhoto: "הגדר כתמונת פרופיל",
      deletePhoto: "מחק תמונה"
    }
  }
};

// --- Initialize i18next ---
i18n.init({
  // --- Resource Bundles ---
  // Load translations from the imported JSON files
  resources: {
    en: {
      translation: {
        ...enTranslations,
        // Ensure photo translations are available in the main bundle
        profile: {
          ...enTranslations.profile,
          ...photoTranslations.en.profile
        }
      },
    },
    he: {
      translation: {
        ...heTranslations,
        // Ensure photo translations are available in the main bundle
        profile: {
          ...heTranslations.profile,
          ...photoTranslations.he.profile
        }
      },
    },
  },

  // Force Hebrew translations to be used as fallback for missing keys in English
  // Note: This assumes 'he' has all keys 'en' might be missing.
  // Consider if 'en' should be the primary fallback instead.
  partialBundledLanguages: true,

  // --- Language Settings ---
  supportedLngs: ["en", "he"], // Explicitly list your supported languages
  fallbackLng: ["he", "en"], // Try Hebrew first, then English for missing keys
  // Use language stored in localStorage if available, otherwise let detector decide
  lng: localStorage.getItem("language") || undefined,

  // --- Namespace Settings ---
  // Using a single default namespace as per JSON structure
  ns: ["translation"],
  defaultNS: "translation",

  // --- Advanced Options ---
  keySeparator: ".", // Use '.' for nested keys (e.g., profile.iAm)
  nsSeparator: ":", // Namespace separator (not heavily used with single NS)

  // --- Detection Settings ---
  detection: {
    // Order and methods for detecting user language preference
    order: ["localStorage", "navigator", "htmlTag"], // Check localStorage first
    // Cache the detected language in localStorage
    caches: ["localStorage"],
  },

  // --- React Integration ---
  react: {
    // Use React Suspense for loading states (recommended)
    useSuspense: true,
    bindI18n: "languageChanged loaded", // Re-render on language change/load
  },

  // --- Special features ---
  returnEmptyString: false, // Return key if translation missing (handled by parseMissingKeyHandler)
  returnNull: false,        // Return key if translation missing
  returnObjects: true,      // Allow returning translation objects/arrays
  joinArrays: true,         // Allows joining array values (e.g., for lists)

  // Handler for missing keys - provides a fallback and logs a warning
  parseMissingKeyHandler: (key) => {
    log.warn(`Missing translation key: ${key}`);
    // Attempt to return a readable version of the last part of the key
    return key.split(".").pop().replace(/_/g, " ");
  },

  // Optionally save missing keys to the backend or log them (requires backend setup or custom logger)
  saveMissing: process.env.NODE_ENV === "development", // Only save missing in dev
  missingKeyHandler: (lng, ns, key, fallbackValue) => {
    // Log detailed info about missing keys during development
    if (process.env.NODE_ENV === "development") {
      log.info(
        `Missing translation - Language: ${lng}, NS: ${ns}, Key: ${key}, Fallback: ${fallbackValue}`,
      );
    }
    // In production, you might send this to a logging service
  },

  // --- Other Settings ---
  interpolation: {
    // React handles XSS escaping, so disable i18next's
    escapeValue: false,
  },

  // --- Debugging ---
  // Enable i18next verbose logs only during development
  debug: process.env.NODE_ENV === "development",
});

// Deprecated: This function is no longer needed as translations are now directly included
// in the main translation resources. It's kept here for backward compatibility.
export const addPhotoTranslations = (i18nInstance) => {
  log.info("addPhotoTranslations is deprecated. Translations are now in the main resources.");
  return i18nInstance;
};

export default i18n;
