import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Create the language context
const LanguageContext = createContext();

// Language provider component
export function LanguageProvider({ children }) {
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'en');
  const [isRTL, setIsRTL] = useState(language === 'he');

  // Change the language
  const changeLanguage = (lang) => {
    i18n.changeLanguage(lang);
    setLanguage(lang);
    setIsRTL(lang === 'he');
    localStorage.setItem('language', lang);
    
    // Set document direction
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    
    // Dispatch event for other components to respond to direction change
    window.dispatchEvent(
      new CustomEvent('languageDirectionChanged', { 
        detail: { isRTL: lang === 'he', language: lang } 
      })
    );
  };

  // Initialize language on component mount
  useEffect(() => {
    // Set initial language from localStorage or browser preference
    const savedLanguage = localStorage.getItem('language');
    const browserLanguage = navigator.language.split('-')[0];
    const initialLanguage = savedLanguage || (browserLanguage === 'he' ? 'he' : 'en');
    
    changeLanguage(initialLanguage);
  }, []);

  // Context value
  const value = {
    language,
    isRTL,
    changeLanguage,
    t: i18n.t,
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