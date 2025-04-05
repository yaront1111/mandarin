import React, { createContext, useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

// Create context
export const LanguageContext = createContext();

// Custom hook to use the language context
export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }) => {
  const { t } = useTranslation();
  const [language, setLanguage] = useState(i18n.language || 'en');
  const [isRTL, setIsRTL] = useState(i18n.language === 'he');
  
  // Immediately set the HTML language attribute on mount to ensure it's correct
  useEffect(() => {
    // Set the document language attribute right away
    const currentLanguage = i18n.language || 'en';
    document.documentElement.setAttribute('lang', currentLanguage);
    document.documentElement.setAttribute('dir', currentLanguage === 'he' ? 'rtl' : 'ltr');
    
    // Add appropriate class to HTML element
    if (currentLanguage === 'he') {
      document.documentElement.classList.add('rtl');
    } else {
      document.documentElement.classList.remove('rtl');
    }
  }, []);

  // Check if user is from Israel to automatically set Hebrew
  useEffect(() => {
    const checkUserLocation = async () => {
      try {
        // Don't auto-detect if user has already set a language preference
        if (localStorage.getItem('i18nextLng') !== null) return;
        
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        
        if (data.country === 'IL') {
          changeLanguage('he');
        }
      } catch (error) {
        console.error('Failed to detect user location:', error);
      }
    };
    
    checkUserLocation();
  }, []);

  // Update RTL state when language changes
  useEffect(() => {
    const isHebrewLanguage = language === 'he';
    setIsRTL(isHebrewLanguage);
    
    // Apply RTL attribute to HTML document
    if (isHebrewLanguage) {
      document.documentElement.setAttribute('dir', 'rtl');
      document.documentElement.setAttribute('lang', 'he');
      document.body.classList.add('rtl-layout');
      
      // Force a layout recalculation by triggering a reflow
      document.body.offsetHeight;
      
      // Add RTL class to all modal containers and other high-level containers
      document.querySelectorAll('.modal-container, .profile-content, .app-wrapper, .dashboard-container, .messages-container').forEach(el => {
        if (el) el.classList.add('rtl-layout');
      });
    } else {
      document.documentElement.setAttribute('dir', 'ltr');
      document.documentElement.setAttribute('lang', 'en');
      document.body.classList.remove('rtl-layout');
      
      // Force a layout recalculation by triggering a reflow
      document.body.offsetHeight;
      
      // Remove RTL class from all containers
      document.querySelectorAll('.modal-container, .profile-content, .app-wrapper, .dashboard-container, .messages-container').forEach(el => {
        if (el) el.classList.remove('rtl-layout');
      });
    }
    
    // Add a data attribute to help with CSS targeting
    document.documentElement.setAttribute('data-language', language);
    
    // Create a custom event to notify components about the language/direction change
    const event = new CustomEvent('languageDirectionChanged', { 
      detail: { language, isRTL: isHebrewLanguage } 
    });
    window.dispatchEvent(event);
  }, [language]);

  // Handle language change
  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setLanguage(lng);
    localStorage.setItem('i18nextLng', lng);
  };

  // Get language display name
  const getLanguageDisplayName = (code) => {
    const languages = {
      'en': t('settings.english'),
      'he': t('settings.hebrew')
    };
    return languages[code] || code;
  };

  // Check if current language is RTL
  const isRTLLanguage = () => {
    return isRTL;
  };

  // Get text direction based on current language
  const getTextDirection = () => {
    return isRTL ? 'rtl' : 'ltr';
  };

  // Get CSS class based on language direction
  const getDirectionClass = () => {
    return isRTL ? 'rtl-text' : 'ltr-text';
  };

  // Context value
  const contextValue = {
    language,
    changeLanguage,
    isRTL: isRTLLanguage(),
    getTextDirection,
    getDirectionClass,
    getLanguageDisplayName,
    supportedLanguages: ['en', 'he']
  };

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageProvider;