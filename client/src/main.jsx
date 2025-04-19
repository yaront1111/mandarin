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
import "./styles/layout.css"; // Modern layout system
import "./styles/pages.css";
// Assuming these are needed globally as well
import "./styles/notifications.css";
import "./styles/stories.module.css"
import "./styles/chat.css"; // General chat styling
import "./styles/modal.css"; // Modal component styling
import "./styles/home.css"; // Home page specific styling

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Router> {/* <---- Add the Router wrapper here */}
      <ErrorBoundary> {/* ErrorBoundary is now inside Router */}
        <App />
      </ErrorBoundary>
    </Router> {/* <---- Close the Router wrapper */}
  </React.StrictMode>,
);
