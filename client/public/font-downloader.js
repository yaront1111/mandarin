// Enhanced Font Downloader Script (optimized for mobile)
(function() {
  // Flag to track if we've added fallback fonts
  let fallbacksAdded = false;
  
  // List of font faces we expect to have
  const expectedFonts = [
    { family: 'Poppins', weight: '300', filename: 'poppins-v20-latin-300.woff2' },
    { family: 'Poppins', weight: '400', filename: 'poppins-v20-latin-regular.woff2' },
    { family: 'Poppins', weight: '500', filename: 'poppins-v20-latin-500.woff2' },
    { family: 'Poppins', weight: '600', filename: 'poppins-v20-latin-600.woff2' },
    { family: 'Poppins', weight: '700', filename: 'poppins-v20-latin-700.woff2' },
    { family: 'Inter', weight: '400', filename: 'inter-v12-latin-regular.woff2' },
    { family: 'Inter', weight: '500', filename: 'inter-v12-latin-500.woff2' },
    { family: 'Inter', weight: '600', filename: 'inter-v12-latin-600.woff2' }
  ];
  
  // Add CSS variables for font stacks to ensure proper fallback on all devices
  function addFontFallbackVariables() {
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --font-primary: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', 
          Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        --font-secondary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 
          Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        --font-display: swap;
      }
      
      body, button, input, select, textarea {
        font-family: var(--font-primary);
      }
      
      h1, h2, h3, h4, h5, h6 {
        font-family: var(--font-secondary);
      }
      
      /* Fix for inconsistent font rendering on mobile */
      html {
        -webkit-text-size-adjust: 100%;
        -moz-text-size-adjust: 100%;
        text-size-adjust: 100%;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Load Google Fonts as fallback - this version is optimized for mobile
  function loadGoogleFontsFallback() {
    if (fallbacksAdded) return; // Only add once
    
    console.log('Adding Google Fonts fallback for missing fonts');
    
    // Add font-display:swap to ensure text remains visible during font loading
    const style = document.createElement('style');
    style.textContent = `
      /* Font loading indicator */
      html.fonts-loading {
        /* Apply minimal styles during loading */
      }
      
      /* Set a max timeout to avoid FOUT (Flash of Unstyled Text) */
      html.fonts-failed {
        /* Apply system font styles if loading fails */
      }
    `;
    document.head.appendChild(style);
    
    // Mark that we're loading
    document.documentElement.classList.add('fonts-loading');
    
    // Create link for Google Fonts - use display=swap for faster rendering
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    // Added display=swap and text=active parameters for better mobile performance
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@300;400;500;600;700&display=swap&display=swap&text=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,;:!?()%/-+&';
    
    // Detect when fonts are loaded or fail
    link.onload = function() {
      document.documentElement.classList.remove('fonts-loading');
      document.documentElement.classList.add('fonts-loaded');
    };
    
    link.onerror = function() {
      // If Google Fonts fail, fall back to system fonts
      document.documentElement.classList.remove('fonts-loading');
      document.documentElement.classList.add('fonts-failed');
      createSystemFontFallbacks();
    };
    
    document.head.appendChild(link);
    
    // Mark that we've added fallbacks
    fallbacksAdded = true;
    
    // Set a timeout to avoid long waits on slow connections
    setTimeout(function() {
      if (document.documentElement.classList.contains('fonts-loading')) {
        // If still loading after timeout, mark as failed
        document.documentElement.classList.remove('fonts-loading');
        document.documentElement.classList.add('fonts-timeout');
        // Don't wait forever, use system fonts
        createSystemFontFallbacks();
      }
    }, 2000);
  }
  
  // Create system font fallbacks for all expected fonts
  function createSystemFontFallbacks() {
    if (document.documentElement.classList.contains('using-system-fonts')) return; // Only add once
    
    console.log('Adding system font fallbacks');
    
    const style = document.createElement('style');
    let cssText = '';
    
    // Add fallback for each expected font with mobile-optimized stack
    expectedFonts.forEach(font => {
      cssText += `
        @font-face {
          font-family: '${font.family}';
          font-style: normal;
          font-weight: ${font.weight};
          font-display: swap;
          src: local('${font.family}'), 
               local('Arial'), 
               local('Helvetica'), 
               local('-apple-system'), 
               local('BlinkMacSystemFont'),
               local('Segoe UI'),
               local('Roboto'),
               local('sans-serif');
        }
      `;
    });
    
    // Add specific fixes for mobile browsers
    cssText += `
      /* Fix for iOS font sizing issues */
      body {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      
      /* Fix for mobile inputs */
      input, textarea, select, button {
        font-size: 16px; /* Prevents iOS zoom on focus */
      }
    `;
    
    style.textContent = cssText;
    document.head.appendChild(style);
    
    // Add a class to indicate we're using system font fallbacks
    document.documentElement.classList.add('using-system-fonts');
  }
  
  // Check if a font file exists
  function checkFontExists(fontPath) {
    return new Promise((resolve) => {
      fetch(fontPath, { method: 'HEAD' })
        .then(response => {
          resolve(response.ok);
        })
        .catch(() => {
          resolve(false);
        });
    });
  }
  
  // Check if device is mobile
  function isMobileDevice() {
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (window.innerWidth <= 768)
    );
  }
  
  // Main function to check fonts and add fallbacks if needed
  async function checkFontsAndAddFallbacks() {
    try {
      // Always add font fallback variables to ensure consistent styling
      addFontFallbackVariables();
      
      // If mobile, prioritize loading speed with Google Fonts
      if (isMobileDevice()) {
        console.log('Mobile device detected, optimizing font loading');
        loadGoogleFontsFallback();
        return;
      }
      
      // Check if we can access the fonts directory
      const canAccessFontsDir = await checkFontExists('/fonts');
      
      if (!canAccessFontsDir) {
        console.warn('Cannot access fonts directory, adding fallbacks');
        loadGoogleFontsFallback();
        return;
      }
      
      // Check each font file
      let missingFonts = false;
      
      for (const font of expectedFonts) {
        const exists = await checkFontExists(`/fonts/${font.filename}`);
        if (!exists) {
          console.warn(`Missing font: ${font.filename}`);
          missingFonts = true;
          break; // Stop checking once we find one missing font
        }
      }
      
      // If any fonts are missing, add fallbacks
      if (missingFonts) {
        loadGoogleFontsFallback();
      }
      
      // Quick font loading check with timeout
      setTimeout(() => {
        // If fonts haven't loaded after 2 seconds, add system fallbacks
        if (document.fonts && 
            (!document.fonts.check('1em Poppins') || !document.fonts.check('1em Inter'))) {
          console.warn('Fonts still not loaded after timeout, adding system fallbacks');
          createSystemFontFallbacks();
        }
      }, 2000);
      
    } catch (error) {
      console.error('Error checking fonts:', error);
      // If there's any error, add system font fallbacks
      createSystemFontFallbacks();
    }
  }
  
  // Run the font check immediately but non-blocking
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkFontsAndAddFallbacks);
  } else {
    // Use requestIdleCallback if available for better performance
    if (window.requestIdleCallback) {
      window.requestIdleCallback(checkFontsAndAddFallbacks);
    } else {
      setTimeout(checkFontsAndAddFallbacks, 100);
    }
  }
})();