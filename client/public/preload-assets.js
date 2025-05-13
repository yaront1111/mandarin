// Enhanced asset preloading for faster initial load
(function() {
  // Execute immediately for faster initialization (don't wait for DOMContentLoaded)
  
  // 1. Priority loading for critical resources
  
  // Critical CSS files - high priority
  const criticalStylesheets = [
    '/src/styles/base.css',
    '/src/styles/layout.css'
  ];
  
  // Critical images needed for first render with absolute URLs to avoid path issues
  const criticalImages = [
    '/placeholder.svg',
    '/default-avatar.png',
    '/women-avatar.png', // Gender-specific avatars (note spelling: women not woman)
    '/man-avatar.png',
    '/couple-avatar.png',
    '/logo.png'
  ];
  
  // Force immediate loading of gender avatars to ensure they're available
  (function preloadCriticalImages() {
    // Force load the gender avatar images to ensure they're in browser cache
    const imageUrls = [
      window.location.origin + '/women-avatar.png',
      window.location.origin + '/man-avatar.png',
      window.location.origin + '/couple-avatar.png',
      window.location.origin + '/default-avatar.png'
    ];
    
    // Add avatar images to the DOM for debugging and to keep them in memory
    const avatarPreloadDiv = document.createElement('div');
    avatarPreloadDiv.id = 'avatar-preload-container';
    avatarPreloadDiv.style.cssText = 'position: absolute; width: 0; height: 0; overflow: hidden; z-index: -1;';
    document.body.appendChild(avatarPreloadDiv);
    
    imageUrls.forEach(url => {
      const img = new Image();
      img.src = url;
      img.crossOrigin = 'anonymous';
      img.style.position = 'absolute';
      img.style.width = '1px';
      img.style.height = '1px';
      img.style.opacity = '0.01';
      
      // Add to DOM to ensure it stays loaded
      avatarPreloadDiv.appendChild(img);
      
      // Log successful load or error for debugging
      img.onload = () => console.log('Avatar preloaded successfully:', url);
      img.onerror = (e) => {
        console.error('Failed to preload avatar:', url, e);
        // Try again without cache buster
        if (url.includes('?')) {
          const retryImg = new Image();
          retryImg.src = url.split('?')[0];
          retryImg.crossOrigin = 'anonymous';
          retryImg.style.cssText = img.style.cssText;
          avatarPreloadDiv.appendChild(retryImg);
        }
      };
    });
    
    // Create tiny image references in localStorage for direct access
    try {
      window.localStorage.setItem('avatar_cache_paths', JSON.stringify({
        'woman': '/women-avatar.png',
        'women': '/women-avatar.png',
        'man': '/man-avatar.png',
        'couple': '/couple-avatar.png',
        'default': '/default-avatar.png'
      }));
    } catch (e) {
      console.warn('Could not cache avatar paths in localStorage', e);
    }
  })();
  
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