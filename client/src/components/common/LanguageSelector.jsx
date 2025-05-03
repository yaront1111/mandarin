import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import './language.css';
import logger from "../../utils/logger";

const log = logger.create("LanguageSelector");

// For debugging translation issues
const DEBUG_TRANSLATIONS = false; // Set to true to enable debug logs

/**
 * Combined Language component that includes both the language selector toggle button
 * and the expanded language section for the settings page
 * 
 * @param {Object} props Component props
 * @param {string} [props.className] Additional CSS classes
 * @param {string} [props.display='toggle'] Display mode - 'toggle', 'section', or 'both'
 */
const LanguageSelector = ({ className = '', display = 'toggle' }) => {
  const { language, changeLanguage } = useLanguage();
  const { t } = useTranslation();

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'he' : 'en';
    
    if (DEBUG_TRANSLATIONS) {
      log.info('LanguageSelector: Current language =', language);
      log.info('LanguageSelector: Switching to language =', newLang);
      log.info('LanguageSelector: i18n.languages =', i18n.languages);
      log.info('LanguageSelector: i18n.language =', i18n.language);
      log.info('LanguageSelector: Test translation =', t('common.login', 'Fallback login text'));
    }
    
    changeLanguage(newLang);
  };

  const renderToggle = () => (
    <div className={`language-selector ${className}`}>
      <button 
        onClick={toggleLanguage} 
        className="language-toggle-btn"
        aria-label={language === 'en' ? 'Switch to Hebrew' : 'Switch to English'}
      >
        {language === 'en' ? 'עברית' : 'English'}
      </button>
    </div>
  );

  const renderSection = () => (
    <div className="settings-section language-settings-section">
      <h3 className="settings-heading">{t('settings.language')}</h3>
      <div className="settings-content language-settings">
        <div className="language-options">
          <div 
            className={`language-option ${language === 'en' ? 'active' : ''}`}
            onClick={() => changeLanguage('en')}
          >
            <div className="language-flag">🇺🇸</div>
            <div className="language-info">
              <div className="language-name">{t('settings.languages.english')}</div>
              <div className="language-native">English</div>
            </div>
            {language === 'en' && <div className="language-active-indicator">✓</div>}
          </div>
          
          <div 
            className={`language-option ${language === 'he' ? 'active' : ''}`}
            onClick={() => changeLanguage('he')}
          >
            <div className="language-flag">🇮🇱</div>
            <div className="language-info">
              <div className="language-name">{t('settings.languages.hebrew')}</div>
              <div className="language-native">עברית</div>
            </div>
            {language === 'he' && <div className="language-active-indicator">✓</div>}
          </div>
        </div>
        
        <div className="language-notice">
          {t('settings.currentlyUsing')}
        </div>
      </div>
    </div>
  );

  // Render the appropriate component based on the display prop
  return (
    <>
      {(display === 'toggle' || display === 'both') && renderToggle()}
      {(display === 'section' || display === 'both') && renderSection()}
    </>
  );
};

export default LanguageSelector;