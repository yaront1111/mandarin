"use client"

import { createContext, useContext, useState, useEffect } from "react"
import { useAuth } from "./AuthContext"
import notificationService from "../services/notificationService"
import { toast } from "react-toastify"

// Create context
const NotificationContext = createContext()

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

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
        })

      // Clean up listener on unmount
      return () => {
        removeListener()
      }
    } else {
      // Reset state when user logs out
      setNotifications([])
      setUnreadCount(0)
    }
  }, [isAuthenticated, user])

  // Add a test notification (for development/testing)
  const addTestNotification = () => {
    const newNotification = {
      id: Date.now().toString(),
      type: "message",
      title: "Test Notification",
      message: "This is a test notification",
      time: "Just now",
      read: false,
      data: { conversationId: "test" },
      createdAt: new Date().toISOString(),
    }

    notificationService.addNotification(newNotification)
    toast.info("Test notification added")
  }

  // Mark a notification as read
  const markAsRead = (notificationId) => {
    notificationService.markAsRead(notificationId)
  }

  // Mark all notifications as read
  const markAllAsRead = () => {
    notificationService.markAllAsRead()
  }

  // Handle notification click
  const handleNotificationClick = (notification) => {
    notificationService.handleNotificationClick(notification)
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
