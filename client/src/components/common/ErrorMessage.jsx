import React from 'react';
import PropTypes from 'prop-types';
import { FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';

/**
 * Reusable error message component
 */
const ErrorMessage = ({
  message,
  title = 'Error',
  type = 'error',
  onDismiss,
  showIcon = true,
  className = '',
  style = {}
}) => {
  if (!message) return null;
  
  // Convert message to string if it's an error object
  const errorMessage = message instanceof Error ? message.message : message;
  
  const typeClasses = {
    error: 'error-message--error',
    warning: 'error-message--warning',
    info: 'error-message--info'
  };
  
  const icons = {
    error: <FaTimesCircle />,
    warning: <FaExclamationTriangle />,
    info: <FaExclamationTriangle />
  };
  
  return (
    <div 
      className={`error-message ${typeClasses[type] || ''} ${className}`}
      style={style}
    >
      <div className="error-message__content">
        {showIcon && (
          <div className="error-message__icon">
            {icons[type]}
          </div>
        )}
        
        <div className="error-message__text">
          {title && <h4 className="error-message__title">{title}</h4>}
          <p className="error-message__description">{errorMessage}</p>
        </div>
      </div>
      
      {onDismiss && (
        <button 
          className="error-message__close" 
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          &times;
        </button>
      )}
    </div>
  );
};

ErrorMessage.propTypes = {
  message: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.object, // For Error objects
  ]).isRequired,
  title: PropTypes.string,
  type: PropTypes.oneOf(['error', 'warning', 'info']),
  onDismiss: PropTypes.func,
  showIcon: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

export default ErrorMessage;