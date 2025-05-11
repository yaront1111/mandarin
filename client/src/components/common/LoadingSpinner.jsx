import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
// Direct translation without helper functions

/**
 * Reusable loading spinner component
 */
const LoadingSpinner = ({
  size = 'medium',
  color = 'primary',
  centered = false,
  fullPage = false,
  text = '',
  className = '',
  overlay = false
}) => {
  const { t } = useTranslation();

  // Memoized translations using direct t() calls with fallbacks
  const translations = useMemo(() => ({
    loading: t('loading') || 'Loading...'
  }), [t]);

  const spinnerSizeClass = size === 'small'
    ? 'spinner-sm'
    : size === 'large'
      ? 'spinner-lg'
      : '';

  const spinnerColorClass = `spinner-${color}`;

  const containerClasses = `spinner-container
    ${centered ? 'centered' : ''}
    ${fullPage ? 'full-page' : ''}
    ${overlay ? 'with-overlay' : ''}
    ${className}`;

  // Use provided text or default loading translation
  const displayText = text || translations.loading;

  return (
    <div className={containerClasses} role="status" aria-live="polite">
      {overlay && <div className="spinner-overlay"></div>}
      <div className={`spinner ${spinnerSizeClass} ${spinnerColorClass}`} aria-hidden="true">
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
      </div>
      {displayText && <p className="spinner-text">{displayText}</p>}
      <span className="sr-only">{translations.loading}</span>
    </div>
  );
};

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  color: PropTypes.oneOf(['primary', 'secondary', 'light', 'dark']),
  centered: PropTypes.bool,
  fullPage: PropTypes.bool,
  text: PropTypes.string,
  className: PropTypes.string,
  overlay: PropTypes.bool
};

export default LoadingSpinner;