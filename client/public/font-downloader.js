// Simplified Font Downloader Script (immediate fallback to Google Fonts)
(function() {
  // Log function that's less verbose
  function log(message, level = 'debug') {
    // Only log warnings and errors to console
    if (level === 'warn' || level === 'error') {
      console[level](message);
    }
  }

  // Immediately use Google Fonts and system fallbacks to ensure fonts always work
  function setupFonts() {
    // Add CSS variables for font stacks with robust fallbacks
    const variableStyle = document.createElement('style');
    variableStyle.textContent = `
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
      
      /* Critical fixes for mobile */
      html {
        -webkit-text-size-adjust: 100%;
        text-size-adjust: 100%;
        height: -webkit-fill-available; /* Fix iOS height */
      }
      
      /* Mobile fixes */
      @media (max-width: 768px) {
        input, textarea, select, button {
          font-size: 16px !important; /* Prevents iOS zoom */
        }
        
        body {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
      }
    `;
    document.head.appendChild(variableStyle);
    
    // Add system font fallbacks for all major fonts
    const fallbackStyle = document.createElement('style');
    fallbackStyle.textContent = `
      /* System font fallbacks for key fonts */
      @font-face {
        font-family: 'Poppins';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: local('Poppins'), 
             local('-apple-system'), 
             local('BlinkMacSystemFont'),
             local('Segoe UI'),
             local('Roboto'),
             local('Arial'),
             local('sans-serif');
      }
      
      @font-face {
        font-family: 'Inter';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: local('Inter'), 
             local('-apple-system'), 
             local('BlinkMacSystemFont'),
             local('Segoe UI'),
             local('Roboto'),
             local('Arial'),
             local('sans-serif');
      }
    `;
    document.head.appendChild(fallbackStyle);
    
    // Load Google Fonts asynchronously - minimized to only needed weights
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    // Add text parameter to only fetch actually used characters
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Poppins:wght@400;500;600&display=swap&text=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;';
    
    // Fallback if Google Fonts fails to load after 3 seconds
    const timeoutId = setTimeout(() => {
      log('Fonts still not loaded after timeout, using system fallbacks', 'warn');
      
      // Add additional system font fallbacks
      const emergencyStyle = document.createElement('style');
      emergencyStyle.textContent = `
        /* Emergency system font fallbacks */
        body, button, input, select, textarea, h1, h2, h3, h4, h5, h6 {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 
            Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif !important;
        }
      `;
      document.head.appendChild(emergencyStyle);
    }, 3000);
    
    // Clear timeout if fonts load successfully
    link.onload = () => {
      clearTimeout(timeoutId);
      log('Google Fonts loaded successfully');
    };
    
    link.onerror = () => {
      log('Google Fonts failed to load', 'error');
      // Timeout will handle fallback
    };
    
    document.head.appendChild(link);
  }

  // Run immediately
  setupFonts();
})();