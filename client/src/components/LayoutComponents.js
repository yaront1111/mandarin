"use client"

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

// Add dropdown menu styles
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

// Sample notifications data (replace with real data from your API)
const sampleNotifications = [
  {
    id: 1,
    type: "message",
    title: "New message from Sarah",
    message: "Hey, how are you doing?",
    time: "5 minutes ago",
    read: false,
    data: { senderId: "123" },
  },
  {
    id: 2,
    type: "like",
    title: "Michael liked your photo",
    message: "Your profile picture received a like",
    time: "1 hour ago",
    read: false,
    data: { userId: "456", contentType: "photo" },
  },
  {
    id: 3,
    type: "comment",
    title: "Jessica commented on your post",
    message: "That's awesome! Congrats!",
    time: "3 hours ago",
    read: true,
    data: { userId: "789", contentType: "post", contentId: "101" },
  },
  {
    id: 4,
    type: "story",
    title: "David added a new story",
    message: "Check out David's latest update",
    time: "Yesterday",
    read: true,
    data: { userId: "234", storyId: "567" },
  },
]

// Modern Navbar Component
export const Navbar = () => {
  const [notifications, setNotifications] = useState(sampleNotifications)
  const [unreadCount, setUnreadCount] = useState(0)
  const notificationDropdownRef = useRef(null)
  const userDropdownRef = useRef(null)

  // Add the styles to the document
  useEffect(() => {
    const styleElement = document.createElement("style")
    styleElement.innerHTML = dropdownStyles
    document.head.appendChild(styleElement)

    return () => {
      document.head.removeChild(styleElement)
    }
  }, [])

  // Calculate unread notifications count
  useEffect(() => {
    const count = notifications.filter((notification) => !notification.read).length
    setUnreadCount(count)
  }, [notifications])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(event.target)) {
        const dropdown = document.getElementById("notification-dropdown")
        if (dropdown && dropdown.classList.contains("show")) {
          dropdown.classList.remove("show")
        }
      }

      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        const dropdown = document.getElementById("user-dropdown")
        if (dropdown && dropdown.classList.contains("show")) {
          dropdown.classList.remove("show")
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Listen for new notifications (replace with your actual socket or event listener)
  useEffect(() => {
    const handleNewNotification = (notification) => {
      setNotifications((prev) => [notification, ...prev])
    }

    // Example: Listen for custom event (replace with your actual implementation)
    window.addEventListener("newNotification", (e) => handleNewNotification(e.detail))

    return () => {
      window.removeEventListener("newNotification", (e) => handleNewNotification(e.detail))
    }
  }, [])

  const { isAuthenticated, logout, user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async (e) => {
    e.preventDefault()
    await logout()
  }

  const navigateToProfile = () => {
    navigate("/profile")
  }

  const toggleNotificationDropdown = () => {
    document.getElementById("notification-dropdown").classList.toggle("show")
  }

  const toggleUserDropdown = () => {
    document.getElementById("user-dropdown").classList.toggle("show")
  }

  const handleNotificationClick = (notification) => {
    // Mark as read
    setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)))

    // Navigate based on notification type
    switch (notification.type) {
      case "message":
        navigate(`/user/${notification.data.senderId}`)
        break
      case "like":
      case "comment":
        if (notification.data.contentType === "photo") {
          navigate(`/profile`)
        } else if (notification.data.contentType === "post") {
          navigate(`/post/${notification.data.contentId}`)
        }
        break
      case "story":
        // Dispatch event to open story viewer
        window.dispatchEvent(
          new CustomEvent("openStory", {
            detail: { storyId: notification.data.storyId },
          }),
        )
        break
      default:
        break
    }

    // Close dropdown
    document.getElementById("notification-dropdown").classList.remove("show")
  }

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
  }

  // Get notification icon based on type
  const getNotificationIcon = (type) => {
    switch (type) {
      case "message":
        return <FaEnvelope />
      case "like":
        return <FaHeart />
      case "comment":
        return <FaComment />
      case "story":
        return <FaBell />
      default:
        return <FaBell />
    }
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
                <button className="header-action-button position-relative" onClick={toggleNotificationDropdown}>
                  <FaBell />
                  {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
                  )}
                </button>
                <div id="notification-dropdown" className="dropdown-menu notification-dropdown">
                  <div className="notification-header">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <span className="mark-all-read" onClick={markAllAsRead}>
                        Mark all as read
                      </span>
                    )}
                  </div>
                  {notifications.length > 0 ? (
                    <div className="notification-list">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`notification-item ${notification.read ? "" : "unread"}`}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className={`notification-icon ${notification.type}`}>
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="notification-content">
                            <div className="notification-title">{notification.title}</div>
                            <div className="notification-message">{notification.message}</div>
                            <div className="notification-time">{notification.time}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="notification-empty">
                      <p>No notifications yet</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="user-avatar-dropdown">
                <div className="dropdown" ref={userDropdownRef}>
                  {user?.photos?.length > 0 ? (
                    <img
                      src={user.photos[0].url || "/placeholder.svg"}
                      alt={user.nickname}
                      className="user-avatar dropdown-toggle"
                      onClick={toggleUserDropdown}
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    />
                  ) : (
                    <FaUserCircle
                      className="user-avatar dropdown-toggle"
                      style={{ fontSize: "32px" }}
                      onClick={toggleUserDropdown}
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    />
                  )}
                  <div id="user-dropdown" className="dropdown-menu dropdown-menu-end">
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
