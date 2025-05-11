import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useTranslation } from 'react-i18next';
// No need to re-import CSS as it's already imported in LanguageSelector
import './language.css';

/**
 * LanguageSection component for the settings page
 * Shows available languages with flags and names
 * 
 * @param {Object} props Component props
 * @param {string} [props.className] Additional CSS classes
 */
const LanguageSection = ({ className = '' }) => {
  const { language, changeLanguage } = useLanguage();
  const { t } = useTranslation();

  return (
    <div className={`language-settings-section ${className}`}>
      <h3 className="settings-heading">{t('language')}</h3>
      <div className="settings-content language-settings">
        <div className="language-options">
          <div 
            className={`language-option ${language === 'en' ? 'active' : ''}`}
            onClick={() => changeLanguage('en')}
          >
            <div className="language-flag">🇺🇸</div>
            <div className="language-info">
              <div className="language-name">{t('english', 'English')}</div>
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
              <div className="language-name">{t('hebrew', 'Hebrew')}</div>
              <div className="language-native">עברית</div>
            </div>
            {language === 'he' && <div className="language-active-indicator">✓</div>}
          </div>
        </div>
        
        <div className="language-notice">
          {t('currentlyUsing')}
        </div>
      </div>
    </div>
  );
};

export default LanguageSection;