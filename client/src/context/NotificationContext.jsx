"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useAuth } from "./AuthContext"
import notificationService from "../services/notificationService"
import socketService from "../services/socketService" // Import socket service directly
import { toast } from "react-toastify"
import { useNavigate } from "react-router-dom" // Keep navigate for opening messages page
import { FaHeart } from "react-icons/fa"

// Create context
const NotificationContext = createContext()

// Accept openProfileModal prop
export const NotificationProvider = ({ children, openProfileModal }) => {
  const { isAuthenticated, user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const navigate = useNavigate() // Use navigate for message clicks

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

  // Initialize the navigation function for notifications (still useful for the service)
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
      const isNew = false // Adjust this logic if needed

      if (isNew) {
        // Determine notification message
        const message = data.message || data.content || data.title || "New notification"

        // Show toast
        toast.info(message, {
          // NOTE: Decide how toast clicks should behave
          // Example: Open modal/navigate based on type
          onClick: () => handleNotificationClick(data),
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
      socketService.socket.on("newMessage", handleNewNotification) // Important for message notifications
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, fetchNotifications]) // Dependencies updated

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
        // Double-check if socket is actually still disconnected
        if (socketService.socket && !socketService.isConnected()) {
          console.log("Socket still disconnected - polling for new notifications")
          await fetchNotifications()

          // Try to trigger socket reconnection
          try {
            if (socketService.reconnectAttempts < socketService.maxReconnectAttempts) {
              console.log("Attempting to reconnect socket during polling cycle")
              socketService.reconnect()
            }
          } catch (err) {
            console.error("Error attempting reconnect during polling:", err)
          }
        } else if (socketService.isConnected()) {
          // Socket is connected according to the service, but our state doesn't match
          console.log("Socket appears to be reconnected but state hasn't updated")
          setSocketConnected(true)
        }
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
    // Check if already marked as read to avoid redundant calls/state updates
    const notification = notifications.find(n => (n._id === notificationId) || (n.id === notificationId));
    if (notification && notification.read) {
        // console.log(`Notification ${notificationId} already marked as read.`);
        return; // Already read, do nothing
    }

    // Call the service first
    notificationService.markAsRead(notificationId)

    // Update local state immediately if it exists and is unread
    setNotifications((prev) =>
        prev.map((n) => {
            if (((n._id && n._id === notificationId) || (n.id && n.id === notificationId)) && !n.read) {
                return { ...n, read: true }
            }
            return n
        }),
    )

    // Update unread count only if we actually marked one as read
    if (notification && !notification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
    }
  }

  // Mark all notifications as read
  const markAllAsRead = () => {
    // Check if there are any unread notifications first
    const hasUnread = notifications.some(n => !n.read);
    if (!hasUnread) {
        // console.log("No unread notifications to mark.");
        return; // Nothing to do
    }

    // Call the service first
    notificationService.markAllAsRead()

    // Update local state immediately
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  // --- Modify handleNotificationClick ---
  const handleNotificationClick = (notification) => {
    if (!notification) return;
    console.log("Handling notification click in context:", notification);

    const notificationId = notification._id || notification.id;

    // Mark as read locally first for instant feedback (only if not already read)
    if (!notification.read && notificationId) {
      markAsRead(notificationId); // Calls service and updates state/count
    }

    // --- Logic to Determine Action based on Type ---
    const notificationType = notification.type;
    let relevantUserId = null;

    // Extract potential user IDs (add more as needed)
    if (notification.sender?._id) {
        relevantUserId = notification.sender._id;
    } else if (notification.data?.sender?._id) {
        relevantUserId = notification.data.sender._id;
    } else if (notification.data?.requester?._id) {
        relevantUserId = notification.data.requester._id;
    } else if (notification.data?.user?._id) {
        relevantUserId = notification.data.user._id;
    } else if (notification.data?.owner?._id) {
         relevantUserId = notification.data.owner._id;
    } else if (notification.type === 'match' && notification.data?.matchedUser?._id) {
        relevantUserId = notification.data.matchedUser._id;
    } else if (notification.type === 'comment' && notification.data?.commenter?._id) {
        relevantUserId = notification.data.commenter._id;
    }

    console.log(`Notification Type: ${notificationType}, Relevant User ID: ${relevantUserId}`);

    // --- Conditional Action ---
    if (notificationType === 'message' || notificationType === 'newMessage') {
        // Navigate to messages page, selecting the chat with the sender
        if (relevantUserId) {
            console.log(`Navigating to messages for user: ${relevantUserId}`);
            navigate(`/messages/${relevantUserId}`);
        } else {
            console.warn("Could not determine sender ID for message notification:", notification);
            navigate('/messages'); // Navigate to general messages page as fallback
        }
    } else if (relevantUserId && typeof openProfileModal === 'function') {
        // Open profile modal for other notification types (like, match, comment, etc.)
        console.log(`Opening profile modal for user: ${relevantUserId}`);
        openProfileModal(relevantUserId);
    } else {
        // Fallback or error handling if no user ID found or function not available
        console.warn("Could not determine action or relevant user ID for notification:", notification);
        // Optionally, you could call the original service handler as a fallback:
        // notificationService.handleNotificationClick(notification);
        // toast.error("Could not process notification click.");
    }
    // --- End Conditional Action ---
  }
  // --- End Modify handleNotificationClick ---


  // Refresh notifications manually
  const refreshNotifications = async () => {
    await fetchNotifications()
  }

  const addNotification = (notification) => {
     // Check for duplicates before adding
    const exists = notifications.some(n => (n._id && notification._id && n._id === notification._id) || (n.id && notification.id && n.id === notification.id));
    if (!exists) {
        setNotifications((prev) => [notification, ...prev]);
        if (!notification.read) {
            setUnreadCount((prev) => prev + 1);
        }
    }
  }

  // Handle "newLike" socket event
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
        sender: data.sender, // Ensure sender info is included
        data: data, // Include original data if needed for click handling
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
    [addNotification], // Ensure addNotification is stable or memoized if necessary
  )

  // Add listener for newLike event
  useEffect(() => {
    if (!socketService.socket || !isAuthenticated) return

    socketService.socket.on("newLike", handleNewLike)

    return () => {
      if (socketService.socket) {
        socketService.socket.off("newLike", handleNewLike)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        handleNotificationClick, // Use the modified handler
        refreshNotifications,
        // Expose modal controls if needed elsewhere (optional)
        // openProfileModal,
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
