/**
 * Re-export all custom hooks for easy importing
 */

export { useApi } from './useApi';
export { useSocketConnection } from './useSocketConnection';
export { default as useChat } from './useChat';

// Simplified hook for checking if component is mounted (useful for async operations)
import { useRef, useEffect, useState } from 'react';
import { logger } from '../utils';

/**
 * Hook to check if component is still mounted
 * @returns {Object} Object with isMounted function
 */
export const useMounted = () => {
  const mountedRef = useRef(false);
  
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  return {
    isMounted: () => mountedRef.current
  };
};

/**
 * Hook to detect when user clicks outside of a specified element
 * @param {Function} callback - Function to call when click outside occurs
 * @returns {Object} Ref to attach to the element
 */
export const useClickOutside = (callback) => {
  const ref = useRef(null);
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        callback();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [callback]);
  
  return ref;
};

