import React, { Suspense } from 'react';
import LoadingSpinner from './LoadingSpinner';

/**
 * Default fallback component for suspense
 */
const DefaultLoadingFallback = () => (
  <div className="suspense-loading-fallback">
    <LoadingSpinner centered text="Loading..." />
  </div>
);

/**
 * Higher-order component for wrapping components with suspense
 * @param {React.Component} Component - Component to wrap
 * @param {React.Component} FallbackComponent - Loading fallback component
 * @returns {React.Component} - Wrapped component
 */
export const withSuspense = (Component, FallbackComponent = DefaultLoadingFallback) => {
  // Create wrapper component with display name
  const WithSuspense = (props) => (
    <Suspense fallback={<FallbackComponent />}>
      <Component {...props} />
    </Suspense>
  );

  // Set display name for debugging
  const componentName = Component.displayName || Component.name || 'Component';
  WithSuspense.displayName = `withSuspense(${componentName})`;
  
  return WithSuspense;
};

export default withSuspense;