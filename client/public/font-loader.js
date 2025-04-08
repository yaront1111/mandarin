// Font loader with direct Google Fonts integration and system fallbacks
(function() {
  // Function to add Google Fonts
  function loadGoogleFonts() {
    console.log("Loading fonts from Google Fonts");
    
    // Create link for Google Fonts for Poppins and Inter
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@300;400;500;600;700&display=swap';
    document.head.appendChild(link);
  }
  
  // Function to set up system font fallbacks
  function setupSystemFonts() {
    console.log("Setting up system font fallbacks");
    
    // Add font-display:swap to ensure text remains visible during font loading
    var style = document.createElement('style');
    style.textContent = `
      /* Primary font with local fallbacks */
      :root {
        --font-primary: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        --font-secondary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      }
      
      body {
        font-family: var(--font-primary);
      }
      
      /* Ensure text is visible during font load */
      html, body {
        font-display: swap !important;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Try to load fonts from Google first
  loadGoogleFonts();
  
  // Also set up system font fallbacks for reliability
  setupSystemFonts();
  
  // Set a flag to indicate fonts are being loaded
  document.documentElement.setAttribute('data-fonts-loading', 'true');
  
  // Mark fonts as loaded after they're likely to have loaded
  setTimeout(function() {
    document.documentElement.setAttribute('data-fonts-loaded', 'true');
    document.documentElement.removeAttribute('data-fonts-loading');
  }, 2000);
})();