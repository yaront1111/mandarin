import React, { useState, useEffect } from 'react';
import { useInactivityTimer } from '../hooks/useInactivityTimer';
import './InactivityCountdown.css';

export function InactivityCountdown() {
  const { getTimeRemaining, INACTIVITY_TIMEOUT } = useInactivityTimer();
  const [timeRemaining, setTimeRemaining] = useState(INACTIVITY_TIMEOUT);
  const [showWarning, setShowWarning] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getTimeRemaining();
      setTimeRemaining(remaining);
      
      // Show warning when less than 2 minutes remain
      setShowWarning(remaining < 2 * 60 * 1000);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [getTimeRemaining]);
  
  // Don't show anything if there's plenty of time
  if (timeRemaining > 5 * 60 * 1000) return null;
  
  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);
  
  return (
    <div className={`inactivity-countdown ${showWarning ? 'warning' : ''}`}>
      <span className="countdown-text">
        {showWarning ? '⚠️ ' : ''}
        Session expires in: {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
}