// src/components/common/ErrorBoundary.jsx
import React from 'react';
import PropTypes from 'prop-types';

/**
 * A React Error Boundary to catch runtime errors
 * and prevent them from breaking the entire app.
 *
 * Usage:
 * <ErrorBoundary fallback={<MyFallbackUI />}>
 *   <MyComponent />
 * </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state to show fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Optionally log error details to a tracking service
    if (this.props.logErrors) {
      console.error('ErrorBoundary caught an error:', error, info);
      // e.g., send to Sentry or your own logging service
      // reportErrorService(error, info);
    }
  }

  render() {
    const { hasError, error } = this.state;
    const { fallback } = this.props;

    if (hasError) {
      // If a custom fallback is provided, render it
      // Otherwise show a default message
      return fallback || (
        <div className="p-4 text-center">
          <h2 className="text-xl font-bold mb-2">Oops, something went wrong.</h2>
          <p className="text-sm text-gray-400">Please try refreshing the page.</p>
          {process.env.NODE_ENV === 'development' && error && (
            <pre className="text-left mt-4 p-2 bg-gray-800 rounded">
              {error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  /** Components that might throw an error */
  children: PropTypes.node.isRequired,
  /** Fallback UI to display if an error is caught */
  fallback: PropTypes.node,
  /** If true, logs error info to console or service */
  logErrors: PropTypes.bool,
};

ErrorBoundary.defaultProps = {
  fallback: null,
  logErrors: false,
};

export default ErrorBoundary;
