// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import App from "./App.jsx";
import { webVitals } from "./utils"; 

// Set global for compatibility
if (typeof global === 'undefined') {
  window.global = window;
}

// Critical CSS that must be loaded immediately for core layout
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/utilities.css";

// Core error boundary for app-wide error handling
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// Load i18n first to ensure translations are available immediately
import "./i18n";

// Global API error handler to gracefully handle 502 errors
const setupGlobalAPIErrorHandler = () => {
  // Save the original fetch
  const originalFetch = window.fetch;
  
  // Override fetch to add global error handling
  window.fetch = async function(...args) {
    try {
      const response = await originalFetch.apply(this, args);
      
      // Handle 502 Bad Gateway errors gracefully (server temporarily unavailable)
      if (response.status === 502) {
        console.warn('API 502 error detected - server may be restarting', args[0]);
        
        // For stories API, provide an empty response instead of failing
        if (typeof args[0] === 'string' && args[0].includes('/api/stories')) {
          console.warn('Returning empty stories array due to 502 error');
          return new Response(JSON.stringify({ success: true, data: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      return response;
    } catch (error) {
      // Log network errors but don't crash the app
      console.error('Network request failed:', error, args[0]);
      
      // For critical APIs, provide fallback empty responses
      if (typeof args[0] === 'string') {
        if (args[0].includes('/api/stories')) {
          console.warn('Returning empty stories array due to network error');
          return new Response(JSON.stringify({ success: true, data: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      // Re-throw for other cases to maintain normal error flow
      throw error;
    }
  };
};

// Setup enhanced photo URL handling for seed images
const setupPhotoUrlEnhancement = () => {
  // Override the normalizePhotoUrl function to handle Unsplash URLs
  window.normalizePhotoUrl = function(url) {
    if (!url) return "/placeholder.svg";
    
    // Handle Unsplash URLs from seed-production.js
    if (url.startsWith("http")) return url;
    
    // Explicitly support Picsum URLs
    if (url.includes("picsum.photos") || url.includes("fastly.picsum.photos")) return url;
    
    // Handle internal paths
    if (url.includes("/images/") || url.includes("/photos/")) {
      return url.startsWith("/uploads") ? url : `/uploads${url.startsWith("/") ? "" : "/"}${url}`;
    }
     
    if (url.startsWith("/uploads/")) {
      return url;
    }
    
    // Default case
    return `/uploads/images/${url.split('/').pop()}`;
  };
  
  // Create a global function to patch image errors with fallbacks
  window.patchImageErrors = function() {
    document.querySelectorAll('img').forEach(img => {
      if (!img.hasAttribute('data-error-handled')) {
        img.setAttribute('data-error-handled', 'true');
        img.addEventListener('error', function() {
          const src = this.src;
          if (!src.includes('placeholder.svg')) {
            console.warn('Image failed to load:', src);
            
            // Check if it's a picsum URL that failed to load
            if (src.includes('picsum.photos') || src.includes('fastly.picsum.photos')) {
              console.warn('Picsum photo failed to load, using placeholder instead');
            }
            
            this.src = '/placeholder.svg';
          }
        });
      }
    });
  };
  
  // Periodically check for new images that need error handling (for dynamically added images)
  setInterval(window.patchImageErrors, 2000);
  
  // Patch existing images immediately
  window.patchImageErrors();
};

// Function to load non-critical CSS
const loadNonCriticalCSS = () => {
  // Create a function to load CSS files in a non-blocking way
  const loadCSS = (href) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  };

  // Use dynamic imports for non-critical CSS
  import("./styles/components.css");
  import("./styles/pages.css");
  
  // Defer loading of less critical CSS
  setTimeout(() => {
    import("./styles/settings.css");
    import("./styles/notifications.css");
    import("./styles/stories.css");
    import("./styles/chat.css");
    import("./styles/modal.css");
    import("./styles/home.css");
    import("./styles/rtl.css");
  }, 500);
  
  // Load admin CSS only if admin route is accessed
  if (window.location.pathname.includes('/admin')) {
    import("./styles/admin.css");
    import("./styles/admin-components.css");
  }
};

// Initialize Web Vitals performance monitoring
webVitals.initWebVitals();

// Create custom event dispatcher for route changes
const originalPushState = history.pushState;
history.pushState = function(state, title, url) {
  webVitals.dispatchRouteChangeStart();
  originalPushState.apply(this, arguments);
  webVitals.dispatchRouteChangeComplete();
};

// Import our enhanced debug middleware
import { applyAPIDebugMiddleware, APIDebugTools } from './debug-middleware';

// Run these immediately
setupGlobalAPIErrorHandler();
setupPhotoUrlEnhancement();

// Initialize API debug middleware for diagnosing 502 errors
applyAPIDebugMiddleware();

// Export debug tools to window for console access
window.APIDebugTools = APIDebugTools;

// Add persistent state management for forms in local storage
const setupFormPersistence = () => {
  window.saveFormState = (formKey, data) => {
    try {
      localStorage.setItem(`form_${formKey}`, JSON.stringify(data));
    } catch (err) {
      console.error('Error saving form state:', err);
    }
  };
  
  window.loadFormState = (formKey) => {
    try {
      const savedState = localStorage.getItem(`form_${formKey}`);
      return savedState ? JSON.parse(savedState) : null;
    } catch (err) {
      console.error('Error loading form state:', err);
      return null;
    }
  };
  
  window.clearFormState = (formKey) => {
    try {
      localStorage.removeItem(`form_${formKey}`);
    } catch (err) {
      console.error('Error clearing form state:', err);
    }
  };
};

setupFormPersistence();

// Add script for deferred loading of non-critical resources
window.addEventListener('load', () => {
  // Defer non-critical CSS loading
  setTimeout(loadNonCriticalCSS, 100);
  
  // Load font enhancement script
  const loadFontDownloader = () => {
    const script = document.createElement('script');
    script.src = '/font-downloader.js';
    script.async = true;
    document.body.appendChild(script);
  };
  setTimeout(loadFontDownloader, 300);
  
  // Load Google Analytics
  // Instead of creating a script element directly, use a more CSP-friendly approach
  const loadGtagScript = () => {
    const script = document.createElement('script');
    script.src = '/gtag-loader.js';
    script.async = true;
    script.onerror = () => {
      console.error('Failed to load Google Analytics script');
    };
    document.body.appendChild(script);
  };
  
  // Delay loading of analytics to prioritize core content
  setTimeout(loadGtagScript, 2000);
});

// Render the application
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Router>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </Router>
  </React.StrictMode>,
);
