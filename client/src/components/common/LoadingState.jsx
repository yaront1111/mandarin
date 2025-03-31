import React from 'react';
import PropTypes from 'prop-types';
import LoadingSpinner from './LoadingSpinner';

/**
 * Component to display loading states with additional context
 */
const LoadingState = ({
  isLoading = true,
  error = null,
  children = null,
  loadingText = 'Loading...',
  errorText = 'An error occurred',
  size = 'medium',
  spinnerProps = {},
  onRetry = null,
  showSpinnerWhenLoading = true,
  showChildrenAfterLoad = true,
  className = '',
  renderError = null
}) => {
  // Show error if there is one
  if (error) {
    if (renderError) {
      return renderError(error, onRetry);
    }
    
    return (
      <div className={`loading-state loading-state--error ${className}`}>
        <p className="loading-state__error">{errorText || error.message || error}</p>
        {onRetry && (
          <button 
            className="loading-state__retry-button" 
            onClick={onRetry}
          >
            Try Again
          </button>
        )}
      </div>
    );
  }
  
  // Show loading spinner when loading
  if (isLoading && showSpinnerWhenLoading) {
    return (
      <div className={`loading-state loading-state--loading ${className}`}>
        <LoadingSpinner 
          text={loadingText} 
          size={size}
          {...spinnerProps}
        />
      </div>
    );
  }
  
  // Show children when not loading or always if showChildrenAfterLoad is true
  if (!isLoading || showChildrenAfterLoad) {
    return children;
  }
  
  // Default case
  return null;
};

LoadingState.propTypes = {
  isLoading: PropTypes.bool,
  error: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.object
  ]),
  children: PropTypes.node,
  loadingText: PropTypes.string,
  errorText: PropTypes.string,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  spinnerProps: PropTypes.object,
  onRetry: PropTypes.func,
  showSpinnerWhenLoading: PropTypes.bool,
  showChildrenAfterLoad: PropTypes.bool,
  className: PropTypes.string,
  renderError: PropTypes.func
};

export default LoadingState;