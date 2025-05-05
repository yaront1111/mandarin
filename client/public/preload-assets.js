// Enhanced asset preloading for faster initial load
(function() {
  // Execute immediately for faster initialization (don't wait for DOMContentLoaded)
  
  // 1. Priority loading for critical resources
  
  // Critical CSS files - high priority
  const criticalStylesheets = [
    '/src/styles/base.css',
    '/src/styles/layout.css'
  ];
  
  // Critical images needed for first render
  const criticalImages = [
    '/placeholder.svg',
    '/default-avatar.png',
    '/logo.png'
  ];
  
  // 2. Moderate priority resources (needed soon after first paint)
  const secondaryImages = [
    '/images/flirtss-social-share.jpg',
    '/favicon.ico'
  ];
  
  // Anticipated next-page assets (preloaded after critical assets)
  const anticipatedAssets = [
    // Common routes users navigate to after landing page
    '/src/pages/Login.jsx', 
    '/src/pages/Register.jsx'
  ];
  
  // 3. Create preload function with priority management
  function preloadAsset(src, type, priority, options = {}) {
    const link = document.createElement('link');
    link.rel = priority === 'high' ? 'preload' : 'prefetch';
    link.as = type;
    link.href = src;
    
    if (type === 'font') {
      link.type = 'font/woff2';
      link.crossOrigin = 'anonymous';
    }
    
    if (options.importance) {
      link.importance = options.importance;
    }
    
    document.head.appendChild(link);
  }
  
  // 4. Load assets in priority order
  
  // High priority - critical path resources
  criticalStylesheets.forEach(src => preloadAsset(src, 'style', 'high', { importance: 'high' }));
  criticalImages.forEach(src => preloadAsset(src, 'image', 'high', { importance: 'high' }));
  
  // Delay secondary resources using requestIdleCallback if available
  const loadSecondaryResources = () => {
    secondaryImages.forEach(src => preloadAsset(src, 'image', 'medium', { importance: 'auto' }));
    
    // Prefetch anticipated next pages
    anticipatedAssets.forEach(src => preloadAsset(src, 'script', 'low', { importance: 'low' }));
  };
  
  // Use requestIdleCallback if available, otherwise setTimeout as fallback
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => loadSecondaryResources(), { timeout: 2000 });
  } else {
    setTimeout(loadSecondaryResources, 1000);
  }
  
  // 5. Preconnect to external domains (CDNs, APIs, etc.)
  const preconnectDomains = [
    'https://fonts.googleapis.com', 
    'https://fonts.gstatic.com'
  ];
  
  preconnectDomains.forEach(domain => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = domain;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
})();