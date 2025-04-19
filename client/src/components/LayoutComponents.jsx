"use client"
// client/src/components/LayoutComponents.js
import { useEffect, useState, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth, useNotifications, useLanguage } from "../context"
import { LanguageSelector } from "./common"
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
  const { t } = useTranslation()
  const { isRTL } = useLanguage()
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
    console.log("Toggle notification dropdown")
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
      // Handle notifications dropdown
      const clickedNotificationButton = event.target.closest('.notification-button');
      if (
        notificationDropdownRef.current &&
        !notificationDropdownRef.current.contains(event.target) &&
        !clickedNotificationButton
      ) {
        setShowNotifications(false);
      }
      
      // Handle user dropdown
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target) &&
        !event.target.closest(".user-menu")
      ) {
        setShowUserDropdown(false);
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
    <header className={`app-header ${isRTL ? 'rtl-header' : ''}`}>
      <div className="header-inner">
        <div className="header-logo" onClick={() => navigate("/")}>
          <span>Mandarin</span>
        </div>

        {isAuthenticated && (
          <nav className="header-nav">
            <ul className="nav-tabs">
              <li>
                <button
                  className={`nav-tab ${window.location.pathname === "/dashboard" ? "active" : ""}`}
                  onClick={() => navigate("/dashboard")}
                >
                  <FaSearch />
                  <span className="nav-text">{t('common.search')}</span>
                </button>
              </li>
              <li>
                <button
                  className={`nav-tab ${window.location.pathname === "/messages" ? "active" : ""}`}
                  onClick={() => navigate("/messages")}
                >
                  <FaEnvelopeOpen />
                  <span className="nav-text">{t('common.messages')}</span>
                </button>
              </li>
            </ul>
          </nav>
        )}

        <div className="header-actions">
          <ThemeToggle />
          
          {/* Language Selector component */}
          <LanguageSelector className="navbar-language-selector" />

          {isAuthenticated ? (
            <>
              <div className="notification-wrapper">
                {/* Standalone notification button */}
                <button
                  ref={notificationButtonRef}
                  aria-label="Notifications"
                  className={`notification-button ${notificationPulse ? "notification-pulse" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log("Notification button clicked");
                    toggleNotificationDropdown(e);
                  }}
                  style={{
                    position: "relative",
                    zIndex: 102,
                    cursor: "pointer"
                  }}
                >
                  <FaBell />
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

              <div className="user-menu">
                <div className="user-avatar-container">
                  {user?.photos?.length > 0 ? (
                    <img
                      src={user.photos[0].url || "/placeholder.svg?height=32&width=32"}
                      alt={user.nickname}
                      className="user-avatar"
                      onClick={toggleUserDropdown}
                    />
                  ) : (
                    <FaUserCircle
                      className="user-avatar-icon"
                      onClick={toggleUserDropdown}
                    />
                  )}

                  {showUserDropdown && (
                    <div ref={userDropdownRef} className="user-dropdown">
                      <div className="user-dropdown-item" onClick={navigateToProfile}>
                        <FaUserCircle />
                        {t('common.profile')}
                      </div>
                      <div className="user-dropdown-item" onClick={() => navigate("/settings")}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        {t('common.settings')}
                      </div>
                      <div className="user-dropdown-item" onClick={() => navigate("/subscription")}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
                        {t('common.subscription')}
                      </div>
                      <div className="user-dropdown-divider"></div>
                      <div className="user-dropdown-item danger" onClick={handleLogout}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        {t('common.logout')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="btn btn-outline me-2">
                {t('common.login')}
              </Link>
              <Link to="/register" className="btn btn-primary">
                {t('common.register')}
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
