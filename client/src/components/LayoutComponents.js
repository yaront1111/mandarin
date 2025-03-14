"use client"

// client/src/components/LayoutComponents.js
import { useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../context"
import { toast } from "react-toastify"
import { FaUserCircle, FaBell, FaSearch, FaHeart, FaTimes, FaExclamationTriangle } from "react-icons/fa"
import { ThemeToggle } from "./theme-toggle.tsx"

// Modern Navbar Component
export const Navbar = () => {
  const { isAuthenticated, logout, user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async (e) => {
    e.preventDefault()
    await logout()
  }

  const navigateToProfile = () => {
    navigate("/profile")
  }

  return (
    <header className="modern-header">
      <div className="container d-flex justify-content-between align-items-center">
        <div className="logo" style={{ cursor: "pointer" }} onClick={() => navigate("/")}>
          Mandarin
        </div>

        {isAuthenticated && (
          <div className="main-tabs d-none d-md-flex">
            <button
              className={`tab-button ${window.location.pathname === "/dashboard" ? "active" : ""}`}
              onClick={() => navigate("/dashboard")}
            >
              <FaSearch className="tab-icon" />
              <span>Discover</span>
            </button>
            <button
              className={`tab-button ${window.location.pathname === "/matches" ? "active" : ""}`}
              onClick={() => navigate("/matches")}
            >
              <FaHeart className="tab-icon" />
              <span>Matches</span>
            </button>
          </div>
        )}

        <div className="header-actions d-flex align-items-center">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <button className="header-action-button">
                <FaBell />
              </button>
              <div className="user-avatar-dropdown">
                {user?.photos?.length > 0 ? (
                  <img
                    src={user.photos[0].url || "/placeholder.svg"}
                    alt={user.nickname}
                    className="user-avatar"
                    onClick={navigateToProfile}
                  />
                ) : (
                  <FaUserCircle className="user-avatar" style={{ fontSize: "32px" }} onClick={navigateToProfile} />
                )}
              </div>
            </>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="btn btn-outline me-2">
                Login
              </Link>
              <Link to="/register" className="btn btn-primary">
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

// Modern Alert Component
export const Alert = ({ type, message, onClose, actions }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onClose) onClose()
    }, 5000)
    return () => clearTimeout(timer)
  }, [onClose])

  // Format the message to ensure it's a string
  const formatMessage = (msg) => {
    if (msg === null || msg === undefined) {
      return ""
    }

    if (typeof msg === "string") {
      return msg
    }

    if (typeof msg === "object") {
      // For error objects or objects with message property
      if (msg.message) {
        return msg.message
      }
      // For toast-style objects
      if (msg.text) {
        return msg.text
      }
      // Last resort - stringify the object
      try {
        return JSON.stringify(msg)
      } catch (e) {
        return "An error occurred"
      }
    }

    // For any other type, convert to string
    return String(msg)
  }

  // Show toast instead of alert component if specified
  useEffect(() => {
    if (type === "toast") {
      try {
        // Handle different message formats for toast
        if (typeof message === "object" && message !== null) {
          const toastType = message.type || "info"
          const toastMessage = message.text || formatMessage(message)
          toast[toastType](toastMessage)
        } else {
          // For string messages or other types
          toast.info(formatMessage(message))
        }

        if (onClose) onClose()
      } catch (e) {
        console.error("Error showing toast:", e)
        // Fallback to a basic toast
        toast.info("Notification")
      }
    }
  }, [type, message, onClose])

  // Return null for toast type alerts
  if (type === "toast") return null

  // Alert types mapped to modern design classes
  const alertClasses = {
    success: "alert-success",
    warning: "alert-warning",
    danger: "alert-danger",
    info: "alert-info",
    primary: "alert-primary",
  }

  // Alert icons based on type
  const alertIcons = {
    success: <span className="alert-icon success"></span>,
    warning: <FaExclamationTriangle className="alert-icon warning" />,
    danger: <FaExclamationTriangle className="alert-icon danger" />,
    info: <span className="alert-icon info"></span>,
    primary: <span className="alert-icon primary"></span>,
  }

  return (
    <div className={`alert ${alertClasses[type] || "alert-primary"}`}>
      {alertIcons[type]}
      <span className="alert-message">{formatMessage(message)}</span>
      {actions && (
        <div className="alert-actions">
          {actions.map((action, index) => (
            <button
              key={index}
              className={`btn btn-sm ${action.type ? `btn-${action.type}` : "btn-primary"}`}
              onClick={action.action}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      {onClose && (
        <button className="alert-close-btn" onClick={onClose}>
          <FaTimes />
        </button>
      )}
    </div>
  )
}

// Private Route Component (functionality remains the same, styling updated)
export const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading, error } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login", {
        replace: true,
        state: { from: window.location.pathname },
      })
    }
  }, [isAuthenticated, loading, navigate])

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner spinner-dark"></div>
        <p className="loading-text">Loading...</p>
      </div>
    )
  }

  if (error) {
    // Format error message to ensure it's a string
    const errorMessage =
      typeof error === "object" && error !== null
        ? error.message || JSON.stringify(error)
        : String(error || "Authentication error")

    return (
      <div className="auth-error">
        <div className="auth-error-content">
          <FaExclamationTriangle className="auth-error-icon" />
          <h3>Authentication Error</h3>
          <p>{errorMessage}</p>
          <button onClick={() => navigate("/login")} className="btn btn-primary">
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return isAuthenticated ? children : null
}
