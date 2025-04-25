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

  // Also set full viewport dimensions for reference
  document.documentElement.style.setProperty('--window-width', `${window.innerWidth}px`);
  document.documentElement.style.setProperty('--window-height', `${window.innerHeight}px`);
  document.documentElement.style.setProperty('--device-pixel-ratio', window.devicePixelRatio);

  // Log for debugging in development
  if (process.env.NODE_ENV !== 'production') {
    console.log('Setting viewport height:', vh * 100, 'px');
  }
};

/**
 * Detects device type and sets appropriate classes on HTML and body elements
 * - Adds mobile-device class to body when on mobile
 * - Adds ios-device class when on iOS
 * - Adds android-device class when on Android
 * - Adds touch-device class when on any touch device
 * - Adds pwa-mode class when running as installed PWA
 * - Now adds xiaomi-device and poco-device for better Xiaomi/Poco support
 */
export const detectDevice = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const userAgent = navigator.userAgent || navigator.vendor || window.opera;

  // Debug info in development
  if (process.env.NODE_ENV !== 'production') {
    console.log('User Agent:', userAgent);
    console.log('Screen size:', window.innerWidth, 'x', window.innerHeight);
    console.log('Device pixel ratio:', window.devicePixelRatio);
  }

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

  // Xiaomi/Poco specific detection
  const isXiaomi = /XiaoMi|MI|Redmi/i.test(userAgent);
  const isPoco = /POCO/i.test(userAgent);
  const isMIUI = /MIUI/i.test(userAgent);

  // Samsung detection
  const isSamsung = /Samsung/i.test(userAgent);

  // PWA detection
  const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                window.navigator.standalone ||
                document.referrer.includes('android-app://');

  // Apply classes to HTML and body elements
  const htmlElement = document.documentElement;
  const bodyElement = document.body;

  // First remove any existing classes to avoid duplicates
  const deviceClasses = [
    'mobile-view', 'desktop-view', 'mobile-device', 'desktop-device',
    'touch-device', 'ios-device', 'android-device', 'pwa-mode',
    'landscape', 'portrait', 'xiaomi-device', 'poco-device', 'miui-browser',
    'samsung-device'
  ];

  deviceClasses.forEach(cls => {
    htmlElement.classList.remove(cls);
    bodyElement.classList.remove(cls);
  });

  // Apply new classes
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

  // Add Xiaomi/Poco specific classes
  if (isXiaomi) bodyElement.classList.add('xiaomi-device');
  if (isPoco) bodyElement.classList.add('poco-device');
  if (isMIUI) bodyElement.classList.add('miui-browser');

  // Add Samsung specific class
  if (isSamsung) bodyElement.classList.add('samsung-device');

  // Add orientation class
  if (window.matchMedia('(orientation: landscape)').matches) {
    bodyElement.classList.add('landscape');
  } else {
    bodyElement.classList.add('portrait');
  }

  // Add debug element in development mode
  if (process.env.NODE_ENV !== 'production') {
    const existingDebug = document.getElementById('mobile-debug-overlay');
    if (!existingDebug) {
      const debugEl = document.createElement('div');
      debugEl.id = 'mobile-debug-overlay';
      debugEl.style.position = 'fixed';
      debugEl.style.bottom = '10px';
      debugEl.style.right = '10px';
      debugEl.style.background = 'rgba(0,0,0,0.7)';
      debugEl.style.color = 'white';
      debugEl.style.padding = '5px';
      debugEl.style.fontSize = '10px';
      debugEl.style.fontFamily = 'monospace';
      debugEl.style.zIndex = '9999';
      debugEl.style.borderRadius = '4px';
      debugEl.innerHTML = `
        <div>Mobile: ${isMobile ? '✓' : '✗'}</div>
        <div>Touch: ${isTouch ? '✓' : '✗'}</div>
        <div>iOS: ${isIOS ? '✓' : '✗'}</div>
        <div>Android: ${isAndroid ? '✓' : '✗'}</div>
        <div>Xiaomi: ${isXiaomi ? '✓' : '✗'}</div>
        <div>POCO: ${isPoco ? '✓' : '✗'}</div>
        <div>MIUI: ${isMIUI ? '✓' : '✗'}</div>
        <div>Samsung: ${isSamsung ? '✓' : '✗'}</div>
        <div>PWA: ${isPWA ? '✓' : '✗'}</div>
        <div>${window.innerWidth}×${window.innerHeight} (${window.devicePixelRatio}x)</div>
      `;
      document.body.appendChild(debugEl);

      // Close button for debug overlay
      const closeBtn = document.createElement('button');
      closeBtn.textContent = 'X';
      closeBtn.style.position = 'absolute';
      closeBtn.style.top = '2px';
      closeBtn.style.right = '2px';
      closeBtn.style.background = 'red';
      closeBtn.style.border = 'none';
      closeBtn.style.color = 'white';
      closeBtn.style.padding = '2px 4px';
      closeBtn.style.fontSize = '8px';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.borderRadius = '2px';
      closeBtn.onclick = () => debugEl.style.display = 'none';
      debugEl.appendChild(closeBtn);

      // Toggle with keyboard shortcut
      document.addEventListener('keydown', (e) => {
        if (e.key === 'D' && e.ctrlKey && e.altKey) {
          debugEl.style.display = debugEl.style.display === 'none' ? 'block' : 'none';
        }
      });
    }
  }
};

/**
 * Enable disabled user-scalable=no behavior while maintaining pinch zoom capability
 * This is a workaround for the fact that user-scalable=no is not allowed in some browsers
 * Enhanced to handle xiaomi/poco devices better
 */
export const enablePinchZoom = () => {
  if (typeof document === 'undefined') return;

  // Add a viewport meta tag that allows pinch zoom but prevents auto-zoom on inputs
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (!viewportMeta) {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=5, minimum-scale=1, viewport-fit=cover';
    document.head.appendChild(meta);
  } else {
    viewportMeta.content = 'width=device-width, initial-scale=1, maximum-scale=5, minimum-scale=1, viewport-fit=cover';
  }

  // Prevent auto zooming in forms for iOS and other devices
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    /* iOS specific form input sizing */
    @supports (-webkit-touch-callout: none) {
      input, textarea, select {
        font-size: 16px !important;
      }
    }
    
    /* General mobile fixes */
    .mobile-device input,
    .mobile-device textarea, 
    .mobile-device select {
      font-size: 16px !important;
    }
    
    /* Fix for vh units on mobile */
    .mobile-device .fullheight {
      height: 100vh; /* Fallback */
      height: calc(var(--vh, 1vh) * 100); /* Use the custom property */
    }
    
    /* Xiaomi/MIUI specific adjustments */
    .xiaomi-device input, 
    .xiaomi-device textarea, 
    .xiaomi-device select,
    .poco-device input,
    .poco-device textarea,
    .poco-device select {
      font-size: 16px !important;
      -webkit-appearance: none;
    }
    
    /* Fix for input focus issues on Xiaomi/Poco */
    .xiaomi-device input:focus,
    .poco-device input:focus {
      transform: translateY(0);
    }
    
    /* Samsung specific fixes */
    .samsung-device .fullheight {
      height: calc(var(--vh, 1vh) * 100); 
    }
  `;
  document.head.appendChild(styleElement);

  // Double-tap prevention for iOS
  document.addEventListener('touchend', function(event) {
    const now = Date.now();
    const DOUBLE_TAP_THRESHOLD = 300;
    if (this.lastTouchEnd && (now - this.lastTouchEnd) < DOUBLE_TAP_THRESHOLD) {
      event.preventDefault();
    }
    this.lastTouchEnd = now;
  }, false);
};

/**
 * Update orientation class on body when device orientation changes
 * Enhanced with more reliable orientation detection
 */
export const handleOrientationChange = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const handleChange = () => {
    const bodyElement = document.body;

    // Detect orientation in multiple ways for better reliability
    const isLandscape =
      window.matchMedia('(orientation: landscape)').matches ||
      window.innerWidth > window.innerHeight ||
      (window.orientation !== undefined && (window.orientation === 90 || window.orientation === -90));

    if (isLandscape) {
      bodyElement.classList.remove('portrait');
      bodyElement.classList.add('landscape');
    } else {
      bodyElement.classList.remove('landscape');
      bodyElement.classList.add('portrait');
    }

    // Update viewport variables
    setViewportHeight();

    if (process.env.NODE_ENV !== 'production') {
      console.log('Orientation changed:', isLandscape ? 'landscape' : 'portrait');
    }
  };

  // Listen to multiple events for better detection
  window.addEventListener('orientationchange', handleChange);
  window.addEventListener('resize', handleChange);

  // Initial orientation check
  handleChange();

  // Some devices (like Xiaomi/Poco) need a slight delay to detect orientation correctly
  setTimeout(handleChange, 300);
};

/**
 * Initialize all mobile optimizations
 * Call this function as early as possible in your app initialization
 */
export const initializeMobileOptimizations = () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Initializing mobile optimizations');
  }

  // Basic setup
  setViewportHeight();
  detectDevice();
  enablePinchZoom();
  handleOrientationChange();

  // Re-apply on DOM content loaded for better reliability
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setViewportHeight();
      detectDevice();
    });
  }

  // Re-apply after complete page load
  window.addEventListener('load', () => {
    setViewportHeight();
    detectDevice();
  });

  // Return deviceInfo for potential use
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  return {
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) ||
              window.innerWidth < 768,
    isIOS: /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream,
    isAndroid: /android/i.test(userAgent),
    isXiaomi: /XiaoMi|MI|Redmi/i.test(userAgent),
    isPoco: /POCO/i.test(userAgent),
    isSamsung: /Samsung/i.test(userAgent),
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: window.devicePixelRatio,
orientation: window.matchMedia('(orientation: landscape)').matches ? 'landscape' : 'portrait'
  };
};

/**
 * Fix Xiaomi/Poco specific issues
 * This addresses common issues with Xiaomi and Poco devices
 */
export const fixXiaomiIssues = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const isXiaomi = /XiaoMi|MI|Redmi|POCO/i.test(userAgent);

  if (!isXiaomi) return;

  if (process.env.NODE_ENV !== 'production') {
    console.log('Applying Xiaomi/Poco specific fixes');
  }

  // Add specific styles for Xiaomi/Poco devices
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    /* Fix for Xiaomi specific scroll issues */
    html, body {
      overscroll-behavior: none;
    }
    
    /* Fix for sticky hover states on Xiaomi/Poco */
    * {
      -webkit-tap-highlight-color: transparent;
    }
    
    /* Fix for bottom navigation bar issues */
    .has-bottom-nav {
      padding-bottom: env(safe-area-inset-bottom, 20px);
    }
    
    /* Fix for input field focusing issues */
    input, textarea, select {
      -webkit-appearance: none;
      appearance: none;
    }
  `;
  document.head.appendChild(styleElement);

  // Fix for virtual keyboard issues
  const inputs = document.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
    input.addEventListener('focus', () => {
      // Small timeout to let the keyboard appear
      setTimeout(() => {
        setViewportHeight();
        // Scroll to input
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    });

    input.addEventListener('blur', () => {
      // Reset viewport when keyboard disappears
      setTimeout(setViewportHeight, 300);
    });
  });
};

// Enhanced default export with additional functions
export default {
  initializeMobileOptimizations,
  setViewportHeight,
  detectDevice,
  enablePinchZoom,
  handleOrientationChange,
  fixXiaomiIssues
};
