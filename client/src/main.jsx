// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom"; // <-- Import Router
import App from "./App.jsx";
import "./i18n"; // Import i18n configuration
import { webVitals } from "./utils"; // Import Web Vitals for performance tracking
if (typeof global === 'undefined') {
  window.global = window;
}
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./styles/base.css";
import "./styles/layout.css"; // Modern layout system
import "./styles/components.css"; // Updated with 2025 Design System
import "./styles/pages.css";
import "./styles/utilities.css";
// Assuming these are needed globally as well
import "./styles/settings.css"; // Using regular CSS for settings
import "./styles/notifications.css";
import "./styles/stories.css"; // Using regular CSS for stories
import "./styles/chat.css"; // General chat styling
import "./styles/modal.css"; // Modal component styling
import "./styles/home.css"; // Home page specific styling
import "./styles/rtl.css"; // RTL support for Hebrew
import "./styles/admin.css"; // Admin dashboard styling
import "./styles/admin-components.css"; // Admin component styling

// Initialize Web Vitals performance monitoring
webVitals.initWebVitals();

// Create custom event dispatcher for route changes
const originalPushState = history.pushState;
history.pushState = function(state, title, url) {
  webVitals.dispatchRouteChangeStart();
  originalPushState.apply(this, arguments);
  webVitals.dispatchRouteChangeComplete();
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Router> {/* <---- Add the Router wrapper here */}
      <ErrorBoundary> {/* ErrorBoundary is now inside Router */}
        <App />
      </ErrorBoundary>
    </Router> {/* <---- Close the Router wrapper */}
  </React.StrictMode>,
);
