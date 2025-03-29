"use client"
// client/src/components/LayoutComponents.js
import { useEffect, useState, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth, useNotifications } from "../context"
import { toast } from "react-toastify"
import {
  FaUserCircle,
  FaBell,
  FaSearch,
  FaHeart,
  FaTimes,
  FaExclamationTriangle, FaEnvelopeOpen,
} from "react-icons/fa"
import NotificationsComponent from "./NotificationsComponent"
import { ThemeToggle } from "./theme-toggle.tsx"

// Modern Navbar Component
export const Navbar = () => {
  // Local state for notifications and dropdown toggling
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [notificationPulse, setNotificationPulse] = useState(false)

  // Refs for dropdown elements
  const notificationDropdownRef = useRef(null)
  const userDropdownRef = useRef(null)
  const notificationButtonRef = useRef(null)

  // Get global notification state from context
  const {
    unreadCount,
    addTestNotification,
  } = useNotifications()

  const { isAuthenticated, logout, user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async (e) => {
    e.preventDefault()
    await logout()
  }

  const navigateToProfile = () => {
    navigate("/profile")
  }

  // Toggle notification dropdown using state
  const toggleNotificationDropdown = (e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setShowNotifications((prevState) => !prevState)
    setShowUserDropdown(false) // Close user dropdown
  }

  // Toggle user dropdown using state
  const toggleUserDropdown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setShowUserDropdown(!showUserDropdown)
    setShowNotifications(false) // Close notification dropdown
  }

  // Close dropdowns if clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationDropdownRef.current &&
        !notificationDropdownRef.current.contains(event.target) &&
        notificationButtonRef.current &&
        !notificationButtonRef.current.contains(event.target)
      ) {
        setShowNotifications(false)
      }
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target) &&
        !event.target.closest(".user-avatar-dropdown")
      ) {
        setShowUserDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Handle adding a test notification
  const handleAddTestNotification = (e) => {
    if (e) {
      e.stopPropagation()
    }

    setNotificationPulse(true)
    setTimeout(() => setNotificationPulse(false), 2000)

    addTestNotification()
  }

  // Handle closing the notification dropdown
  const handleCloseNotifications = () => {
    setShowNotifications(false)
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
              className={`tab-button ${window.location.pathname === "/massages" ? "active" : ""}`}
              onClick={() => navigate("/massages")}
            >
              <FaEnvelopeOpen className="tab-icon" />
              <span>Massages</span>
            </button>
          </div>
        )}

        <div className="header-actions d-flex align-items-center">
          <ThemeToggle />

          {isAuthenticated ? (
            <>
              <div style={{ position: "relative", marginLeft: "10px" }}>
                {/* Notification bell button */}
                <button
                  ref={notificationButtonRef}
                  onClick={toggleNotificationDropdown}
                  aria-label="Notifications"
                  className={`notification-specific-button ${notificationPulse ? "notification-pulse" : ""}`}
                >
                  <FaBell size={20} />
                  {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
                  )}
                </button>

                {/* Notification dropdown with NotificationsComponent */}
                {showNotifications && (
                  <div ref={notificationDropdownRef} className="notification-dropdown">
                    <NotificationsComponent
                      isDropdown={true}
                      maxHeight={400}
                      onClose={handleCloseNotifications}
                      className="notification-dropdown-content"
                      customFilters={['all', 'unread']}
                    />
                  </div>
                )}
              </div>

              <div className="user-avatar-dropdown" style={{ marginLeft: "10px" }}>
                <div style={{ position: "relative" }}>
                  {user?.photos?.length > 0 ? (
                    <img
                      src={user.photos[0].url || "/placeholder.svg?height=32&width=32"}
                      alt={user.nickname}
                      className="user-avatar"
                      style={{ width: "32px", height: "32px" }}
                      onClick={toggleUserDropdown}
                    />
                  ) : (
                    <FaUserCircle
                      style={{
                        fontSize: "32px",
                        cursor: "pointer",
                        color: "var(--text-color)",
                      }}
                      onClick={toggleUserDropdown}
                    />
                  )}

                  {showUserDropdown && (
                    <div ref={userDropdownRef} className="user-dropdown">
                      <div className="user-dropdown-item" onClick={navigateToProfile}>
                        Profile
                      </div>
                      <div className="user-dropdown-item" onClick={() => navigate("/settings")}>
                        Settings
                      </div>
                      <div className="user-dropdown-item" onClick={() => navigate("/subscription")}>
                        Subscription
                      </div>
                      <div className="user-dropdown-divider"></div>
                      <div className="user-dropdown-item danger" onClick={handleLogout}>
                        Logout
                      </div>
                    </div>
                  )}
                </div>
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

      {/* Custom styles for notification specific elements */}
      <style jsx="true">{`
        .notification-specific-button {
          background: var(--primary-color, #ff3366);
          border: none;
          cursor: pointer;
          padding: 0.6rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          width: 40px;
          height: 40px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          z-index: 101;
          transition: all 0.3s ease;
          pointer-events: auto;
          color: white;
          outline: none;
        }

        .notification-specific-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .notification-specific-button:active {
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .notification-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          background-color: var(--danger-color, #dc3545);
          color: white;
          border-radius: 50%;
          font-size: 10px;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .notification-dropdown {
          z-index: 1050;
          display: block;
          visibility: visible;
          opacity: 1;
          position: absolute;
          right: 0;
          top: 100%;
          width: 320px;
          max-height: 400px;
          overflow: hidden;
          background-color: var(--bg-color);
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          border: 1px solid var(--border-color);
        }

        .notification-dropdown-content {
          width: 100%; 
          height: 100%;
          border-radius: 8px;
          overflow: hidden;
        }

        @keyframes notification-pulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(255, 51, 102, 0.7);
          }
          
          70% {
            transform: scale(1.1);
            box-shadow: 0 0 0 10px rgba(255, 51, 102, 0);
          }
          
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(255, 51, 102, 0);
          }
        }

        .notification-pulse {
          animation: notification-pulse 1s cubic-bezier(0.66, 0, 0, 1) 2;
        }
      `}</style>
    </header>
  )
}

// Modern Alert Component
export const Alert = ({ type, message, onClose, actions }) => {
  // Auto-close alert after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onClose) onClose()
    }, 5000)
    return () => clearTimeout(timer)
  }, [onClose])

  // Ensure message is a string
  const formatMessage = (msg) => {
    if (msg === null || msg === undefined) return ""
    if (typeof msg === "string") return msg
    if (typeof msg === "object") {
      if (msg.message) return msg.message
      if (msg.text) return msg.text
      try {
        return JSON.stringify(msg)
      } catch (e) {
        return "An error occurred"
      }
    }
    return String(msg)
  }

  // If type is "toast", show a toast and return null
  useEffect(() => {
    if (type === "toast") {
      try {
        if (typeof message === "object" && message !== null) {
          const toastType = message.type || "info"
          const toastMessage = message.text || formatMessage(message)
          toast[toastType](toastMessage)
        } else {
          toast.info(formatMessage(message))
        }
        if (onClose) onClose()
      } catch (e) {
        console.error("Error showing toast:", e)
        toast.info("Notification")
      }
    }
  }, [type, message, onClose])

  if (type === "toast") return null

  // Map alert types to classes and icons
  const alertClasses = {
    success: "alert-success",
    warning: "alert-warning",
    danger: "alert-danger",
    info: "alert-info",
    primary: "alert-primary",
  }

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

// Private Route Component
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
