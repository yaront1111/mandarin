// Simple Font Downloader Script (fallback version)
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
  
  // Load Google Fonts as fallback
  function loadGoogleFontsFallback() {
    if (fallbacksAdded) return; // Only add once
    
    console.log('Adding Google Fonts fallback for missing fonts');
    
    // Create link for Google Fonts
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@300;400;500;600;700&display=swap';
    document.head.appendChild(link);
    
    // Mark that we've added fallbacks
    fallbacksAdded = true;
    
    // Add a class to the document to indicate we're using fallback fonts
    document.documentElement.classList.add('using-fallback-fonts');
  }
  
  // Create system font fallbacks for all expected fonts
  function createSystemFontFallbacks() {
    if (fallbacksAdded) return; // Only add once
    
    console.log('Adding system font fallbacks');
    
    const style = document.createElement('style');
    let cssText = '';
    
    // Add fallback for each expected font
    expectedFonts.forEach(font => {
      cssText += `
        @font-face {
          font-family: '${font.family}';
          font-style: normal;
          font-weight: ${font.weight};
          font-display: swap;
          src: local('Arial'), local('Helvetica'), local('sans-serif');
        }
      `;
    });
    
    style.textContent = cssText;
    document.head.appendChild(style);
    
    // Mark that we've added fallbacks
    fallbacksAdded = true;
    
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
  
  // Main function to check fonts and add fallbacks if needed
  async function checkFontsAndAddFallbacks() {
    try {
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
        // If fonts haven't loaded after 3 seconds, add system fallbacks
        if (document.fonts && !document.fonts.check('1em Poppins')) {
          console.warn('Fonts still not loaded after timeout, adding system fallbacks');
          createSystemFontFallbacks();
        }
      }, 3000);
      
    } catch (error) {
      console.error('Error checking fonts:', error);
      // If there's any error, add system font fallbacks
      createSystemFontFallbacks();
    }
  }
  
  // Run the font check with a slight delay to not block initial rendering
  setTimeout(checkFontsAndAddFallbacks, 500);
})();