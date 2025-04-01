/**
 * Re-export all custom hooks for easy importing
 */

export { useApi } from './useApi';
export { useSocketConnection } from './useSocketConnection';
export { useSettings } from './useSettings';
export { useChatMessages } from './useChatMessages';
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
 * Hook to manage debounced values
 * @param {any} value - Value to debounce
 * @param {number} delay - Debounce delay in milliseconds
 * @returns {any} Debounced value
 */
export const useDebounce = (value, delay = 500) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
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

/**
 * Hook to manage local storage values with auto-parsing
 * @param {string} key - Storage key
 * @param {any} initialValue - Default value
 * @returns {Array} [storedValue, setValue] state pair
 */
export const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      logger.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });
  
  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      logger.error(`Error setting localStorage key "${key}":`, error);
    }
  };
  
  return [storedValue, setValue];
};

/**
 * Hook to track previous value of a prop or state
 * @param {any} value - Value to track
 * @returns {any} Previous value
 */
export const usePrevious = (value) => {
  const ref = useRef();
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref.current;
};