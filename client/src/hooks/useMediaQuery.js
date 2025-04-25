/**
 * A React hook for handling responsive design with consistent media queries
 */

import { useState, useEffect } from 'react';

// Standard breakpoints - used for min-width queries
export const breakpoints = {
  sm: 576,  // Small devices (landscape phones)
  md: 768,  // Medium devices (tablets)
  lg: 992,  // Large devices (desktops)
  xl: 1200, // Extra large devices (large desktops)
  xxl: 1400 // Extra extra large devices
};

/**
 * Custom hook to check if a media query matches
 * @param {string} query - CSS media query string
 * @returns {boolean} Whether the media query matches
 */
const useMediaQuery = (query) => {
  // Safely check for window on initial render (SSR safety)
  const getMatches = (query) => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  };

  const [matches, setMatches] = useState(getMatches(query));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    // Create the media query list
    const mediaQuery = window.matchMedia(query);
    
    // Update the state initially
    setMatches(mediaQuery.matches);

    // Create handler function for changes
    const handler = (event) => setMatches(event.matches);
    
    // Add event listener using the appropriate method (for compatibility)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handler);
    }
    
    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handler);
      } else {
        // Fallback for older browsers
        mediaQuery.removeListener(handler);
      }
    };
  }, [query]);

  return matches;
};

/**
 * Convenience hooks for common breakpoints
 */
export const useIsMobile = () => useMediaQuery(`(max-width: ${breakpoints.md - 1}px)`);
export const useIsTablet = () => useMediaQuery(`(min-width: ${breakpoints.md}px) and (max-width: ${breakpoints.lg - 1}px)`);
export const useIsDesktop = () => useMediaQuery(`(min-width: ${breakpoints.lg}px)`);
export const useIsLargeDesktop = () => useMediaQuery(`(min-width: ${breakpoints.xl}px)`);

export default useMediaQuery;