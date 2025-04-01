/**
 * Re-export all common components for easy importing
 */

// UI Components
export { default as Avatar } from './Avatar';
export { default as Button } from './Button';
export { default as Card } from './Card';
export { default as ErrorMessage } from './ErrorMessage';
export { default as FormField } from './FormField';
export { default as LoadingSpinner } from './LoadingSpinner';
export { default as LoadingState } from './LoadingState';
export { default as Modal } from './Modal';

// Higher-Order Components
export { default as withErrorBoundary, withErrorBoundary as WithErrorBoundary } from './withErrorBoundary';
export { default as withSuspense, withSuspense as WithSuspense } from './withSuspense';
export { default as withMemo, withMemo as WithMemo } from './withMemo';

/**
 * Compose multiple higher-order components
 * @param {...Function} hocs - HOCs to compose
 * @returns {Function} - Composed HOC
 */
export const compose = (...hocs) => {
  return (BaseComponent) => 
    hocs.reduceRight(
      (AccumulatedComponent, hoc) => hoc(AccumulatedComponent), 
      BaseComponent
    );
};

/**
 * Higher-order component for both error boundary and suspense
 * @param {React.Component} Component - Component to wrap
 * @param {Object} options - Options for error boundary and suspense
 * @returns {React.Component} - Wrapped component
 */
export const withErrorHandling = (Component, options = {}) => {
  const { 
    errorBoundaryOptions = {}, 
    SuspenseFallback = undefined 
  } = options;
  
  return compose(
    (C) => withErrorBoundary(C, errorBoundaryOptions),
    (C) => withSuspense(C, SuspenseFallback)
  )(Component);
};