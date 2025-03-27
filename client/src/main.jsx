// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom"; // <-- Import Router
import App from "./App.jsx";
if (typeof global === 'undefined') {
  window.global = window;
}
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/pages.css";
import "./styles/utilities.css";
// Assuming these are needed globally as well
import "./styles/settings.css";
import "./styles/notifications.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Router> {/* <---- Add the Router wrapper here */}
      <ErrorBoundary> {/* ErrorBoundary is now inside Router */}
        <App />
      </ErrorBoundary>
    </Router> {/* <---- Close the Router wrapper */}
  </React.StrictMode>,
);
