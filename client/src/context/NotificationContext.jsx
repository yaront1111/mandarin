"use client"

import { createContext, useContext, useState, useEffect } from "react"
import { useAuth } from "./AuthContext"
import notificationService from "../services/notificationService"
import { toast } from "react-toastify"
import { useNavigate } from "react-router-dom"

// Create context
const NotificationContext = createContext()

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  // Initialize the navigation function for notifications directly
  useEffect(() => {
    // Pass the navigate function to the notification service
    notificationService.setNavigate(navigate)
    console.log("NotificationService navigation initialized")

    // Re-register socket listeners in case they were lost
    if (notificationService.initialized) {
      notificationService.registerSocketListeners()
    }

    // Set up listener for socket reconnection events
    const handleSocketReconnect = () => {
      console.log("Socket reconnected - reinitializing notification listeners")
      if (notificationService.initialized) {
        notificationService.registerSocketListeners()
      }
    }

    window.addEventListener('socketReconnected', handleSocketReconnect)

    return () => {
      window.removeEventListener('socketReconnected', handleSocketReconnect)
    }
  }, [navigate]);

  // Initialize notification service when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      setIsLoading(true)

      // Get user notification settings from user object or use defaults
      const userSettings = user.settings || {
        notifications: {
          messages: true,
          calls: true,
          stories: true,
          likes: true,
          comments: true,
          photoRequests: true,
        },
      }

      // Initialize notification service
      notificationService.initialize(userSettings)

      // Add listener for notification updates
      const removeListener = notificationService.addListener((data) => {
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount)
      })

      // Fetch initial notifications
      notificationService
        .getNotifications()
        .then((fetchedNotifications) => {
          setNotifications(fetchedNotifications)
          setUnreadCount(fetchedNotifications.filter((n) => !n.read).length)
          setIsLoading(false)
        })
        .catch((error) => {
          console.error("Error fetching notifications:", error)
          setIsLoading(false)
          // Initialize with empty array to prevent undefined errors
          setNotifications([])
        })

      // Clean up listener on unmount
      return () => {
        removeListener()
        // Don't call notificationService.cleanup() here to avoid breaking other components
        // that might still be using the service
      }
    } else {
      // Reset state when user logs out
      setNotifications([])
      setUnreadCount(0)
    }
  }, [isAuthenticated, user])

  // Add a test notification (for development/testing)
  const addTestNotification = () => {
    const newNotification = notificationService.addTestNotification();
    toast.info(`Added test ${newNotification.type} notification`);
  }

  // Mark a notification as read
  const markAsRead = (notificationId) => {
    notificationService.markAsRead(notificationId);
  }

  // Mark all notifications as read
  const markAllAsRead = () => {
    notificationService.markAllAsRead();
  }

  // Handle notification click
  const handleNotificationClick = (notification) => {
    notificationService.handleNotificationClick(notification);
  }

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        addTestNotification,
        markAsRead,
        markAllAsRead,
        handleNotificationClick,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

// Custom hook to use the notification context
export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider")
  }
  return context
}

export default NotificationProvider
