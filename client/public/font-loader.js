// Font loader with preloading strategy - optimized to avoid render blocking
(function() {
  // Function to create and append font stylesheet
  function loadFont() {
    // Create a non-blocking link for Google Fonts
    var fontLink = document.createElement('link');
    fontLink.rel = 'preload';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap';
    fontLink.as = 'style';
    document.head.appendChild(fontLink);
    
    // Convert to stylesheet after preloading
    fontLink.onload = function() {
      // Change from preload to stylesheet
      fontLink.rel = 'stylesheet';
      
      // Add a data attribute to indicate fonts have been loaded
      document.documentElement.setAttribute('data-fonts-loaded', 'true');
    };
    
    // Fallback in case onload doesn't fire
    setTimeout(function() {
      if (fontLink.rel !== 'stylesheet') {
        fontLink.rel = 'stylesheet';
      }
    }, 2000);
    
    // Add font-display:swap to ensure text remains visible during font loading
    var style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: 'Poppins';
        font-style: normal;
        font-weight: 300;
        font-display: swap;
        src: url(https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLDz8Z1xlFQ.woff2) format('woff2');
      }
      @font-face {
        font-family: 'Poppins';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: url(https://fonts.gstatic.com/s/poppins/v20/pxiEyp8kv8JHgFVrJJfecg.woff2) format('woff2');
      }
      @font-face {
        font-family: 'Poppins';
        font-style: normal;
        font-weight: 500;
        font-display: swap;
        src: url(https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLGT9Z1xlFQ.woff2) format('woff2');
      }
      @font-face {
        font-family: 'Poppins';
        font-style: normal;
        font-weight: 600;
        font-display: swap;
        src: url(https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLEj6Z1xlFQ.woff2) format('woff2');
      }
      @font-face {
        font-family: 'Poppins';
        font-style: normal;
        font-weight: 700;
        font-display: swap;
        src: url(https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLCz7Z1xlFQ.woff2) format('woff2');
      }
    `;
    document.head.appendChild(style);
  }

  // Load fonts after a very brief delay to prioritize critical content
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(loadFont, 50);
    });
  } else {
    setTimeout(loadFont, 50);
  }
})();