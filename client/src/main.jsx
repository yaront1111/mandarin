import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.jsx" // Update extension here
if (typeof global === 'undefined') {
  window.global = window;
}
import ErrorBoundary from "./components/ErrorBoundary.jsx" // Update extension here
import "./styles/base.css"
import "./styles/components.css"
import "./styles/pages.css"
import "./styles/utilities.css"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
