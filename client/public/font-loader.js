// Ultra Simple Font Loader (System-first with Google Fonts fallback)
(function() {
  // Apply system fonts immediately to prevent FOUT (Flash of Unstyled Text)
  (function applySystemFonts() {
    var style = document.createElement('style');
    style.textContent = `
      /* System-first font stack */
      :root {
        --font-primary: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, 
          Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", "Poppins", sans-serif;
        --font-secondary: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, 
          Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", "Inter", sans-serif;
        --font-display: swap;
      }
      
      /* Apply immediately */
      body, button, input, select, textarea {
        font-family: var(--font-primary);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      
      h1, h2, h3, h4, h5, h6 {
        font-family: var(--font-secondary);
      }
      
      /* Fix common mobile issues */
      html {
        -webkit-text-size-adjust: 100%;
        text-size-adjust: 100%;
        height: -webkit-fill-available;
      }
      
      /* Prevent input zooming on iOS */
      @media (max-width: 768px) {
        input, textarea, select, button {
          font-size: 16px !important;
        }
      }
    `;
    document.head.appendChild(style);
  })();
  
  // Load Google Fonts as an enhancement, not a requirement
  (function loadGoogleFonts() {
    // Use minimal character set
    var fontUrl = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Poppins:wght@400;500;600&display=swap&text=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;';
    
    // Add preconnect for better performance
    var preconnect1 = document.createElement('link');
    preconnect1.rel = 'preconnect';
    preconnect1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(preconnect1);
    
    var preconnect2 = document.createElement('link');
    preconnect2.rel = 'preconnect';
    preconnect2.href = 'https://fonts.gstatic.com';
    preconnect2.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect2);
    
    // Load fonts async with fallback
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = fontUrl;
    
    // If fonts load successfully, update variables to include them
    link.onload = function() {
      var fontUpdateStyle = document.createElement('style');
      fontUpdateStyle.textContent = `
        :root {
          --font-primary: "Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, 
            Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
          --font-secondary: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, 
            Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
        }
      `;
      document.head.appendChild(fontUpdateStyle);
    };
    
    // Silent fail - we're using system fonts already
    link.onerror = function() {
      // Just keep using system fonts
    };
    
    document.head.appendChild(link);
  })();
})();