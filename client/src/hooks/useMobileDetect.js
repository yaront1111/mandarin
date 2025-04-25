/**
 * Hook for comprehensive device and browser detection
 */

import { useState, useEffect } from 'react';
import { useIsMobile } from './useMediaQuery';

const useMobileDetect = () => {
  // State to hold device detection results
  const [device, setDevice] = useState({
    isMobile: false,
    isTouch: false,
    isIOS: false,
    isAndroid: false,
    isSafari: false,
    isPWA: false,
    isLandscape: false
  });

  // Get CSS-based mobile detection from our media query hook
  const isMobileScreen = useIsMobile();

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    
    // Check if touch device
    const isTouch = 'ontouchstart' in window || 
                    navigator.maxTouchPoints > 0 || 
                    navigator.msMaxTouchPoints > 0;
    
    // iOS detection
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    
    // Android detection
    const isAndroid = /android/i.test(userAgent);
    
    // Safari detection
    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
    
    // PWA detection - check if app is running in standalone mode
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  window.navigator.standalone || // for iOS
                  document.referrer.includes('android-app://');
    
    // Orientation detection
    const isLandscape = window.matchMedia('(orientation: landscape)').matches;
    
    // Update state with all our detection results
    setDevice({
      isMobile: isMobileScreen,
      isTouch,
      isIOS,
      isAndroid, 
      isSafari,
      isPWA,
      isLandscape
    });

    // Set up orientation change listener
    const handleOrientationChange = () => {
      setDevice(prev => ({
        ...prev,
        isLandscape: window.matchMedia('(orientation: landscape)').matches
      }));
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, [isMobileScreen]);

  return device;
};

export default useMobileDetect;