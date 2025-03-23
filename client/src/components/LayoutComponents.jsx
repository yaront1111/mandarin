"use client"
// client/src/components/LayoutComponents.js
import { useEffect, useState, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../context"
import { toast } from "react-toastify"
import { FaUserCircle, FaBell, FaSearch, FaHeart, FaTimes, FaExclamationTriangle, FaPlus } from "react-icons/fa"
import { ThemeToggle } from "./theme-toggle.tsx"

// Modern Navbar Component
export const Navbar = () => {
  // Local state for notifications and dropdown toggling
  const [notifications, setNotifications] = useState([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [notificationPulse, setNotificationPulse] = useState(false)

  // Refs for dropdown elements
  const notificationDropdownRef = useRef(null)
  const userDropdownRef = useRef(null)
  const notificationButtonRef = useRef(null)
  const addNotificationBtnRef = useRef(null)

  // Update unread count when notifications change
  useEffect(() => {
    const count = notifications.filter((n) => !n.read).length
    setUnreadCount(count)
  }, [notifications])

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
    console.log("Toggling notification dropdown")
    setShowNotifications((prevState) => !prevState)
    setShowUserDropdown(false) // Close user dropdown
    // Show a toast to confirm the button works
    if (!showNotifications) {
      toast.info("Notifications opened")
    }
  }

  // Toggle user dropdown using state
  const toggleUserDropdown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    console.log("User dropdown button clicked")
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

  // Handle notification click
  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      try {
        // Simulate marking notification as read
        setNotifications((prev) => prev.map((n) => (n._id === notification._id ? { ...n, read: true } : n)))
        toast.success("Notification marked as read")
      } catch (error) {
        console.error("Failed to mark notification as read:", error)
      }
    }
    // Navigate based on notification type
    if (notification.type === "message") {
      navigate(`/messages`)
    } else if (notification.type === "like" || notification.type === "match") {
      navigate(`/profile`)
    }
    // Close dropdown
    setShowNotifications(false)
  }

  const markAllAsRead = (e) => {
    e.stopPropagation()
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    toast.success("All notifications marked as read")
  }

  // Render notifications list
  const renderNotifications = () => {
    if (loadingNotifications) {
      return (
        <div className="notification-loading">
          <div className="spinner"></div>
          <p>Loading notifications...</p>
        </div>
      )
    }
    if (notifications.length === 0) {
      return <div className="notification-empty">No notifications yet</div>
    }
    return notifications.map((notification) => (
      <div
        key={notification._id}
        className={`notification-item ${!notification.read ? "unread" : ""}`}
        onClick={() => handleNotificationClick(notification)}
      >
        <div className="notification-icon">
          <FaBell />
        </div>
        <div className="notification-content">
          <div className="notification-title">{notification.message}</div>
          <div className="notification-time">{new Date(notification.createdAt).toLocaleTimeString()}</div>
        </div>
      </div>
    ))
  }

  // Add a test notification
  const addTestNotification = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    console.log("Adding test notification");

    // Create a new test notification
    const newNotification = {
      _id: Date.now().toString(),
      type: "message",
      message: "Test notification",
      read: false,
      createdAt: new Date().toISOString(),
      data: { conversationId: "test" },
    }

    // Add to notifications
    setNotifications((prev) => [newNotification, ...prev])

    // Add pulse animation to notification bell
    setNotificationPulse(true)
    setTimeout(() => setNotificationPulse(false), 2000)

    // Show confirmation toast
    toast.info("Test notification added")
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

          {/* Special add notification button with custom class */}
          {isAuthenticated && (
            <button
              ref={addNotificationBtnRef}
              onClick={addTestNotification}
              className="add-notification-btn"
              aria-label="Add Test Notification"
            >
              <FaPlus size={16} />
            </button>
          )}

          {isAuthenticated ? (
            <>
              <div style={{ position: "relative", marginLeft: "10px" }}>
                <button
                  ref={notificationButtonRef}
                  onClick={toggleNotificationDropdown}
                  aria-label="Notifications"
                  className={`notification-button ${notificationPulse ? "notification-pulse" : ""}`}
                >
                  <FaBell size={20} />
                  {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
                  )}
                </button>

                {showNotifications && (
                  <div ref={notificationDropdownRef} className="notification-dropdown">
                    <div className="notification-header">
                      <span>Notifications</span>
                      {unreadCount > 0 && (
                        <span className="notification-header-action" onClick={markAllAsRead}>
                          Mark all as read
                        </span>
                      )}
                    </div>
                    <div>{renderNotifications()}</div>
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
