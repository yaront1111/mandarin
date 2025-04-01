import React from 'react';
import ErrorBoundary from '../ErrorBoundary';
import ErrorMessage from './ErrorMessage';
import logger from '../../utils/logger';

/**
 * Default fallback component for error boundaries
 */
const DefaultErrorFallback = ({ error, resetErrorBoundary }) => (
  <div className="error-boundary-fallback">
    <ErrorMessage 
      title="Something went wrong" 
      message={error?.message || 'An unexpected error occurred'} 
    />
    {resetErrorBoundary && (
      <button onClick={resetErrorBoundary} className="btn btn-primary mt-3">
        Try Again
      </button>
    )}
  </div>
);

/**
 * Higher-order component for wrapping components with error boundary
 * @param {React.Component} Component - Component to wrap
 * @param {Object} options - Error boundary options
 * @returns {React.Component} - Wrapped component
 */
export const withErrorBoundary = (Component, options = {}) => {
  const {
    FallbackComponent = DefaultErrorFallback,
    onError,
    resetKeys = [],
    onReset,
    ...errorBoundaryProps
  } = options;
  
  // Default error handler logs errors
  const defaultErrorHandler = (error, info) => {
    logger.error('Error caught by boundary:', error);
    logger.error('Component stack:', info?.componentStack);
    
    if (onError) {
      onError(error, info);
    }
  };

  // Create wrapper component with display name
  const WithErrorBoundary = (props) => (
    <ErrorBoundary
      FallbackComponent={FallbackComponent}
      onError={defaultErrorHandler}
      resetKeys={resetKeys}
      onReset={onReset}
      {...errorBoundaryProps}
    >
      <Component {...props} />
    </ErrorBoundary>
  );

  // Set display name for debugging
  const componentName = Component.displayName || Component.name || 'Component';
  WithErrorBoundary.displayName = `withErrorBoundary(${componentName})`;
  
  return WithErrorBoundary;
};

export default withErrorBoundary;