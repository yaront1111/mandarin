// Font Downloader Script with Enhanced Fallbacks and CDN Support
(function() {
  // Log function that's less verbose
  function log(message, level = 'debug') {
    // Only log warnings and errors to console
    if (level === 'warn' || level === 'error') {
      console[level](message);
    }
  }

  // Check if a font file exists by doing a HEAD request
  function checkFontExists(url) {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('HEAD', url, true);
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          resolve(xhr.status === 200);
        }
      };
      xhr.send();
    });
  }

  // Immediately use Google Fonts and system fallbacks to ensure fonts always work
  async function setupFonts() {
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
    
    // Check if local fonts exist - if not, add Google Fonts fallback
    const poppinsUrl = '/fonts/poppins-v20-latin-300.woff2';
    const interUrl = '/fonts/inter-v12-latin-regular.woff2';
    
    const [poppinsExists, interExists] = await Promise.all([
      checkFontExists(poppinsUrl),
      checkFontExists(interUrl)
    ]);
    
    if (!poppinsExists) {
      log('Missing font: poppins-v20-latin-300.woff2', 'warn');
    }
    
    if (!interExists) {
      log('Missing font: inter-v12-latin-regular.woff2', 'warn');
    }
    
    // Add font-face declarations with proper fallback strategy
    const fontFaceStyle = document.createElement('style');
    fontFaceStyle.textContent = `
      /* Poppins Font */
      @font-face {
        font-family: 'Poppins';
        font-style: normal;
        font-weight: 300;
        font-display: swap;
        src: ${poppinsExists ? 
          `url('${poppinsUrl}') format('woff2'),` : ''}
          url('https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLDz8Z1xlFd2JQEk.woff2') format('woff2'),
          local('Poppins'),
          local('Segoe UI'),
          local('Roboto'),
          local('sans-serif');
      }
      
      @font-face {
        font-family: 'Poppins';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: ${poppinsExists ? 
          `url('${poppinsUrl.replace('300', '400')}') format('woff2'),` : ''}
          url('https://fonts.gstatic.com/s/poppins/v20/pxiEyp8kv8JHgFVrJJfecnFHGPc.woff2') format('woff2'),
          local('Poppins'),
          local('Segoe UI'),
          local('Roboto'),
          local('sans-serif');
      }
      
      @font-face {
        font-family: 'Poppins';
        font-style: normal;
        font-weight: 500;
        font-display: swap;
        src: ${poppinsExists ? 
          `url('${poppinsUrl.replace('300', '500')}') format('woff2'),` : ''}
          url('https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLGT9Z1xlFd2JQEk.woff2') format('woff2'),
          local('Poppins'),
          local('Segoe UI'),
          local('Roboto'),
          local('sans-serif');
      }
      
      @font-face {
        font-family: 'Poppins';
        font-style: normal;
        font-weight: 600;
        font-display: swap;
        src: ${poppinsExists ? 
          `url('${poppinsUrl.replace('300', '600')}') format('woff2'),` : ''}
          url('https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLEj6Z1xlFd2JQEk.woff2') format('woff2'),
          local('Poppins'),
          local('Segoe UI'),
          local('Roboto'),
          local('sans-serif');
      }
      
      /* Inter Font */
      @font-face {
        font-family: 'Inter';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: ${interExists ? 
          `url('${interUrl}') format('woff2'),` : ''}
          url('https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5n-wU.woff2') format('woff2'),
          local('Inter'),
          local('Segoe UI'),
          local('Roboto'),
          local('sans-serif');
      }
      
      @font-face {
        font-family: 'Inter';
        font-style: normal;
        font-weight: 500;
        font-display: swap;
        src: ${interExists ? 
          `url('${interUrl.replace('regular', '500')}') format('woff2'),` : ''}
          url('https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5n-wU.woff2') format('woff2'),
          local('Inter'),
          local('Segoe UI'),
          local('Roboto'),
          local('sans-serif');
      }
    `;
    document.head.appendChild(fontFaceStyle);
    
    // If any fonts are missing, add Google Fonts as fallback
    if (!poppinsExists || !interExists) {
      log('Adding Google Fonts fallback for missing fonts', 'warn');
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Poppins:wght@300;400;500;600&display=swap';
      document.head.appendChild(link);
    }
    
    // Fallback if fonts still not loaded after 3 seconds
    const timeoutId = setTimeout(() => {
      log('Fonts still not loaded after timeout, adding system fallbacks', 'warn');
      
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
  }

  // Add support for Unsplash and external image URLs
  function enhanceImageHandling() {
    // Override the normalizePhotoUrl function globally for all components
    window.enhanceNormalizePhotoUrl = function(url) {
      if (!url) return "/placeholder.svg";
      
      // If it's already an absolute URL (external or internal), return as is
      if (url.startsWith("http")) return url;
      
      // If it's an Unsplash URL (from seeded users), return as is
      if (url.includes("unsplash.com")) return url;
      
      // If it's a Picsum URL, return as is
      if (url.includes("picsum.photos") || url.includes("fastly.picsum.photos")) return url;
      
      // Handle internal paths
      if (url.includes("/images/") || url.includes("/photos/")) {
        return url.startsWith("/uploads") ? url : `/uploads${url.startsWith("/") ? "" : "/"}${url}`;
      }
      
      if (url.startsWith("/uploads/")) {
        return url;
      }
      
      // Default case - assume it's a relative path to images directory
      return `/uploads/images/${url.split('/').pop()}`;
    };
    
    // Add a global event listener to intercept image errors and provide fallbacks
    document.addEventListener('error', function(event) {
      if (event.target.tagName.toLowerCase() === 'img') {
        // If image failed to load and is not already a placeholder
        if (
          !event.target.src.includes('/placeholder.svg') && 
          !event.target.getAttribute('data-fallback-tried')
        ) {
          log(`Image failed to load: ${event.target.src}`, 'warn');
          event.target.setAttribute('data-fallback-tried', 'true');
          event.target.src = '/placeholder.svg';
        }
      }
    }, true); // Capture phase to catch events before they reach the target

    // Add global CSS for cleaner image error handling
    const imgStyle = document.createElement('style');
    imgStyle.textContent = `
      img.error, img[data-fallback-tried="true"] {
        opacity: 0.7;
        background-color: #f5f5f5;
      }
    `;
    document.head.appendChild(imgStyle);
    
    log('Enhanced image handling initialized');
  }

  // Run immediately
  setupFonts().catch(err => {
    console.error('Font setup error:', err);
    // Add system font fallbacks as emergency recovery
    const emergencyStyle = document.createElement('style');
    emergencyStyle.textContent = `
      /* Emergency system font fallbacks */
      body, button, input, select, textarea, h1, h2, h3, h4, h5, h6 {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 
          Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif !important;
      }
    `;
    document.head.appendChild(emergencyStyle);
  });
  enhanceImageHandling();
})();