import React from 'react';
import PropTypes from 'prop-types';

/**
 * Reusable form field component for consistent form layouts
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
  const fieldId = id || `field-${Math.random().toString(36).substring(2, 9)}`;
  const hasError = !!error;
  
  // Field layout classes
  const layoutClasses = {
    top: 'form-field--label-top',
    left: 'form-field--label-left',
    right: 'form-field--label-right',
    hidden: 'form-field--label-hidden'
  };
  
  const layoutClass = hideLabel 
    ? layoutClasses.hidden 
    : layoutClasses[labelPosition] || layoutClasses.top;
  
  return (
    <div className={`form-field ${layoutClass} ${hasError ? 'has-error' : ''} ${className}`}>
      {!hideLabel && label && (
        <label 
          htmlFor={fieldId} 
          className={`form-field__label ${labelClassName}`}
        >
          {label}
          {required && <span className="form-field__required">*</span>}
        </label>
      )}
      
      <div className={`form-field__wrapper ${wrapperClassName}`}>
        {React.cloneElement(children, { 
          id: fieldId,
          'aria-invalid': hasError,
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