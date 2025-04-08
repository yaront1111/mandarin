// Enhanced Font Loader with Mobile Optimization and Performance Features
(function() {
  // Flag to track loading state
  var fontsLoaded = false;
  var fontLoadingTimeout = null;
  var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
  
  // Function to check if a font is available
  function checkFontAvailability(fontFamily) {
    if (!document.fonts || !document.fonts.check) {
      // Browser doesn't support font loading API
      return false;
    }
    
    try {
      return document.fonts.check('1em ' + fontFamily);
    } catch (e) {
      console.warn('Error checking font availability for ' + fontFamily, e);
      return false;
    }
  }
  
  // Function to optimize Google Fonts query for mobile
  function getOptimizedGoogleFontsUrl() {
    // Base URL with primary fonts
    var baseUrl = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@300;400;500;600;700&display=swap';
    
    // Add performance optimization parameters
    baseUrl += '&display=swap'; // Ensure swap behavior
    
    // For mobile, we can add text parameter with only essential characters to reduce payload
    if (isMobile) {
      // A subset of common characters for faster loading on mobile
      baseUrl += '&text=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,;:%/-+&';
    }
    
    return baseUrl;
  }
  
  // Function to add Google Fonts with optimized loading strategy
  function loadGoogleFonts() {
    console.log("Loading fonts with optimized strategy" + (isMobile ? " for mobile" : ""));
    
    // Create preconnect links for faster resource loading
    if (!document.querySelector('link[rel="preconnect"][href="https://fonts.googleapis.com"]')) {
      var preconnect1 = document.createElement('link');
      preconnect1.rel = 'preconnect';
      preconnect1.href = 'https://fonts.googleapis.com';
      document.head.appendChild(preconnect1);
      
      var preconnect2 = document.createElement('link');
      preconnect2.rel = 'preconnect';
      preconnect2.href = 'https://fonts.gstatic.com';
      preconnect2.crossOrigin = 'anonymous';
      document.head.appendChild(preconnect2);
    }
    
    // Create link element with non-blocking loading strategy
    var link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = getOptimizedGoogleFontsUrl();
    
    // Once preloaded, convert to stylesheet
    link.onload = function() {
      this.rel = 'stylesheet';
      checkFontsLoaded();
    };
    
    // Handle loading errors by falling back to system fonts
    link.onerror = function() {
      console.warn('Google Fonts failed to load');
      setupSystemFonts(true); // Force system fonts on error
      markFontsAsLoaded('system');
    };
    
    document.head.appendChild(link);
    
    // Safety timeout to avoid waiting too long
    fontLoadingTimeout = setTimeout(function() {
      if (!fontsLoaded) {
        console.warn('Font loading timed out, using system fonts');
        setupSystemFonts(true);
        markFontsAsLoaded('timeout');
      }
    }, isMobile ? 1500 : 3000); // Shorter timeout for mobile
  }
  
  // Function to set up system font fallbacks
  function setupSystemFonts(forceSystemFonts) {
    // Add font-display:swap to ensure text remains visible during font loading
    var style = document.createElement('style');
    
    // If we're forcing system fonts, prioritize them in the stack
    var primaryStack = forceSystemFonts ? 
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", "Poppins", sans-serif' :
      '"Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif';
      
    var secondaryStack = forceSystemFonts ?
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", "Inter", sans-serif' :
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif';
    
    style.textContent = `
      /* Font stacks with proper fallbacks */
      :root {
        --font-primary: ${primaryStack};
        --font-secondary: ${secondaryStack};
        --font-display: swap;
      }
      
      /* Core elements using font variables */
      body, button, input, select, textarea {
        font-family: var(--font-primary);
      }
      
      h1, h2, h3, h4, h5, h6 {
        font-family: var(--font-secondary);
      }
      
      /* Text rendering optimizations */
      html, body {
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      
      /* Mobile optimization */
      @media (max-width: 768px) {
        input, textarea, select, button {
          font-size: 16px; /* Prevents zooming on iOS */
        }
      }
      
      /* Flash of unstyled text prevention */
      .fonts-loading {
        /* Optional: slightly blur text during loading to mask FOUT */
        ${isMobile ? '' : 'opacity: 0.99;'}
      }
      
      .fonts-loaded {
        /* Full visibility once fonts are loaded */
        opacity: 1;
        transition: opacity 0.2s ease-out;
      }
    `;
    
    document.head.appendChild(style);
    
    // If we're explicitly using system fonts, mark loading as complete
    if (forceSystemFonts) {
      markFontsAsLoaded('system');
    }
  }
  
  // Function to check if fonts are loaded
  function checkFontsLoaded() {
    // Only check if we haven't already marked fonts as loaded
    if (fontsLoaded) return;
    
    // If the browser supports the font loading API
    if (document.fonts && document.fonts.check) {
      // Check both primary fonts
      var poppinsLoaded = checkFontAvailability('Poppins');
      var interLoaded = checkFontAvailability('Inter');
      
      if (poppinsLoaded && interLoaded) {
        markFontsAsLoaded('loaded');
      } else {
        // Check again in a bit
        setTimeout(checkFontsLoaded, 500);
      }
    } else {
      // If browser doesn't support checking, assume loaded after a delay
      setTimeout(function() {
        markFontsAsLoaded('assumed');
      }, isMobile ? 1000 : 2000);
    }
  }
  
  // Function to mark fonts as loaded and cancel timeout
  function markFontsAsLoaded(reason) {
    if (fontsLoaded) return; // Avoid marking twice
    
    // Clear the safety timeout if it's still running
    if (fontLoadingTimeout) {
      clearTimeout(fontLoadingTimeout);
      fontLoadingTimeout = null;
    }
    
    // Mark fonts as loaded
    fontsLoaded = true;
    document.documentElement.classList.remove('fonts-loading');
    document.documentElement.classList.add('fonts-loaded');
    
    // Add reason as data attribute for debugging
    document.documentElement.setAttribute('data-fonts-loaded-reason', reason);
    
    console.log("Fonts ready: " + reason);
    
    // Dispatch event for potential app-level listeners
    document.dispatchEvent(new CustomEvent('fontsLoaded', { detail: { reason: reason } }));
  }
  
  // Start by marking document as loading fonts
  document.documentElement.classList.add('fonts-loading');
  
  // Add system font fallbacks as a baseline
  setupSystemFonts(false);
  
  // Check if we need to prioritize speed for mobile
  if (isMobile) {
    // For mobile, we prioritize performance
    console.log("Mobile device detected, optimizing font loading");
    loadGoogleFonts(); // Use optimized parameters for mobile
  } else {
    // For desktop, we can afford to be a bit more aggressive
    loadGoogleFonts();
  }
  
  // Check font loading status after initial delay
  setTimeout(checkFontsLoaded, 500);
})();