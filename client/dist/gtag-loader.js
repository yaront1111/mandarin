// Optimized Google Analytics loader that doesn't block rendering
(function() {
  // Create preconnect link to Google Tag Manager domain
  var preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = 'https://www.googletagmanager.com';
  document.head.appendChild(preconnect);
  
  // Load Google Analytics after initial page load
  window.addEventListener('load', function() {
    // Delay GA loading slightly to prioritize core content
    setTimeout(function() {
      // Create the GA script element
      var script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=G-Y9EQ02574T';
      
      // Add the script to the page
      document.head.appendChild(script);
      
      // Initialize dataLayer and gtag function
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-Y9EQ02574T', { 
        'transport_type': 'beacon',
        'send_page_view': true
      });
      
      // Expose gtag to window for future use
      window.gtag = gtag;
    }, 1000); // 1-second delay after page load
  });
})();