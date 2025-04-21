// This file is used to preload assets that are critical for initial render
document.addEventListener('DOMContentLoaded', function() {
  // Preload critical images
  const criticalImages = [
    '/images/flirtss-social-share.jpg',
    '/logo.png',
    '/favicon.ico'
  ];
  
  criticalImages.forEach(function(src) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
  });
  
  // Preload critical fonts (if not loaded via Google Fonts)
  const criticalFonts = [
    '/fonts/your-font-file.woff2'
  ];
  
  criticalFonts.forEach(function(src) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.href = src;
    link.type = 'font/woff2';
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
});