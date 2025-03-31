import React, { memo } from 'react';
import { logger } from '../../utils';

/**
 * Higher-order component for memoizing components with debug support
 * @param {React.Component} Component - Component to memoize
 * @param {Function} propsAreEqual - Custom props comparison function
 * @param {Object} options - Additional options
 * @returns {React.Component} - Memoized component
 */
export const withMemo = (Component, propsAreEqual, options = {}) => {
  const { debug = false } = options;
  
  // If debug mode is enabled, wrap the equality function
  const equalityFn = debug 
    ? (prevProps, nextProps) => {
        const areEqual = propsAreEqual 
          ? propsAreEqual(prevProps, nextProps)
          : true; // Default to React.memo behavior
        
        if (!areEqual) {
          // Log the props that changed
          const changedProps = Object.keys(nextProps).filter(key => {
            return prevProps[key] !== nextProps[key];
          });
          
          const componentName = Component.displayName || Component.name || 'Component';
          logger.debug(
            `[withMemo] ${componentName} re-rendering due to props changes:`,
            changedProps
          );
        }
        
        return areEqual;
      }
    : propsAreEqual;
    
  // Memoize the component with optional custom comparison
  const MemoizedComponent = memo(Component, equalityFn);
  
  // Set display name for debugging
  const componentName = Component.displayName || Component.name || 'Component';
  MemoizedComponent.displayName = `withMemo(${componentName})`;
  
  return MemoizedComponent;
};

export default withMemo;