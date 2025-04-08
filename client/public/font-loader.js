// Font loader with preloading strategy - optimized to avoid render blocking
(function() {
  // Function to create and append font stylesheet
  function loadFont() {
    // Add font-display:swap to ensure text remains visible during font loading
    var style = document.createElement('style');
    style.textContent = `
      /* Primary font - Poppins */
      @font-face {
        font-family: 'Poppins';
        font-style: normal;
        font-weight: 300;
        font-display: swap;
        src: local('Poppins Light'), local('Poppins-Light'),
             url('/fonts/poppins-v20-latin-300.woff2') format('woff2'),
             url('/fonts/poppins-v20-latin-300.woff') format('woff');
      }
      @font-face {
        font-family: 'Poppins';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: local('Poppins Regular'), local('Poppins-Regular'),
             url('/fonts/poppins-v20-latin-regular.woff2') format('woff2'),
             url('/fonts/poppins-v20-latin-regular.woff') format('woff');
      }
      @font-face {
        font-family: 'Poppins';
        font-style: normal;
        font-weight: 500;
        font-display: swap;
        src: local('Poppins Medium'), local('Poppins-Medium'),
             url('/fonts/poppins-v20-latin-500.woff2') format('woff2'),
             url('/fonts/poppins-v20-latin-500.woff') format('woff');
      }
      @font-face {
        font-family: 'Poppins';
        font-style: normal;
        font-weight: 600;
        font-display: swap;
        src: local('Poppins SemiBold'), local('Poppins-SemiBold'),
             url('/fonts/poppins-v20-latin-600.woff2') format('woff2'),
             url('/fonts/poppins-v20-latin-600.woff') format('woff');
      }
      @font-face {
        font-family: 'Poppins';
        font-style: normal;
        font-weight: 700;
        font-display: swap;
        src: local('Poppins Bold'), local('Poppins-Bold'),
             url('/fonts/poppins-v20-latin-700.woff2') format('woff2'),
             url('/fonts/poppins-v20-latin-700.woff') format('woff');
      }
      
      /* Secondary font - Inter */
      @font-face {
        font-family: 'Inter';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: local('Inter Regular'), local('Inter-Regular'),
             url('/fonts/inter-v12-latin-regular.woff2') format('woff2'),
             url('/fonts/inter-v12-latin-regular.woff') format('woff');
      }
      @font-face {
        font-family: 'Inter';
        font-style: normal;
        font-weight: 500;
        font-display: swap;
        src: local('Inter Medium'), local('Inter-Medium'),
             url('/fonts/inter-v12-latin-500.woff2') format('woff2'),
             url('/fonts/inter-v12-latin-500.woff') format('woff');
      }
      @font-face {
        font-family: 'Inter';
        font-style: normal;
        font-weight: 600;
        font-display: swap;
        src: local('Inter SemiBold'), local('Inter-SemiBold'),
             url('/fonts/inter-v12-latin-600.woff2') format('woff2'),
             url('/fonts/inter-v12-latin-600.woff') format('woff');
      }
    `;
    document.head.appendChild(style);
    
    // Add a data attribute to indicate fonts have been loaded
    document.documentElement.setAttribute('data-fonts-loaded', 'true');
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