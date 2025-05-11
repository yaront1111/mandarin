import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useIsMobile, useMobileDetect } from '../../hooks';
// Direct translation without helper functions

/**
 * Reusable form field component for consistent form layouts
 * Enhanced with mobile-specific optimizations
 */
const FormField = ({
  id,
  label,
  error,
  children,
  required = false,
  helpText,
  className = '',
  labelClassName = '',
  wrapperClassName = '',
  hideLabel = false,
  labelPosition = 'top'
}) => {
  // Mobile detection
  const isMobile = useIsMobile();
  const { isTouch } = useMobileDetect();
  const { t } = useTranslation();

  // Memoized translations using direct t() calls with fallbacks
  const translations = useMemo(() => ({
    required: t('required') || 'Required'
  }), [t]);

  const fieldId = id || `field-${Math.random().toString(36).substring(2, 9)}`;
  const hasError = !!error;

  // Field layout classes
  const layoutClasses = {
    top: 'form-field--label-top',
    left: 'form-field--label-left',
    right: 'form-field--label-right',
    hidden: 'form-field--label-hidden'
  };

  // On mobile, prefer top layout for better usability
  const effectiveLabelPosition = isMobile ? 'top' : labelPosition;

  const layoutClass = hideLabel
    ? layoutClasses.hidden
    : layoutClasses[effectiveLabelPosition] || layoutClasses.top;

  return (
    <div className={`form-field ${layoutClass} ${hasError ? 'has-error' : ''} ${isMobile ? 'mobile-field' : ''} ${isTouch ? 'touch-optimized' : ''} ${className}`}>
      {!hideLabel && label && (
        <label
          htmlFor={fieldId}
          className={`form-field__label ${labelClassName}`}
        >
          {label}
          {required && <span
            className="form-field__required"
            title={translations.required}
          >*</span>}
        </label>
      )}

      <div className={`form-field__wrapper ${wrapperClassName}`}>
        {React.cloneElement(children, {
          id: fieldId,
          'aria-invalid': hasError,
          'aria-required': required,
          'aria-describedby': hasError ? `${fieldId}-error` : (helpText ? `${fieldId}-help` : undefined)
        })}

        {helpText && !hasError && (
          <div
            id={`${fieldId}-help`}
            className="form-field__help"
          >
            {helpText}
          </div>
        )}

        {hasError && (
          <div
            id={`${fieldId}-error`}
            className="form-field__error"
            role="alert"
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

FormField.propTypes = {
  id: PropTypes.string,
  label: PropTypes.node,
  error: PropTypes.node,
  children: PropTypes.node.isRequired,
  required: PropTypes.bool,
  helpText: PropTypes.node,
  className: PropTypes.string,
  labelClassName: PropTypes.string,
  wrapperClassName: PropTypes.string,
  hideLabel: PropTypes.bool,
  labelPosition: PropTypes.oneOf(['top', 'left', 'right'])
};

export default FormField;