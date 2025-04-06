import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../../context';

/**
 * LocaleHelper - Component to handle language/locale related SEO
 * Adds appropriate hreflang tags for internationalization
 */
const LocaleHelper = () => {
  const location = useLocation();
  const { language = 'en' } = useLanguage() || {};
  
  useEffect(() => {
    // Get current path without any query parameters
    const currentPath = location.pathname;
    const baseUrl = 'https://flirtss.com';
    
    // Define all supported languages
    const supportedLangs = ['en', 'he'];
    
    // Remove existing hreflang links
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => el.remove());
    
    // Add x-default hreflang
    let link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = 'x-default';
    link.href = `${baseUrl}${currentPath}`;
    document.head.appendChild(link);
    
    // Add language specific hreflang tags
    supportedLangs.forEach(lang => {
      let langLink = document.createElement('link');
      langLink.rel = 'alternate';
      langLink.hreflang = lang;
      
      // For Hebrew, you might have a specific path structure or subdomain
      // Adapt this logic based on your application's URL structure
      if (lang === 'he') {
        // Example: Add language as a parameter
        langLink.href = `${baseUrl}${currentPath}${location.search ? '&' : '?'}lang=he`;
      } else {
        langLink.href = `${baseUrl}${currentPath}`;
      }
      
      document.head.appendChild(langLink);
    });
    
    // Set html lang attribute
    document.documentElement.lang = language;
    
    // Set direction attribute for RTL languages
    if (language === 'he') {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
    }
    
    // Cleanup when component unmounts
    return () => {
      document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => el.remove());
    };
  }, [location.pathname, location.search, language]);
  
  // This component doesn't render anything visibly
  return null;
};

export default LocaleHelper;