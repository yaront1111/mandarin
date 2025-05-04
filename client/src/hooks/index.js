/**
 * Re-export all custom hooks for easy importing
 */

export { useApi } from './useApi';
export { useSocketConnection } from './useSocketConnection';
export { default as useChat } from './useChat';
export { default as useMediaQuery, useIsMobile, useIsTablet, useIsDesktop, useIsLargeDesktop } from './useMediaQuery';
export { default as useMobileDetect } from './useMobileDetect';
export { default as useModal } from './useModal';
export { default as useFormState } from './useFormState';
export { default as useMessagesState } from './useMessagesState';
// Removed usePhotoGallery export - now using centralized usePhotoManagement instead
export { default as usePhotoManagement } from './usePhotoManagement';
export { default as useProfileModal } from './useProfileModal';
export { default as useDashboard } from './useDashboard';
export { default as useBlockedUsers } from './useBlockedUsers';

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