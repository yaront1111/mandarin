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

// Dynamic import of i18n to reduce initial bundle size
const loadI18n = () => import("./i18n");

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

// Run this immediately to get i18n loading
loadI18n();

// Add script for deferred loading of non-critical resources
window.addEventListener('load', () => {
  // Defer non-critical CSS loading
  setTimeout(loadNonCriticalCSS, 100);
  
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
