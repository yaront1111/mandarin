// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom"; // <-- Import Router
import App from "./App.jsx";
import "./i18n"; // Import i18n configuration
if (typeof global === 'undefined') {
  window.global = window;
}
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./styles/base.css";
import { HelmetProvider } from 'react-helmet-async';
import "./styles/layout.css"; // Modern layout system
import "./styles/pages.css";
// Assuming these are needed globally as well
import "./styles/notifications.css";
import "./styles/stories.module.css"
import "./styles/modal.css"; // Modal component styling
import "./styles/home.css"; // Home page specific styling
import "./styles/policy-pages.css"; // Policy pages styling

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
