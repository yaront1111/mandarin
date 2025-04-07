import { lazy } from 'react';
import { jsx as _jsx } from 'react/jsx-runtime';

// Helper function for lazy loading components
export const lazyLoad = (importFunc, loadingProp = {}) => {
  const LazyComponent = lazy(importFunc);
  
  return (props) => {
    return _jsx(LazyComponent, { ...loadingProp, ...props });
  };
};