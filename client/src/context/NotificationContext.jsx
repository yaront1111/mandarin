"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useAuth } from "./AuthContext"
import notificationService from "../services/notificationService"
import socketService from "../services/socketService" // Import socket service directly
import { toast } from "react-toastify"
import { useNavigate } from "react-router-dom"
import { FaHeart } from "react-icons/fa"

// Create context
const NotificationContext = createContext()

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const navigate = useNavigate()

  // Define callback to fetch notifications to avoid recreation on every render
  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true)
      console.log("Fetching notifications from server")
      const fetchedNotifications = await notificationService.getNotifications()
      console.log(`Fetched ${fetchedNotifications.length} notifications`)
      setNotifications(fetchedNotifications)
      setUnreadCount(fetchedNotifications.filter((n) => !n.read).length)
      return fetchedNotifications
    } catch (error) {
      console.error("Error fetching notifications:", error)
      // Initialize with empty array to prevent undefined errors
      return []
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initialize the navigation function for notifications
  useEffect(() => {
    if (navigate) {
      // Pass the navigate function to the notification service
      notificationService.setNavigate(navigate)
      console.log("NotificationService navigation initialized")
    }
  }, [navigate])

  // Set up direct socket event listener for new notifications
  useEffect(() => {
    if (!isAuthenticated || !user) return

    // Setup direct socket listeners for notification events
    const handleNewNotification = (data) => {
      console.log("New notification received via socket:", data)

      // Update state with the new notification
      setNotifications((prev) => {
        // Check if this notification already exists (avoid duplicates)
        const exists = prev.some(
          (n) => (n._id && data._id && n._id === data._id) || (n.id && data.id && n.id === data.id),
        )

        if (exists) {
          return prev
        }

        // Add new notification at the beginning of the array
        const updated = [data, ...prev]
        console.log("Updated notifications state with new notification")
        return updated
      })

      // Increment unread count
      if (!data.read) {
        setUnreadCount((prev) => prev + 1)
      }

      // Show toast notification if it's new
      const isNew = data.createdAt && new Date().getTime() - new Date(data.createdAt).getTime() < 60000

      if (isNew) {
        // Determine notification message
        const message = data.message || data.content || data.title || "New notification"

        // Show toast
        toast.info(message, {
          onClick: () => notificationService.handleNotificationClick(data),
        })
      }
    }

    // Setup socket connection status listener
    const handleSocketConnect = () => {
      console.log("Socket connected - enabling real-time notifications")
      setSocketConnected(true)

      // Refresh notifications when socket connects
      fetchNotifications()
    }

    const handleSocketDisconnect = () => {
      console.log("Socket disconnected - real-time notifications paused")
      setSocketConnected(false)
    }

    // Register direct socket listeners
    if (socketService.socket) {
      console.log("Setting up direct socket listeners for notifications")

      // Listen for specific notification events
      socketService.socket.on("notification", handleNewNotification)
      socketService.socket.on("newMessage", handleNewNotification)
      socketService.socket.on("newLike", handleNewNotification)
      socketService.socket.on("photoPermissionRequestReceived", handleNewNotification)
      socketService.socket.on("photoPermissionResponseReceived", handleNewNotification)
      socketService.socket.on("newComment", handleNewNotification)
      socketService.socket.on("incomingCall", handleNewNotification)

      // Connection status events
      socketService.socket.on("connect", handleSocketConnect)
      socketService.socket.on("disconnect", handleSocketDisconnect)

      // Check current connection status
      setSocketConnected(socketService.isConnected())
    }

    // Cleanup socket listeners on unmount
    return () => {
      if (socketService.socket) {
        socketService.socket.off("notification", handleNewNotification)
        socketService.socket.off("newMessage", handleNewNotification)
        socketService.socket.off("newLike", handleNewNotification)
        socketService.socket.off("photoPermissionRequestReceived", handleNewNotification)
        socketService.socket.off("photoPermissionResponseReceived", handleNewNotification)
        socketService.socket.off("newComment", handleNewNotification)
        socketService.socket.off("incomingCall", handleNewNotification)
        socketService.socket.off("connect", handleSocketConnect)
        socketService.socket.off("disconnect", handleSocketDisconnect)
      }
    }
  }, [isAuthenticated, user, fetchNotifications])

  // Initialize notification service when user is authenticated
  useEffect(() => {
    let notificationListener = null

    const initializeNotifications = async () => {
      if (isAuthenticated && user) {
        setIsLoading(true)
        console.log("Initializing notification service")

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

        // Add listener for notification updates from the service
        notificationListener = notificationService.addListener((data) => {
          if (data && data.notifications) {
            setNotifications(data.notifications)
            setUnreadCount(data.unreadCount)
            console.log("Notifications updated through service listener")
          }
        })

        // Fetch initial notifications
        await fetchNotifications()

        // Register socket listeners specifically for notification service
        if (notificationService.initialized) {
          notificationService.registerSocketListeners()
        }
      } else {
        // Reset state when user logs out
        setNotifications([])
        setUnreadCount(0)
      }
    }

    // Initialize notifications
    initializeNotifications()

    // Cleanup function
    return () => {
      if (notificationListener) {
        notificationListener()
      }
    }
  }, [isAuthenticated, user, fetchNotifications])

  // Set up polling for notifications as a fallback for socket issues
  useEffect(() => {
    if (!isAuthenticated || !user) return

    const pollInterval = 30000 // 30 seconds polling interval

    // Only poll if the socket is disconnected
    if (!socketConnected) {
      console.log("Socket disconnected, setting up polling for notifications")

      const pollingTimer = setInterval(async () => {
        console.log("Polling for new notifications")
        await fetchNotifications()
      }, pollInterval)

      return () => clearInterval(pollingTimer)
    }
  }, [isAuthenticated, user, socketConnected, fetchNotifications])

  // Add a test notification (for development/testing)
  const addTestNotification = () => {
    const newNotification = notificationService.addTestNotification()

    // Also update our local state immediately
    setNotifications((prev) => [newNotification, ...prev])
    setUnreadCount((prev) => prev + 1)

    toast.info(`Added test ${newNotification.type} notification`)
  }

  // Mark a notification as read
  const markAsRead = (notificationId) => {
    notificationService.markAsRead(notificationId)

    // Update local state immediately
    setNotifications((prev) =>
      prev.map((n) => {
        if ((n._id && n._id === notificationId) || (n.id && n.id === notificationId)) {
          return { ...n, read: true }
        }
        return n
      }),
    )

    // Update unread count
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  // Mark all notifications as read
  const markAllAsRead = () => {
    notificationService.markAllAsRead()

    // Update local state immediately
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  // Handle notification click
  const handleNotificationClick = (notification) => {
    // Mark as read in our local state first for instant feedback
    if (notification && !notification.read) {
      const notificationId = notification._id || notification.id
      if (notificationId) {
        markAsRead(notificationId)
      }
    }

    // Then handle the click in the service
    notificationService.handleNotificationClick(notification)
  }

  // Refresh notifications manually
  const refreshNotifications = async () => {
    await fetchNotifications()
  }

  const addNotification = (notification) => {
    setNotifications((prev) => [notification, ...prev])
    setUnreadCount((prev) => prev + 1)
  }

  // Add this to your socket event listeners in NotificationContext.jsx
  // This ensures the "newLike" event is properly handled

  const handleNewLike = useCallback(
    (data) => {
      if (!data) return

      console.log("Received like notification:", data)

      // Create a notification object from the like data
      const notification = {
        _id: data._id || `like-${Date.now()}`,
        type: data.isMatch ? "match" : "like",
        title: data.isMatch
          ? `You have a match with ${data.sender?.nickname || "Someone"}!`
          : `${data.sender?.nickname || "Someone"} liked you`,
        message: data.isMatch
          ? "You both liked each other. Start a conversation now!"
          : "Someone has shown interest in your profile",
        sender: data.sender,
        createdAt: data.timestamp || new Date().toISOString(),
        read: false,
      }

      // Add the notification to the state
      addNotification(notification)

      // Show a toast notification
      toast.success(
        <div className="notification-toast">
          <div className="notification-icon">
            <FaHeart className={data.isMatch ? "match-icon pulse" : "like-icon pulse"} />
          </div>
          <div className="notification-content">
            <div className="notification-title">{notification.title}</div>
            <div className="notification-message">{notification.message}</div>
          </div>
        </div>,
        { autoClose: 5000 },
      )
    },
    [addNotification],
  )

  useEffect(() => {
    if (!socketService.socket || !isAuthenticated) return

    socketService.socket.on("newLike", handleNewLike)

    return () => {
      if (socketService.socket) {
        socketService.socket.off("newLike", handleNewLike)
      }
    }
  }, [socketService.socket, isAuthenticated, handleNewLike])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        socketConnected,
        addTestNotification,
        markAsRead,
        markAllAsRead,
        handleNotificationClick,
        refreshNotifications,
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
