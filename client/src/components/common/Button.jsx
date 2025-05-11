import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
// Direct translation without helper functions

/**
 * Reusable Button component with standardized styling
 */
const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'medium',
  className = '',
  disabled = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  isLoading = false,
  loadingText,
  ...rest
}) => {
  const { t } = useTranslation();

  // Memoized translations using direct t() calls with fallbacks
  const translations = useMemo(() => ({
    loading: t('loading') || 'Loading...'
  }), [t]);

  const baseClasses = `btn btn-${variant} btn-${size} ${fullWidth ? 'btn-full-width' : ''}`;
  const iconClasses = icon ? `btn-with-icon icon-${iconPosition}` : '';
  const loadingClasses = isLoading ? 'btn-loading' : '';

  // Use provided loadingText or the translation
  const loadingDisplay = loadingText || translations.loading;

  return (
    <button
      type={type}
      className={`${baseClasses} ${iconClasses} ${loadingClasses} ${className}`}
      onClick={onClick}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading ? (
        <>
          <span className="loading-spinner"></span>
          {loadingDisplay}
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="btn-icon">{icon}</span>}
          <span className="btn-text">{children}</span>
          {icon && iconPosition === 'right' && <span className="btn-icon">{icon}</span>}
        </>
      )}
    </button>
  );
};

Button.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  variant: PropTypes.oneOf(['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark', 'link']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  className: PropTypes.string,
  disabled: PropTypes.bool,
  fullWidth: PropTypes.bool,
  icon: PropTypes.node,
  iconPosition: PropTypes.oneOf(['left', 'right']),
  isLoading: PropTypes.bool,
  loadingText: PropTypes.string
};

export default Button;