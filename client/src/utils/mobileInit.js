/**
 * Mobile initialization utilities
 * This module handles viewport adjustments and device detection
 * to improve mobile experience across the application
 */

/**
 * Sets the correct viewport height CSS variable
 * - Fixes the 100vh issue on mobile browsers
 * - Handles address bar hiding/showing
 */
export const setViewportHeight = () => {
  // Only run in browser environment
  if (typeof window === 'undefined') return;
  
  // Set the value of --vh custom property to the actual viewport height
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
};

/**
 * Detects device type and sets appropriate classes on HTML and body elements
 * - Adds mobile-device class to body when on mobile
 * - Adds ios-device class when on iOS
 * - Adds android-device class when on Android
 * - Adds touch-device class when on any touch device
 * - Adds pwa-mode class when running as installed PWA
 */
export const detectDevice = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  // Mobile detection - using both UA and screen size
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) || 
                   window.innerWidth < 768;
  
  // Touch device detection
  const isTouch = 'ontouchstart' in window || 
                  navigator.maxTouchPoints > 0 || 
                  navigator.msMaxTouchPoints > 0;
  
  // iOS detection
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
  
  // Android detection
  const isAndroid = /android/i.test(userAgent);
  
  // PWA detection
  const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                window.navigator.standalone || 
                document.referrer.includes('android-app://');
  
  // Apply classes to HTML and body elements
  const htmlElement = document.documentElement;
  const bodyElement = document.body;
  
  if (isMobile) {
    htmlElement.classList.add('mobile-view');
    bodyElement.classList.add('mobile-device');
  } else {
    htmlElement.classList.add('desktop-view');
    bodyElement.classList.add('desktop-device');
  }
  
  if (isTouch) bodyElement.classList.add('touch-device');
  if (isIOS) bodyElement.classList.add('ios-device');
  if (isAndroid) bodyElement.classList.add('android-device');
  if (isPWA) bodyElement.classList.add('pwa-mode');
  
  // Add orientation class
  if (window.matchMedia('(orientation: landscape)').matches) {
    bodyElement.classList.add('landscape');
  } else {
    bodyElement.classList.add('portrait');
  }
};

/**
 * Enable disabled user-scalable=no behavior while maintaining pinch zoom capability
 * This is a workaround for the fact that user-scalable=no is not allowed in some browsers
 */
export const enablePinchZoom = () => {
  if (typeof document === 'undefined') return;

  // Add a viewport meta tag that allows pinch zoom but prevents auto-zoom on inputs
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (!viewportMeta) {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=5, minimum-scale=1';
    document.head.appendChild(meta);
  } else {
    viewportMeta.content = 'width=device-width, initial-scale=1, maximum-scale=5, minimum-scale=1';
  }
  
  // Prevent auto zooming in forms for iOS
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    @supports (-webkit-touch-callout: none) {
      input, textarea, select {
        font-size: 16px !important;
      }
    }
  `;
  document.head.appendChild(styleElement);
};

/**
 * Update orientation class on body when device orientation changes
 */
export const handleOrientationChange = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  
  const handleChange = () => {
    const bodyElement = document.body;
    
    if (window.matchMedia('(orientation: landscape)').matches) {
      bodyElement.classList.remove('portrait');
      bodyElement.classList.add('landscape');
    } else {
      bodyElement.classList.remove('landscape');
      bodyElement.classList.add('portrait');
    }
    
    // Also update the viewport height
    setViewportHeight();
  };
  
  window.addEventListener('orientationchange', handleChange);
  window.addEventListener('resize', handleChange);
};

/**
 * Initialize all mobile optimizations
 * Call this function as early as possible in your app initialization
 */
export const initializeMobileOptimizations = () => {
  setViewportHeight();
  detectDevice();
  enablePinchZoom();
  handleOrientationChange();
};

export default {
  initializeMobileOptimizations,
  setViewportHeight,
  detectDevice,
  enablePinchZoom,
  handleOrientationChange
};