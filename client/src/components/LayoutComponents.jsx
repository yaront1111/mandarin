

// client/src/components/LayoutComponents.js
import { useEffect, useState, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../context"
import { toast } from "react-toastify"
import {
  FaUserCircle,
  FaBell,
  FaSearch,
  FaHeart,
  FaTimes,
  FaExclamationTriangle,
  FaComment,
  FaEnvelope,
} from "react-icons/fa"
import { ThemeToggle } from "./theme-toggle.tsx"

// Dropdown and notification CSS styles injected into document head
const dropdownStyles = `
  .dropdown-menu {
    display: none;
    position: absolute;
    right: 0;
    background-color: #fff;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    min-width: 180px;
    padding: 8px 0;
    margin-top: 8px;
  }
  
  .dropdown-menu.show {
    display: block;
  }
  
  .dropdown-item {
    padding: 8px 16px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .dropdown-item:hover {
    background-color: #f5f5f5;
  }
  
  .dropdown-divider {
    height: 1px;
    background-color: #e9ecef;
    margin: 4px 0;
  }
  
  .text-danger {
    color: #dc3545;
  }
  
  .dropdown {
    position: relative;
  }

  /* Notification styles */
  .notification-badge {
    position: absolute;
    top: -5px;
    right: -5px;
    background-color: #ff4757;
    color: white;
    border-radius: 50%;
    min-width: 18px;
    height: 18px;
    font-size: 11px;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #fff;
  }

  .notification-dropdown {
    width: 320px;
    max-height: 400px;
    overflow-y: auto;
    padding: 0;
  }

  .notification-header {
    padding: 12px 16px;
    font-weight: bold;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .notification-item {
    padding: 12px 16px;
    border-bottom: 1px solid #f0f0f0;
    display: flex;
    align-items: flex-start;
    transition: background-color 0.2s;
  }

  .notification-item:hover {
    background-color: #f5f5f5;
  }

  .notification-item.unread {
    background-color: #f0f8ff;
  }

  .notification-item.unread:hover {
    background-color: #e6f3ff;
  }

  .notification-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 12px;
    flex-shrink: 0;
  }

  .notification-icon.message { background-color: #e3f2fd; color: #2196f3; }
  .notification-icon.like { background-color: #ffebee; color: #f44336; }
  .notification-icon.comment { background-color: #e8f5e9; color: #4caf50; }
  .notification-icon.story { background-color: #fff3e0; color: #ff9800; }

  .notification-content {
    flex: 1;
  }

  .notification-title {
    font-weight: 500;
    margin-bottom: 4px;
  }

  .notification-message {
    font-size: 13px;
    color: #666;
  }

  .notification-time {
    font-size: 11px;
    color: #999;
    margin-top: 4px;
  }

  .notification-empty {
    padding: 24px 16px;
    text-align: center;
    color: #666;
  }

  .mark-all-read {
    color: #2196f3;
    font-size: 13px;
    cursor: pointer;
  }

  .mark-all-read:hover {
    text-decoration: underline;
  }

  /* Dark mode support */
  .dark .dropdown-menu {
    background-color: #2d3748;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .dark .dropdown-item:hover {
    background-color: #3a4556;
  }

  .dark .dropdown-divider {
    background-color: #4a5568;
  }

  .dark .notification-item {
    border-bottom-color: #3a4556;
  }

  .dark .notification-item:hover {
    background-color: #3a4556;
  }

  .dark .notification-item.unread {
    background-color: #2c3e50;
  }

  .dark .notification-item.unread:hover {
    background-color: #34495e;
  }

  .dark .notification-message {
    color: #cbd5e0;
  }

  .dark .notification-time {
    color: #a0aec0;
  }

  .dark .notification-empty {
    color: #a0aec0;
  }

  .dark .notification-header {
    border-bottom-color: #4a5568;
  }
`

// Modern Navbar Component
export const Navbar = () => {
  // Local state for notifications and dropdown toggling
  const [notifications, setNotifications] = useState([])
  const [loadingNotifications, setLoadingNotifications] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  // Refs for dropdown elements
  const notificationDropdownRef = useRef(null)
  const userDropdownRef = useRef(null)

  // Inject dropdown styles on mount
  useEffect(() => {
    const styleElement = document.createElement("style")
    styleElement.innerHTML = dropdownStyles
    document.head.appendChild(styleElement)
    return () => {
      document.head.removeChild(styleElement)
    }
  }, [])

  // Simulate fetching notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoadingNotifications(true)
        // Simulate API call with timeout
        setTimeout(() => {
          setNotifications([
            {
              _id: "1",
              type: "message",
              message: "Sarah sent you a message",
              read: false,
              createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
              data: { conversationId: "123" },
            },
            {
              _id: "2",
              type: "like",
              message: "Michael liked your profile",
              read: false,
              createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
              data: { userId: "456" },
            },
            {
              _id: "3",
              type: "match",
              message: "You matched with Jessica!",
              read: true,
              createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
              data: { userId: "789" },
            },
          ])
          setLoadingNotifications(false)
        }, 1000)
      } catch (error) {
        console.error("Failed to fetch notifications:", error)
        toast.error("Could not load notifications")
        setLoadingNotifications(false)
      }
    }
    fetchNotifications()

    // Simulate receiving a new notification after 10 seconds
    const timer = setTimeout(() => {
      const newNotification = {
        _id: "4",
        type: "like",
        message: "David liked your photo",
        read: false,
        createdAt: new Date().toISOString(),
        data: { userId: "101" },
      }
      setNotifications(prev => [newNotification, ...prev])
      toast.info(newNotification.message)
    }, 10000)

    return () => clearTimeout(timer)
  }, [])

  // Update unread count when notifications change
  useEffect(() => {
    const count = notifications.filter(n => !n.read).length
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

  // Toggle notification dropdown using ref
  const toggleNotificationDropdown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (notificationDropdownRef.current) {
      notificationDropdownRef.current.classList.toggle("show")
    }
    // Close user dropdown if open
    if (userDropdownRef.current && userDropdownRef.current.classList.contains("show")) {
      userDropdownRef.current.classList.remove("show")
    }
  }

  // Toggle user dropdown using ref
  const toggleUserDropdown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (userDropdownRef.current) {
      userDropdownRef.current.classList.toggle("show")
    }
    // Close notification dropdown if open
    if (notificationDropdownRef.current && notificationDropdownRef.current.classList.contains("show")) {
      notificationDropdownRef.current.classList.remove("show")
    }
  }

  // Close dropdowns if clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(event.target)) {
        notificationDropdownRef.current.classList.remove("show")
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        userDropdownRef.current.classList.remove("show")
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
        setNotifications(prev =>
          prev.map(n => (n._id === notification._id ? { ...n, read: true } : n))
        )
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
    if (notificationDropdownRef.current) {
      notificationDropdownRef.current.classList.remove("show")
    }
  }

  const markAllAsRead = (e) => {
    e.stopPropagation()
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    toast.success("All notifications marked as read")
  }

  // Return appropriate icon for notification type
  const getNotificationIcon = (type) => {
    switch (type) {
      case "message":
        return <FaEnvelope />
      case "like":
        return <FaHeart />
      case "comment":
        return <FaComment />
      case "match":
        return <FaHeart />
      default:
        return <FaBell />
    }
  }

  // Format time to relative string (e.g., "5 minutes ago")
  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)

    if (diffSec < 60) return "just now"
    if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? "s" : ""} ago`
    if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? "s" : ""} ago`
    if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`
    return date.toLocaleDateString()
  }

  // Render notifications list
  const renderNotifications = () => {
    if (loadingNotifications) {
      return (
        <div className="flex justify-center p-4 text-center py-4">
          <div className="spinner"></div>
          <p className="mt-2">Loading notifications...</p>
        </div>
      )
    }
    if (notifications.length === 0) {
      return <div className="notification-empty">No notifications yet</div>
    }
    return notifications.map(notification => (
      <div
        key={notification._id}
        className={`notification-item ${!notification.read ? "unread" : ""}`}
        onClick={() => handleNotificationClick(notification)}
      >
        <div className={`notification-icon ${notification.type}`}>
          {getNotificationIcon(notification.type)}
        </div>
        <div className="notification-content">
          <div className="notification-title">{notification.message}</div>
          <div className="notification-time">{formatRelativeTime(notification.createdAt)}</div>
        </div>
      </div>
    ))
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
              <div className="dropdown" ref={notificationDropdownRef}>
                <button
                  className="header-action-button position-relative"
                  onClick={toggleNotificationDropdown}
                  aria-label="Notifications"
                  aria-expanded={notificationDropdownRef.current?.classList.contains("show") || false}
                  aria-haspopup="true"
                >
                  <FaBell />
                  {unreadCount > 0 && (
                    <span className="notification-badge" aria-label={`${unreadCount} unread notifications`}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
                <div id="notification-dropdown" className="dropdown-menu notification-dropdown" ref={notificationDropdownRef}>
                  <div className="notification-header">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <span className="mark-all-read" onClick={markAllAsRead}>
                        Mark all as read
                      </span>
                    )}
                  </div>
                  <div className="notification-list">{renderNotifications()}</div>
                </div>
              </div>
              <div className="user-avatar-dropdown">
                <div className="dropdown" ref={userDropdownRef}>
                  {user?.photos?.length > 0 ? (
                    <img
                      src={user.photos[0].url || "/placeholder.svg?height=32&width=32"}
                      alt={user.nickname}
                      className="user-avatar dropdown-toggle"
                      onClick={toggleUserDropdown}
                      aria-label="User menu"
                      aria-expanded={userDropdownRef.current?.classList.contains("show") || false}
                      aria-haspopup="true"
                    />
                  ) : (
                    <FaUserCircle
                      className="user-avatar dropdown-toggle"
                      style={{ fontSize: "32px" }}
                      onClick={toggleUserDropdown}
                      aria-label="User menu"
                      aria-expanded={userDropdownRef.current?.classList.contains("show") || false}
                      aria-haspopup="true"
                    />
                  )}
                  <div id="user-dropdown" className="dropdown-menu dropdown-menu-end" ref={userDropdownRef}>
                    <div className="dropdown-item" onClick={navigateToProfile}>
                      Profile
                    </div>
                    <div className="dropdown-item" onClick={() => navigate("/settings")}>
                      Settings
                    </div>
                    <div className="dropdown-divider"></div>
                    <div className="dropdown-item text-danger" onClick={handleLogout}>
                      Logout
                    </div>
                  </div>
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
