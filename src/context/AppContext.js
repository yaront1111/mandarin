// src/context/AppContext.js
import React, {
  createContext, useState, useMemo, useCallback
} from 'react';
import PropTypes from 'prop-types';

/**
 * AppContext:
 * - Manages global states (e.g. stealthMode, theme)
 * - Could also handle app-wide logic (e.g., error toasts, global modals)
 */

export const AppContext = createContext();

export function AppProvider({ children }) {
  // Example: stealthMode for hiding profile
  const [stealthMode, setStealthMode] = useState(false);

  // Toggle stealth mode
  const toggleStealthMode = useCallback(() => {
    setStealthMode((prev) => !prev);
  }, []);

  // Memoize context value for performance
  const contextValue = useMemo(() => ({
    stealthMode,
    toggleStealthMode,
  }), [stealthMode, toggleStealthMode]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

AppProvider.propTypes = {
  /** The child components that should have access to AppContext */
  children: PropTypes.node.isRequired,
};
