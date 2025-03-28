// client/src/services/notificationService.jsx
import apiService from "./apiService.jsx";
import { toast } from "react-toastify";
import socketService from "./socketService.jsx";
import { useEffect } from 'react';
import { useNavigate } from "react-router-dom";

/**
 * Enhanced Notification Service
 *
 * Features:
 * - Automatic bundling of notifications from the same sender within an hour
 * - Simplified socket event listeners
 * - Better error handling and logging
 * - Consistent API for adding, updating, and reading notifications
 * - Support for all notification types
 */
class NotificationService {
  constructor() {
    this.notifications = [];
    this.unreadCount = 0;
    this.initialized = false;
    this.userSettings = null;
    this.listeners = [];
    this.navigate = null;
    this.socketListeners = [];
    this.socketReconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimer = null;

    // Notification grouping timeframe (in milliseconds)
    this.bundleTimeframe = 60 * 60 * 1000; // 1 hour
  }

  /**
   * Set the navigation function for routing after notification clicks
   * @param {Function} navigateFunc - React Router's navigate function
   */
  setNavigate(navigateFunc) {
    if (typeof navigateFunc === 'function') {
      this.navigate = navigateFunc;
      console.log("Navigate function set successfully in NotificationService");
    } else {
      console.warn("Attempted to set invalid navigate function in NotificationService");
    }
  }

  /**
   * Initialize the notification service with user settings
   * @param {Object} userSettings - User notification preferences
   */
  initialize(userSettings) {
    if (this.initialized) {
      console.log("NotificationService already initialized");
      return;
    }

    this.userSettings = userSettings || {
      notifications: {
        messages: true,
        calls: true,
        stories: true,
        likes: true,
        comments: true,
        photoRequests: true,
      },
    };

    if (socketService.isConnected()) {
      this.registerSocketListeners();
    }

    this.initialized = true;
    this.getNotifications();
    console.log("NotificationService initialized successfully");
  }

  /**
   * Check socket connection status and register listeners if connected
   * @returns {boolean} - Connection status
   */
  checkSocketConnection() {
    if (socketService.isConnected()) {
      console.log("Socket is connected, registering notification listeners");
      this.registerSocketListeners();
      return true;
    } else {
      console.log("Socket is not connected, notification listeners not registered");
      return false;
    }
  }

  /**
   * Clean up socket listeners
   */
  cleanup() {
    if (this.socketListeners.length > 0) {
      console.log(`Cleaning up ${this.socketListeners.length} socket listeners`);
      this.socketListeners.forEach(removeListener => {
        if (typeof removeListener === 'function') {
          removeListener();
        }
      });
      this.socketListeners = [];
    }
  }

  /**
   * Register socket event listeners for different notification types
   */
  registerSocketListeners() {
    if (!socketService.isConnected()) {
      console.warn("NotificationService: Socket not connected. Cannot register listeners.");
      return;
    }

    // Clean up old listeners
    this.cleanup();

    // Define all notification types in one place for easier management
    const notificationTypes = [
      { event: "newMessage", type: "message", handler: this._handleMessageNotification.bind(this) },
      { event: "incomingCall", type: "call", handler: this._handleCallNotification.bind(this) },
      { event: "newStory", type: "story", handler: this._handleStoryNotification.bind(this) },
      { event: "newLike", type: "like", handler: this._handleLikeNotification.bind(this) },
      { event: "newComment", type: "comment", handler: this._handleCommentNotification.bind(this) },
      { event: "photoPermissionRequestReceived", type: "photoRequest", handler: this._handlePhotoRequestNotification.bind(this) },
      { event: "photoPermissionResponseReceived", type: "photoResponse", handler: this._handlePhotoResponseNotification.bind(this) },
      { event: "notification", type: "generic", handler: this._handleGenericNotification.bind(this) },
    ];

    // Register all listeners at once
    notificationTypes.forEach(({ event, handler }) => {
      const removeListener = socketService.on(event, handler);
      this.socketListeners.push(removeListener);
    });

    console.log(`Registered ${notificationTypes.length} socket notification listeners`);
  }

  /**
   * Handle message notifications
   * @param {Object} data - Message data
   */
  _handleMessageNotification(data) {
    if (this.shouldShowNotification("messages") && data) {
      const notification = {
        _id: data._id || `msg-${Date.now()}`,
        type: "message",
        title: `New message from ${data.sender?.nickname || "Someone"}`,
        message: data.content,
        time: "Just now",
        read: false,
        sender: data.sender,
        data: data,
        createdAt: data.createdAt || new Date().toISOString(),
      };

      this.addBundledNotification(notification);
    }
  }

  /**
   * Handle call notifications
   * @param {Object} data - Call data
   */
  _handleCallNotification(data) {
    if (this.shouldShowNotification("calls") && data) {
      const notification = {
        _id: data.callId || `call-${Date.now()}`,
        type: "call",
        title: `Incoming call from ${data.caller?.name || "Someone"}`,
        message: "Click to answer",
        time: "Just now",
        read: false,
        sender: {
          _id: data.caller?.userId,
          nickname: data.caller?.name || "Caller"
        },
        data: data,
        createdAt: new Date().toISOString(),
      };

      this.addBundledNotification(notification);
    }
  }

  /**
   * Handle story notifications
   * @param {Object} data - Story data
   */
  _handleStoryNotification(data) {
    if (this.shouldShowNotification("stories") && data) {
      const notification = {
        _id: data._id || `story-${Date.now()}`,
        type: "story",
        title: `${data.user?.nickname || "Someone"} shared a new story`,
        message: "Click to view",
        time: "Just now",
        read: false,
        sender: data.user,
        data: data,
        createdAt: data.createdAt || new Date().toISOString(),
      };

      this.addBundledNotification(notification);
    }
  }

  /**
   * Handle like notifications
   * @param {Object} data - Like data
   */
  _handleLikeNotification(data) {
    if (this.shouldShowNotification("likes") && data) {
      const notification = {
        _id: data.likeId || `like-${Date.now()}`,
        type: "like",
        title: `${data.sender?.nickname || "Someone"} liked you`,
        message: data.isMatch ? "You have a new match!" : "Click to view profile",
        time: "Just now",
        read: false,
        sender: data.sender,
        data: data,
        isMatch: data.isMatch,
        createdAt: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
      };

      this.addBundledNotification(notification);
    }
  }

  /**
   * Handle comment notifications
   * @param {Object} data - Comment data
   */
  _handleCommentNotification(data) {
    if (this.shouldShowNotification("comments") && data) {
      const notification = {
        _id: data._id || `comment-${Date.now()}`,
        type: "comment",
        title: `${data.user?.nickname || "Someone"} commented on your post`,
        message: data.content || "Click to view",
        time: "Just now",
        read: false,
        sender: data.user,
        data: data,
        createdAt: data.createdAt || new Date().toISOString(),
      };

      this.addBundledNotification(notification);
    }
  }

  /**
   * Handle photo request notifications
   * @param {Object} data - Photo request data
   */
  _handlePhotoRequestNotification(data) {
    if (this.shouldShowNotification("photoRequests") && data) {
      const requesterNickname = data.sender?.nickname || "Someone";
      const notification = {
        _id: data.permissionId || `permReq-${Date.now()}`,
        type: "photoRequest",
        title: `${requesterNickname} requested photo access`,
        message: "Click to review",
        time: "Just now",
        read: false,
        sender: data.sender,
        data: data,
        createdAt: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
      };

      this.addBundledNotification(notification);
    }
  }

  /**
   * Handle photo response notifications
   * @param {Object} data - Photo response data
   */
  _handlePhotoResponseNotification(data) {
    if (this.shouldShowNotification("photoRequests") && data) {
      const ownerNickname = data.sender?.nickname || "Someone";
      const action = data.status === "approved" ? "approved" : "rejected";
      const notification = {
        _id: data.permissionId || `permRes-${Date.now()}`,
        type: "photoResponse",
        title: `${ownerNickname} ${action} your request`,
        message: data.status === "approved" ? "You can now view their photo." : "Request declined.",
        time: "Just now",
        read: false,
        sender: data.sender,
        data: data,
        createdAt: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
      };

      this.addBundledNotification(notification);

      // Dispatch an event for components that need to update their UI
      window.dispatchEvent(new CustomEvent('permissionStatusUpdated', {
        detail: { photoId: data.photoId, status: data.status }
      }));
    }
  }

  /**
   * Handle generic notifications
   * @param {Object} data - Generic notification data
   */
  _handleGenericNotification(data) {
    if (data?.type && this.shouldShowNotification(data.type)) {
      this.addBundledNotification(data);
    }
  }

  /**
   * Check if a notification should be shown based on user settings
   * @param {string} notificationType - Type of notification
   * @returns {boolean} - Whether to show the notification
   */
  shouldShowNotification(notificationType) {
    if (!this.initialized || !this.userSettings) return true;

    // Special case for photo requests
    if (notificationType === "photoRequest" || notificationType === "photoResponse") {
      return this.userSettings.notifications?.photoRequests !== false;
    }

    return this.userSettings.notifications?.[notificationType] !== false;
  }

  /**
   * Validate a notification object
   * @param {Object} notification - Notification to validate
   * @returns {boolean} - Whether notification is valid
   */
  isValidNotification(notification) {
    if (!notification) return false;
    const hasId = notification._id || notification.id;
    const hasMessage = notification.message || notification.title || notification.content;
    const hasType = notification.type;
    return Boolean(hasId && hasMessage && hasType);
  }

  /**
   * Sanitize a notification to ensure it has all required fields
   * @param {Object} notification - Notification to sanitize
   * @returns {Object|null} - Sanitized notification or null
   */
  sanitizeNotification(notification) {
    if (!notification) return null;
    const sanitized = { ...notification };
    if (!sanitized._id && !sanitized.id) sanitized._id = `gen-${Date.now()}-${Math.random().toString(16).substring(2, 8)}`;
    if (!sanitized.message && sanitized.title) sanitized.message = sanitized.title;
    else if (!sanitized.message && !sanitized.title) sanitized.message = "New notification";
    if (!sanitized.type) sanitized.type = "system";
    if (!sanitized.createdAt) sanitized.createdAt = new Date().toISOString();
    if (sanitized.read === undefined) sanitized.read = false;
    if (!sanitized.time) sanitized.time = "Just now";
    return sanitized;
  }

  /**
   * Add a notification with bundling logic
   * @param {Object} notification - Notification to add
   * @returns {Object} - Added notification
   */
  addBundledNotification(notification) {
    const sanitizedNotification = this.sanitizeNotification(notification);
    if (!sanitizedNotification || !this.isValidNotification(sanitizedNotification)) {
      console.warn("Skipping invalid notification:", notification);
      return;
    }

    // Try to find a similar notification from the same sender within the bundling timeframe
    const now = new Date();
    const notificationDate = new Date(sanitizedNotification.createdAt);
    const senderId = sanitizedNotification.sender?._id ||
                    sanitizedNotification.sender?.id ||
                    sanitizedNotification.data?.sender?._id;

    if (senderId) {
      // Find notifications from the same sender and of the same type within the bundling timeframe
      const similarNotificationIndex = this.notifications.findIndex(n => {
        const nSenderId = n.sender?._id || n.sender?.id || n.data?.sender?._id;

        // If there's no sender ID match, it's not a similar notification
        if (nSenderId !== senderId) return false;

        // Check if it's the same type
        if (n.type !== sanitizedNotification.type) return false;

        // Check if it's within the bundling timeframe
        const nDate = new Date(n.createdAt);
        return (now - nDate < this.bundleTimeframe);
      });

      if (similarNotificationIndex !== -1) {
        // Update the existing notification with new content
        const existingNotification = this.notifications[similarNotificationIndex];
        const count = existingNotification.count || 1;

        // Update the notification
        this.notifications[similarNotificationIndex] = {
          ...existingNotification,
          count: count + 1,
          message: this._getBundledMessage(sanitizedNotification.type, count + 1, existingNotification.sender?.nickname),
          updatedAt: now.toISOString(),
          read: false // Mark as unread since there's new activity
        };

        // If it was previously read, increment the unread count
        if (existingNotification.read) {
          this.unreadCount++;
        }

        // Notify listeners
        this.notifyListeners();

        // Show toast for the bundled notification
        this.showToast(this.notifications[similarNotificationIndex]);

        return this.notifications[similarNotificationIndex];
      }
    }

    // If no similar notification found, add as a new notification
    sanitizedNotification.count = 1;

    // Add to beginning of array
    this.notifications.unshift(sanitizedNotification);

    // Update unread count
    if (!sanitizedNotification.read) {
      this.unreadCount++;
    }

    // Show toast notification
    this.showToast(sanitizedNotification);

    // Notify listeners
    this.notifyListeners();

    // Dispatch browser event for components not using the context
    window.dispatchEvent(new CustomEvent("newNotification", { detail: sanitizedNotification }));

    console.log(`Added notification: ${sanitizedNotification.type} - ${sanitizedNotification.title || sanitizedNotification.message}`);

    return sanitizedNotification;
  }

  /**
   * Generate a bundled message for multiple notifications of the same type
   * @param {string} type - Notification type
   * @param {number} count - Number of notifications
   * @param {string} nickname - Sender nickname
   * @returns {string} - Bundled message
   */
  _getBundledMessage(type, count, nickname) {
    switch (type) {
      case "message":
        return `${count} new messages from ${nickname || "this user"}`;
      case "like":
        return `${nickname || "Someone"} and ${count - 1} others liked you`;
      case "comment":
        return `${count} new comments on your post`;
      case "photoRequest":
        return `${count} photo access requests`;
      case "photoResponse":
        return `${count} responses to your photo requests`;
      case "story":
        return `${nickname || "Someone"} shared ${count} new stories`;
      default:
        return `${count} new notifications`;
    }
  }

  /**
   * Display a toast notification
   * @param {Object} notification - Notification to show
   */
  showToast(notification) {
    try {
      // Skip toast for certain notification types if needed
      // if (["someType"].includes(notification.type)) return;

      const toastOptions = {
        onClick: () => this.handleNotificationClick(notification),
        autoClose: 5000,
        closeButton: true,
        position: "top-right"
      };

      const title = notification.title || notification.message || "New Notification";
      const message = (notification.message && notification.message !== title) ? notification.message : "";
      const count = notification.count > 1 ? `(${notification.count})` : "";
      const displayTitle = count ? `${title} ${count}` : title;

      // Use different toast types based on notification type
      let toastMethod = toast.info;
      if (notification.type === "like" || notification.type === "match") {
        toastMethod = toast.success;
      } else if (notification.type === "photoRequest") {
        toastMethod = toast.info;
      } else if (notification.type === "photoResponse") {
        toastMethod = notification.data?.status === "approved" ? toast.success : toast.info;
      }

      toastMethod(
        <div className="notification-content">
          <div className="notification-title">{displayTitle}</div>
          {message && <div className="notification-message">{message}</div>}
        </div>,
        toastOptions
      );
    } catch (error) {
      console.error("Error showing notification toast:", error);
    }
  }

  /**
   * Add a notification
   * @param {Object} notification - Notification to add
   * @returns {Object} - Added notification
   */
  addNotification(notification) {
    return this.addBundledNotification(notification);
  }

  /**
   * Handle click on a notification
   * @param {Object} notification - Clicked notification
   */
  handleNotificationClick(notification) {
    if (!notification) return;
    console.log("Handling click for notification:", notification);

    // Mark as read
    if (!notification.read) {
      this.markAsRead(notification._id || notification.id);
    }

    // Check if navigation is available
    if (!this.navigate) {
      console.warn("Cannot navigate - navigate function not set in NotificationService");
      window.dispatchEvent(new CustomEvent("notificationClicked", { detail: notification }));
      return;
    }

    try {
      // Navigate based on notification type
      switch (notification.type) {
        case "message":
          const partnerId = notification.sender?._id || notification.data?.sender?._id;
          if (partnerId) {
            this.navigate(`/messages/${partnerId}`);
          } else {
            this.navigate(`/messages`);
          }
          break;

        case "like":
        case "match":
          const senderId = notification.sender?._id;
          if (senderId) {
            this.navigate(`/user/${senderId}`);
          } else {
            this.navigate(`/matches`);
          }
          break;

        case "photoRequest":
          this.navigate(`/settings?tab=privacy`);
          break;

        case "photoResponse":
          const ownerId = notification.sender?._id;
          if (ownerId) {
            this.navigate(`/user/${ownerId}`);
          } else {
            this.navigate('/dashboard');
          }
          break;

        case "story":
          const storyId = notification.data?.storyId || notification._id;
          if (storyId) {
            window.dispatchEvent(new CustomEvent("viewStory", { detail: { storyId } }));
          } else {
            this.navigate('/dashboard');
          }
          break;

        case "call":
          // Call notifications are likely handled directly by the UI components
          // Use the event system to signal that a call notification was clicked
          window.dispatchEvent(new CustomEvent("callNotificationClicked", { detail: notification }));
          break;

        case "comment":
          const contentRef = notification.data?.referenceId || notification.data?.postId;
          if (contentRef) {
            this.navigate(`/post/${contentRef}`);
          } else {
            this.navigate('/dashboard');
          }
          break;

        default:
          this.navigate("/dashboard");
      }

      // Close any open dropdown after navigation
      document.querySelectorAll(".notification-dropdown").forEach((dropdown) => {
        if (dropdown instanceof HTMLElement) {
          dropdown.style.display = "none";
        }
      });
    } catch (error) {
      console.error("Error during notification navigation:", error);
      this.navigate("/dashboard");
    }
  }

  /**
   * Mark a notification as read
   * @param {string} notificationId - ID of the notification to mark
   */
  markAsRead(notificationId) {
    if (!notificationId) return;

    const index = this.notifications.findIndex(n =>
      (n._id && n._id === notificationId) ||
      (n.id && n.id === notificationId)
    );

    if (index === -1 || this.notifications[index].read) return;

    const updatedNotifications = [...this.notifications];
    updatedNotifications[index] = { ...updatedNotifications[index], read: true };
    this.notifications = updatedNotifications;
    this.unreadCount = Math.max(0, this.unreadCount - 1);
    this.notifyListeners();

    // Send read status to server if it's a valid MongoDB ObjectId
    if (notificationId && /^[0-9a-fA-F]{24}$/.test(notificationId)) {
      apiService.put("/notifications/read", { ids: [notificationId] }).catch(() => {
        apiService.put(`/notifications/${notificationId}/read`).catch(err =>
          console.warn(`Failed backend markAsRead for ${notificationId}:`, err)
        );
      });
    }
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead() {
    if (this.unreadCount === 0) return;

    this.notifications = this.notifications.map(n => ({ ...n, read: true }));
    this.unreadCount = 0;
    this.notifyListeners();

    // Collect valid MongoDB ObjectIds for server update
    const realIds = this.notifications
      .map(n => n._id || n.id)
      .filter(id => id && /^[0-9a-fA-F]{24}$/.test(id));

    if (realIds.length > 0) {
      apiService.put("/notifications/read-all").catch(() => {
        apiService.put("/notifications/read", { ids: realIds }).catch(err =>
          console.warn("Failed backend markAllAsRead:", err)
        );
      });
    }
  }

  /**
   * Fetch notifications from the server
   * @param {Object} options - Query options
   * @returns {Array} - Notifications
   */
  async getNotifications(options = {}) {
    if (!this.initialized) {
      console.warn("Trying to fetch notifications before initialization");
    }

    try {
      console.log("Fetching notifications from server...");
      const response = await apiService.get("/notifications", options);
      console.log("Server response:", response);

      if (response.success && Array.isArray(response.data)) {
        const validNotifications = response.data
          .map(n => this.sanitizeNotification(n))
          .filter(n => this.isValidNotification(n));

        // Apply bundling to server notifications before setting state
        const bundledNotifications = this._bundleServerNotifications(validNotifications);

        this.notifications = bundledNotifications;
        this.unreadCount = bundledNotifications.filter(n => !n.read).length;
        this.notifyListeners();

        console.log(`Loaded ${bundledNotifications.length} notifications from server`);
        return this.notifications;
      }

      console.log("No notifications found or invalid response format");
      this.notifications = [];
      this.unreadCount = 0;
      this.notifyListeners();
      return [];
    } catch (error) {
      console.error("Error fetching notifications from API:", error);
      this.notifications = [];
      this.unreadCount = 0;
      this.notifyListeners();
      return [];
    }
  }

  /**
   * Bundle notifications from the server
   * @param {Array} notifications - Notifications to bundle
   * @returns {Array} - Bundled notifications
   */
  _bundleServerNotifications(notifications) {
    // Group notifications by sender and type
    const groupedNotifications = {};

    notifications.forEach(notification => {
      const senderId = notification.sender?._id ||
                       notification.sender?.id ||
                       notification.data?.sender?._id;

      // Skip if no sender ID (we can't group these)
      if (!senderId || !notification.type) {
        return;
      }

      const key = `${senderId}:${notification.type}`;

      // Check if we have notifications of this type from this sender in the last hour
      const now = new Date();
      const notificationDate = new Date(notification.createdAt);
      const timeDiff = now - notificationDate;

      // Only bundle within the timeframe
      if (timeDiff <= this.bundleTimeframe) {
        if (!groupedNotifications[key]) {
          groupedNotifications[key] = [notification];
        } else {
          groupedNotifications[key].push(notification);
        }
      }
    });

    // Process the grouped notifications
    const bundledNotifications = [];

    // First add all notifications that don't fit bundling criteria
    notifications.forEach(notification => {
      const senderId = notification.sender?._id ||
                       notification.sender?.id ||
                       notification.data?.sender?._id;

      if (!senderId || !notification.type) {
        bundledNotifications.push(notification);
      }
    });

    // Then add the bundled notifications
    Object.values(groupedNotifications).forEach(group => {
      if (group.length === 1) {
        // Just one notification, no need to bundle
        bundledNotifications.push(group[0]);
      } else {
        // Multiple notifications, create a bundled one
        const newest = group.sort((a, b) =>
          new Date(b.createdAt) - new Date(a.createdAt)
        )[0];

        bundledNotifications.push({
          ...newest,
          count: group.length,
          message: this._getBundledMessage(newest.type, group.length, newest.sender?.nickname)
        });
      }
    });

    // Sort by most recent first
    return bundledNotifications.sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  /**
   * Update notification settings
   * @param {Object} settings - New settings
   */
  updateSettings(settings) {
    this.userSettings = { ...this.userSettings, notifications: settings };
    console.log("Notification settings updated:", settings);
    // Optional: Persist settings via settingsService
  }

  /**
   * Add a listener function to be notified of changes
   * @param {Function} listener - Listener callback
   * @returns {Function} - Unsubscribe function
   */
  addListener(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.push(listener);
    // Immediately notify the new listener with current state
    listener({
      notifications: [...this.notifications],
      unreadCount: this.unreadCount
    });

    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners of notification changes
   */
  notifyListeners() {
    const data = {
      notifications: [...this.notifications],
      unreadCount: this.unreadCount
    };

    this.listeners.forEach(listener => {
      try {
        listener(data);
      } catch (err) {
        console.error("Notify listener error:", err);
      }
    });
  }

  /**
   * Add a test notification for development/testing
   * @returns {Object} - Created test notification
   */
  addTestNotification() {
    const types = [
      { type: "message", title: "Test Message", message: "Hello!" },
      { type: "like", title: "Test Like", message: "Someone liked you." },
      { type: "photoRequest", title: "Test Request", message: "Wants photo access." },
      { type: "photoResponse", title: "Test Response", message: "Request approved.", data: {status: 'approved'} },
      { type: "comment", title: "Test Comment", message: "Someone commented on your post." }
    ];

    const randomType = types[Math.floor(Math.random() * types.length)];
    const newNotification = {
      _id: `test-${Date.now()}`,
      ...randomType,
      sender: { nickname: "Tester", _id: `testUser-${Date.now()}` },
      read: false,
      createdAt: new Date().toISOString(),
    };

    this.addBundledNotification(newNotification);

    // Also try sending to server via API
    this.createTestNotificationOnServer(newNotification.type);

    return newNotification;
  }

  /**
   * Create a test notification on the server
   * @param {string} type - Notification type
   */
  async createTestNotificationOnServer(type = "system") {
    try {
      const response = await apiService.post('/notifications/create-test', { type });
      if (response?.success) {
        console.log("Created test notification on server:", response.data);
      }
    } catch (error) {
      console.warn("Failed to create test notification on server:", error);
    }
  }
}

// Export singleton instance
const notificationServiceInstance = new NotificationService();

/**
 * Hook to initialize notification service navigation at the app level
 * Used by App.jsx to ensure the navigate function is available early
 */
export function useInitializeNotificationServiceNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    // Pass the navigate function to the notification service
    notificationServiceInstance.setNavigate(navigate);
    console.log("NotificationService navigation initialized via hook");

    // Re-register socket listeners if initialized
    if (notificationServiceInstance.initialized) {
      notificationServiceInstance.checkSocketConnection();
    }

    // Set up listener for socket reconnection events
    const handleSocketReconnect = () => {
      console.log("Socket reconnected - reinitializing notification listeners");
      if (notificationServiceInstance.initialized) {
        notificationServiceInstance.checkSocketConnection();
      }
    };

    window.addEventListener('socketReconnected', handleSocketReconnect);

    return () => {
      window.removeEventListener('socketReconnected', handleSocketReconnect);
    };
  }, [navigate]);
}

export default notificationServiceInstance;
