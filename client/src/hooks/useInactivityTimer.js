import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { logger } from '../utils/logger';

const log = logger.create('InactivityTimer');

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds

export function useInactivityTimer() {
  const { logout, isAuthenticated } = useAuth();
  const timeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  
  // Function to reset the inactivity timer
  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    // Clear existing timer
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set new timer
    if (isAuthenticated) {
      timeoutRef.current = setTimeout(() => {
        log.info('Auto-logout due to inactivity');
        logout();
      }, INACTIVITY_TIMEOUT);
    }
  }, [isAuthenticated, logout]);
  
  // Function to check if the user has been inactive
  const checkInactivity = useCallback(() => {
    const now = Date.now();
    const lastActivity = lastActivityRef.current;
    const timeSinceLastActivity = now - lastActivity;
    
    if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
      log.info('Auto-logout due to inactivity');
      logout();
    }
  }, [logout]);
  
  // Set up activity listeners
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Events that indicate user activity
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keypress',
      'keydown',
      'scroll',
      'touchstart',
      'touchmove',
      'click',
      'focus',
      'wheel',
      'DOMMouseScroll',
      'MSPointerDown',
      'MSPointerMove'
    ];
    
    // Handle activity
    const handleActivity = () => {
      resetTimer();
    };
    
    // Handle page visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, store the current time
        sessionStorage.setItem('tabHiddenTime', Date.now().toString());
      } else {
        // Page is visible again, check how long it was hidden
        const hiddenTime = sessionStorage.getItem('tabHiddenTime');
        if (hiddenTime) {
          const timeSinceHidden = Date.now() - parseInt(hiddenTime);
          if (timeSinceHidden >= INACTIVITY_TIMEOUT) {
            log.info('Auto-logout due to tab being hidden for too long');
            logout();
          } else {
            // Resume normal activity tracking
            resetTimer();
          }
          sessionStorage.removeItem('tabHiddenTime');
        }
      }
    };
    
    // Handle tab close/navigation
    const handleBeforeUnload = (e) => {
      // Store the current timestamp when leaving
      sessionStorage.setItem('lastActivity', Date.now().toString());
    };
    
    // Check last activity on page load
    const checkLastActivity = () => {
      const lastActivity = sessionStorage.getItem('lastActivity');
      if (lastActivity) {
        const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
        if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
          log.info('Auto-logout due to inactivity (session restore)');
          logout();
        } else {
          // Reset timer with remaining time
          const remainingTime = INACTIVITY_TIMEOUT - timeSinceLastActivity;
          timeoutRef.current = setTimeout(() => {
            log.info('Auto-logout due to inactivity');
            logout();
          }, remainingTime);
        }
        sessionStorage.removeItem('lastActivity');
      }
    };
    
    // Initial check
    checkLastActivity();
    
    // Start the timer
    resetTimer();
    
    // Add event listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Clean up
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isAuthenticated, resetTimer, checkInactivity, logout]);
  
  // Return the time remaining until auto-logout (useful for UI display)
  const getTimeRemaining = useCallback(() => {
    const now = Date.now();
    const lastActivity = lastActivityRef.current;
    const timeSinceLastActivity = now - lastActivity;
    const timeRemaining = INACTIVITY_TIMEOUT - timeSinceLastActivity;
    
    return Math.max(0, timeRemaining);
  }, []);
  
  return {
    resetTimer,
    getTimeRemaining,
    INACTIVITY_TIMEOUT
  };
}