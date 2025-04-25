// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom"; // <-- Import Router
import App from "./App.jsx";
import "./i18n"; // Import i18n configuration
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { HelmetProvider } from 'react-helmet-async';

// Import styles in the correct cascade order
import "./styles/base.css";
import "./styles/layout.css"; // Modern layout system
import "./styles/pages.css";
import "./styles/notifications.css";
import "./styles/stories.module.css";
import "./styles/modal.css"; // Modal component styling
import "./styles/home.css"; // Home page specific styling
import "./styles/policy-pages.css"; // Policy pages styling
import "./styles/mobile.css"; // Mobile-specific enhancements (should be last to override)

// Polyfill for global if needed (keep as is)
if (typeof global === 'undefined') {
  window.global = window;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* Wrap with HelmetProvider */}
    <HelmetProvider>
      <Router>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </Router>
    </HelmetProvider>
  </React.StrictMode>,
);
