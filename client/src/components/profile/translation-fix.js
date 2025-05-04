// This file provides direct translation key mappings for the photo management system
// Import this file in components that need the translated strings

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

// Function to add translations to i18next instance
export const addPhotoTranslations = (i18n) => {
  // Add English translations
  i18n.addResources('en', 'translation', {
    profile: {
      photos: photoTranslations.en["profile.photos"],
      photo: photoTranslations.en["profile.photo"],
      currentlyPrivate: photoTranslations.en["profile.currentlyPrivate"],
      currentlyPublic: photoTranslations.en["profile.currentlyPublic"],
      currentlyFriendsOnly: photoTranslations.en["profile.currentlyFriendsOnly"],
      makePublic: photoTranslations.en["profile.makePublic"],
      makePrivate: photoTranslations.en["profile.makePrivate"],
      makeFriendsOnly: photoTranslations.en["profile.makeFriendsOnly"],
      setAsProfilePhoto: photoTranslations.en["profile.setAsProfilePhoto"],
      deletePhoto: photoTranslations.en["profile.deletePhoto"]
    }
  });
  
  // Add Hebrew translations
  i18n.addResources('he', 'translation', {
    profile: {
      photos: photoTranslations.he["profile.photos"],
      photo: photoTranslations.he["profile.photo"],
      currentlyPrivate: photoTranslations.he["profile.currentlyPrivate"],
      currentlyPublic: photoTranslations.he["profile.currentlyPublic"],
      currentlyFriendsOnly: photoTranslations.he["profile.currentlyFriendsOnly"],
      makePublic: photoTranslations.he["profile.makePublic"],
      makePrivate: photoTranslations.he["profile.makePrivate"],
      makeFriendsOnly: photoTranslations.he["profile.makeFriendsOnly"],
      setAsProfilePhoto: photoTranslations.he["profile.setAsProfilePhoto"],
      deletePhoto: photoTranslations.he["profile.deletePhoto"]
    }
  });
  
  return i18n;
};

export default photoTranslations;