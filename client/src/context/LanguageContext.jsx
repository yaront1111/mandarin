import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import logger from '../utils/logger';

// Create a named logger
const log = logger.create('LanguageContext');

// Create the language context
const LanguageContext = createContext();

// Language provider component
export function LanguageProvider({ children }) {
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'en');
  const [isRTL, setIsRTL] = useState(language === 'he');

  // Change the language
  const changeLanguage = (lang) => {
    try {
      log.info('Changing language to:', lang);
      
      // Update i18next instance
      i18n.changeLanguage(lang);
      
      // Update state
      setLanguage(lang);
      setIsRTL(lang === 'he');
      
      // Persist language preference
      localStorage.setItem('language', lang);
      
      // Set document direction and lang attributes
      document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
      
      // Force application to recognize RTL/LTR change
      document.body.classList.remove('rtl', 'ltr');
      document.body.classList.add(lang === 'he' ? 'rtl' : 'ltr');
      
      // Dispatch event for other components to respond to direction change
      window.dispatchEvent(
        new CustomEvent('languageDirectionChanged', { 
          detail: { isRTL: lang === 'he', language: lang } 
        })
      );
      
      log.info('Language changed successfully to:', lang, 'RTL:', lang === 'he');
    } catch (error) {
      log.error('Error changing language:', error);
    }
  };

  // Initialize language on component mount
  useEffect(() => {
    // Set initial language from localStorage or browser preference
    const savedLanguage = localStorage.getItem('language');
    const browserLanguage = navigator.language.split('-')[0];
    const initialLanguage = savedLanguage || (browserLanguage === 'he' ? 'he' : 'en');
    
    changeLanguage(initialLanguage);
  }, []);

  // Helper function to get supported languages
  const getSupportedLanguages = () => {
    return i18n.options?.supportedLngs?.filter(lang => lang !== 'cimode') || ['en', 'he'];
  };

  // Get language display name
  const getLanguageDisplayName = (code) => {
    if (code === 'en') return 'English';
    if (code === 'he') return 'עברית';
    return code;
  };

  // Context value with expanded API
  const value = {
    language,
    isRTL,
    changeLanguage,
    t: i18n.t,
    supportedLanguages: getSupportedLanguages(),
    getLanguageDisplayName
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

// Custom hook for using the language context
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}