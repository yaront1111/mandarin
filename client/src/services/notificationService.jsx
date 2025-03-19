// client/src/services/notificationService.jsx
import apiService from "./apiService.jsx"
import { toast } from "react-toastify"
import socketService from "./socketService.jsx"

class NotificationService {
  constructor() {
    this.notifications = []
    this.unreadCount = 0
    this.initialized = false
    this.userSettings = null
    this.listeners = []
  }

  /**
   * Initialize notification service with user settings
   * @param {Object} userSettings - User notification settings
   */
  initialize(userSettings) {
    this.userSettings = userSettings || {
      notifications: {
        messages: true,
        calls: true,
        stories: true,
        likes: true,
        comments: true,
      },
    }

    this.initialized = true

    // Register socket listeners for notifications
    this.registerSocketListeners()

    // Fetch existing notifications
    this.getNotifications()
  }

  /**
   * Register socket event listeners for notifications
   */
  registerSocketListeners() {
    // Make sure socket service is available
    if (!socketService.socket) return

    // Listen for new message notifications
    socketService.socket.on("new_message", (data) => {
      if (this.shouldShowNotification("messages")) {
        this.addNotification({
          type: "message",
          title: `New message from ${data.sender.nickname}`,
          message: data.content,
          time: "Just now",
          read: false,
          data: data,
        })
      }
    })

    // Listen for incoming call notifications
    socketService.socket.on("incoming_call", (data) => {
      if (this.shouldShowNotification("calls")) {
        this.addNotification({
          type: "call",
          title: `Incoming call from ${data.caller.nickname}`,
          message: "Click to answer",
          time: "Just now",
          read: false,
          data: data,
        })
      }
    })

    // Listen for new story notifications
    socketService.socket.on("new_story", (data) => {
      if (this.shouldShowNotification("stories")) {
        this.addNotification({
          type: "story",
          title: `New story from ${data.creator.nickname}`,
          message: "Click to view",
          time: "Just now",
          read: false,
          data: data,
        })
      }
    })

    // Listen for like notifications
    socketService.socket.on("new_like", (data) => {
      if (this.shouldShowNotification("likes")) {
        this.addNotification({
          type: "like",
          title: `${data.sender.nickname} liked your ${data.contentType}`,
          message: "Click to view",
          time: "Just now",
          read: false,
          data: data,
        })
      }
    })

    // Listen for comment notifications
    socketService.socket.on("new_comment", (data) => {
      if (this.shouldShowNotification("comments")) {
        this.addNotification({
          type: "comment",
          title: `${data.commenter.nickname} commented on your ${data.contentType}`,
          message: data.comment.substring(0, 50) + (data.comment.length > 50 ? "..." : ""),
          time: "Just now",
          read: false,
          data: data,
        })
      }
    })
  }

  /**
   * Check if notification should be shown based on user settings
   * @param {string} notificationType - Type of notification
   * @returns {boolean} - Whether notification should be shown
   */
  shouldShowNotification(notificationType) {
    // If not initialized or no settings, default to showing
    if (!this.initialized || !this.userSettings) return true

    // Check if this notification type is enabled in user settings
    return this.userSettings.notifications?.[notificationType] !== false
  }

  /**
   * Add a notification to the list
   * @param {Object} notification - Notification data
   */
  addNotification(notification) {
    // Generate ID if not provided
    if (!notification.id) {
      notification.id = Date.now().toString()
    }

    // Add to notifications list
    this.notifications.unshift(notification)
    this.unreadCount++

    // Show toast notification
    this.showToast(notification)

    // Notify listeners
    this.notifyListeners()

    // Dispatch event for UI updates
    window.dispatchEvent(
      new CustomEvent("newNotification", {
        detail: notification,
      }),
    )
  }

  /**
   * Show a toast notification
   * @param {Object} notification - Notification data
   */
  showToast(notification) {
    const toastOptions = {
      onClick: () => this.handleNotificationClick(notification),
      autoClose: 5000,
      className: `notification-toast notification-${notification.type}`,
      position: "top-right",
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    }

    toast(
      <div className="notification-content">
        <div className="notification-title">{notification.title}</div>
        <div className="notification-message">{notification.message}</div>
      </div>,
      toastOptions,
    )
  }

  /**
   * Handle notification click
   * @param {Object} notification - Clicked notification
   */
  handleNotificationClick(notification) {
    // Mark as read
    this.markAsRead(notification.id)

    // Dispatch event for UI to handle navigation
    window.dispatchEvent(
      new CustomEvent("notificationClicked", {
        detail: notification,
      }),
    )

    // Close any open notification dropdowns
    document.querySelectorAll(".notification-dropdown").forEach((dropdown) => {
      dropdown.style.display = "none"
    })
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - ID of notification to mark as read
   */
  markAsRead(notificationId) {
    const index = this.notifications.findIndex((n) => n.id === notificationId)
    if (index !== -1 && !this.notifications[index].read) {
      this.notifications[index].read = true
      this.unreadCount = Math.max(0, this.unreadCount - 1)

      // Update backend
      apiService.put(`/notifications/${notificationId}/read`).catch((err) => {
        console.error("Error marking notification as read:", err)
      })

      // Notify listeners
      this.notifyListeners()
    }
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead() {
    if (this.notifications.length === 0) return

    // Mark all as read locally
    this.notifications = this.notifications.map((notification) => ({
      ...notification,
      read: true,
    }))

    this.unreadCount = 0

    // Update backend
    apiService.post("/notifications/mark-all-read").catch((err) => {
      console.error("Error marking all notifications as read:", err)
    })

    // Notify listeners
    this.notifyListeners()
  }

  /**
   * Get all notifications
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Notifications
   */
  async getNotifications(options = {}) {
    try {
      const response = await apiService.get("/notifications", options)
      if (response.success) {
        this.notifications = response.data
        this.unreadCount = this.notifications.filter((n) => !n.read).length

        // Notify listeners
        this.notifyListeners()

        return this.notifications
      }
      return []
    } catch (error) {
      console.error("Error fetching notifications:", error)
      return []
    }
  }

  /**
   * Update notification settings
   * @param {Object} settings - New notification settings
   */
  updateSettings(settings) {
    this.userSettings = {
      ...this.userSettings,
      notifications: settings,
    }
  }

  /**
   * Add a listener for notification updates
   * @param {Function} listener - Callback function
   * @returns {Function} - Function to remove the listener
   */
  addListener(listener) {
    this.listeners.push(listener)

    // Return function to remove listener
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  /**
   * Notify all listeners of changes
   */
  notifyListeners() {
    const data = {
      notifications: this.notifications,
      unreadCount: this.unreadCount,
    }

    this.listeners.forEach((listener) => {
      try {
        listener(data)
      } catch (err) {
        console.error("Error in notification listener:", err)
      }
    })
  }
}

// Create and export singleton instance
const notificationService = new NotificationService()
export default notificationService
