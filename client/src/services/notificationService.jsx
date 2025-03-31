// client/src/services/notificationService.jsx - Enhanced Production Version
import apiService from "./apiService.jsx";
import socketService from "./socketService.jsx";
import { useEffect } from 'react';
import { useNavigate } from "react-router-dom";

/**
 * Enhanced Notification Service with improved error handling and reliability
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
    this.isLoading = false;
    this.lastFetch = 0;
    this.fetchQueue = Promise.resolve(); // For sequential fetching

    // Notification grouping timeframe (in milliseconds)
    this.bundleTimeframe = 60 * 60 * 1000; // 1 hour

    // Notification event types to listen for
    this.notificationEventTypes = [
      "notification",
      "newMessage",
      "newLike",
      "photoPermissionRequestReceived",
      "photoPermissionResponseReceived",
      "newComment",
      "incomingCall",
      "newStory",
    ];

    // Cross-tab synchronization
    this.setupNotificationSyncChannel();
  }

  /**
   * Set up broadcast channel for cross-tab notification sync
   */
  setupNotificationSyncChannel() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.notificationSyncChannel = new BroadcastChannel("notification_sync");

        // Listen for messages from other tabs
        this.notificationSyncChannel.onmessage = (event) => {
          const { type, data } = event.data || {};
          if (!type) return;

          switch(type) {
            case "NEW_NOTIFICATION":
              console.log("Received new notification from another tab");
              this.addBundledNotification(data);
              window.dispatchEvent(new CustomEvent("newNotification", { detail: data }));
              break;
            case "MARK_READ":
              if (data && data.notificationId) {
                this.markAsRead(data.notificationId, false); // Don't sync back
              }
              break;
            case "MARK_ALL_READ":
              this.markAllAsRead(false); // Don't sync back
              break;
            default:
              break;
          }
        };

        console.log("Notification sync channel initialized");
      } else {
        console.log("BroadcastChannel not supported, cross-tab sync disabled");
      }
    } catch (error) {
      console.error("Error setting up notification sync channel:", error);
      this.notificationSyncChannel = null;
    }
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
      // Even if already initialized, update settings if provided
      if (userSettings && userSettings.notifications) {
        console.log("Updating settings of already initialized service:", userSettings);
        this.userSettings = userSettings;
      }
      return;
    }

    // Log the incoming settings for debugging
    console.log("Initializing NotificationService with settings:", userSettings);
    console.log("Messages notification setting specifically:", 
      userSettings?.notifications?.messages,
      "typeof:", typeof userSettings?.notifications?.messages);

    // Set default settings if none provided
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

    // Ensure notifications object exists
    if (!this.userSettings.notifications) {
      this.userSettings.notifications = {
        messages: true,
        calls: true,
        stories: true,
        likes: true,
        comments: true,
        photoRequests: true,
      };
    }

    // Check socket connection and register listeners if connected
    this.checkSocketConnection();

    // Set up auto-retry for socket connection
    this._setupSocketConnectionRetry();

    this.initialized = true;

    // Get initial notifications (with error handling)
    this.getNotifications().catch(err => {
      console.error("Failed to fetch initial notifications:", err);
    });

    console.log("NotificationService initialized successfully with settings:", this.userSettings);
    console.log("Final messages notification setting:", this.userSettings.notifications.messages);

    // Set up visibility change handler to refresh when tab becomes visible
    document.addEventListener('visibilitychange', this._handleVisibilityChange.bind(this));
  }

  /**
   * Set up socket connection retry mechanism
   * @private
   */
  _setupSocketConnectionRetry() {
    // Clear any existing timer
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
    }

    // Set up periodic check for socket connection
    this.reconnectTimer = setInterval(() => {
      if (!socketService.isConnected() && this.initialized) {
        if (this.socketReconnectAttempts < this.maxReconnectAttempts) {
          console.log(`Attempting to reconnect socket for notifications (attempt ${this.socketReconnectAttempts + 1}/${this.maxReconnectAttempts})`);
          this.socketReconnectAttempts++;
          this.checkSocketConnection();
        } else if (this.socketReconnectAttempts === this.maxReconnectAttempts) {
          console.warn("Max socket reconnection attempts reached for notifications");
          this.socketReconnectAttempts++;

          // After max attempts, try less frequently (once every 2 minutes)
          clearInterval(this.reconnectTimer);
          this.reconnectTimer = setInterval(() => {
            console.log("Periodic socket reconnection attempt for notifications");
            this.checkSocketConnection();
          }, 120000); // 2 minutes
        }
      } else if (socketService.isConnected()) {
        // Reset counter when connected
        this.socketReconnectAttempts = 0;
      }
    }, 30000); // Check every 30 seconds initially
  }

  /**
   * Handle visibility change for tab switching
   * @private
   */
  _handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      // Check if we haven't fetched notifications in the last 60 seconds
      const timeSinceLastFetch = Date.now() - this.lastFetch;
      if (timeSinceLastFetch > 60000) {
        console.log("Tab became visible, refreshing notifications");
        this.refreshNotifications();
      }
    }
  }

  /**
   * Clean up resources used by the service
   */
  cleanup() {
    // Clean up socket listeners
    this.socketListeners.forEach(removeListener => {
      if (typeof removeListener === 'function') {
        removeListener();
      }
    });
    this.socketListeners = [];

    // Clean up reconnect timer
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Clean up broadcast channel
    if (this.notificationSyncChannel) {
      this.notificationSyncChannel.close();
      this.notificationSyncChannel = null;
    }

    // Clean up visibility handler
    document.removeEventListener('visibilitychange', this._handleVisibilityChange);

    console.log("NotificationService resources cleaned up");
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
   * Register socket event listeners for different notification types
   */
  registerSocketListeners() {
    // First clean up existing listeners to prevent duplicates
    this.cleanup();

    if (!socketService.isConnected()) {
      console.warn("NotificationService: Socket not connected. Cannot register listeners.");
      return;
    }

    // Define all notification types in one place for easier management
    // Note that for messages, we map to the "messages" property in settings, even though the type is "message"
    const notificationTypes = [
      { event: "newMessage", type: "message", settingName: "messages", handler: this._handleMessageNotification.bind(this) },
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

    // Special handling for reconnects to refresh notifications
    const reconnectHandler = () => {
      console.log("Socket reconnected, refreshing notifications");
      this.refreshNotifications();
    };
    const removeReconnectListener = socketService.on("connect", reconnectHandler);
    this.socketListeners.push(removeReconnectListener);

    console.log(`Registered ${notificationTypes.length} socket notification listeners`);
  }

  /**
   * Handle message notifications
   * @param {Object} data - Message data
   */
  _handleMessageNotification(data) {
    // Use the "message" type for checking (not "messages") - this matches what we handle in shouldShowNotification
    console.log("Checking if message notification should be shown");
    
    if (this.shouldShowNotification("message") && data) {
      console.log("Message notification will be shown");
      
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
    } else {
      console.log("Message notification suppressed by settings");
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
    if (!this.initialized || !this.userSettings) {
      console.log(`Notification check - not initialized yet, defaulting to show ${notificationType}`);
      return true;
    }

    // Special case for photo requests
    if (notificationType === "photoRequest" || notificationType === "photoResponse") {
      const shouldShow = this.userSettings.notifications?.photoRequests !== false;
      console.log(`Notification ${notificationType} check - photoRequests setting:`, 
        this.userSettings.notifications?.photoRequests, 
        'shouldShow:', shouldShow);
      return shouldShow;
    }

    // Add special handling for message notifications
    if (notificationType === "message") {
      // Handle "messages" (plural) vs "message" (singular) mapping
      // This could be a source of the bug - if we're setting "messages" but checking "message"
      
      // First check the direct match (message)
      if (this.userSettings.notifications?.message !== undefined) {
        const setting = this.userSettings.notifications.message;
        const shouldShow = setting !== false;
        console.log(`Message notification check - direct "message" setting:`, 
          setting,
          'typeof:', typeof setting,
          'shouldShow:', shouldShow);
        return shouldShow;
      }
      
      // Then check the plural version (messages)
      if (this.userSettings.notifications?.messages !== undefined) {
        const setting = this.userSettings.notifications.messages;
        const shouldShow = setting !== false;
        console.log(`Message notification check - "messages" setting:`, 
          setting,
          'typeof:', typeof setting,
          'shouldShow:', shouldShow);
        return shouldShow;
      }
      
      // If neither is defined, default to true
      console.log("Message notification check - no setting found, defaulting to true");
      return true;
    }

    const shouldShow = this.userSettings.notifications?.[notificationType] !== false;
    console.log(`Notification ${notificationType} check - setting:`, 
      this.userSettings.notifications?.[notificationType], 
      'shouldShow:', shouldShow);
    return shouldShow;
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


        // Sync to other tabs
        this._syncToOtherTabs("NEW_NOTIFICATION", this.notifications[similarNotificationIndex]);

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


    // Notify listeners
    this.notifyListeners();

    // Sync to other tabs
    this._syncToOtherTabs("NEW_NOTIFICATION", sanitizedNotification);

    // Dispatch browser event for components not using the context
    window.dispatchEvent(new CustomEvent("newNotification", { detail: sanitizedNotification }));

    console.log(`Added notification: ${sanitizedNotification.type} - ${sanitizedNotification.title || sanitizedNotification.message}`);

    return sanitizedNotification;
  }

  /**
   * Sync notification actions to other tabs
   * @private
   * @param {string} type - Action type
   * @param {*} data - Data to sync
   */
  _syncToOtherTabs(type, data) {
    if (this.notificationSyncChannel) {
      try {
        this.notificationSyncChannel.postMessage({ type, data });
      } catch (err) {
        console.error("Error syncing to other tabs:", err);
      }
    }
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
   * Display a notification (toast functionality removed)
   * @param {Object} notification - Notification to show
   */
  showToast(notification) {
    // Toast functionality removed
    console.log("Toast notifications have been disabled");
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
   * @param {boolean} shouldSync - Whether to sync to other tabs
   */
  markAsRead(notificationId, shouldSync = true) {
    if (!notificationId) return;

    const index = this.notifications.findIndex(n =>
      (n._id && n._id === notificationId) ||
      (n.id && n.id === notificationId)
    );

    if (index === -1 || this.notifications[index].read) return;

    // Update local state
    const updatedNotifications = [...this.notifications];
    updatedNotifications[index] = { ...updatedNotifications[index], read: true };
    this.notifications = updatedNotifications;
    this.unreadCount = Math.max(0, this.unreadCount - 1);

    // Notify listeners
    this.notifyListeners();

    // Sync to other tabs if requested
    if (shouldSync) {
      this._syncToOtherTabs("MARK_READ", { notificationId });
    }

    // Send read status to server if it's a valid MongoDB ObjectId
    if (notificationId && /^[0-9a-fA-F]{24}$/.test(notificationId)) {
      apiService.put("/notifications/read", { ids: [notificationId] }).catch(err => {
        console.warn(`Failed to mark notification ${notificationId} as read on server:`, err);
        // Fallback to single notification endpoint
        apiService.put(`/notifications/${notificationId}/read`).catch(err2 =>
          console.warn(`Failed backend markAsRead for ${notificationId}:`, err2)
        );
      });
    }
  }

  /**
   * Mark all notifications as read
   * @param {boolean} shouldSync - Whether to sync to other tabs
   */
  markAllAsRead(shouldSync = true) {
    if (this.unreadCount === 0) return;

    // Update local state
    this.notifications = this.notifications.map(n => ({ ...n, read: true }));
    this.unreadCount = 0;

    // Notify listeners
    this.notifyListeners();

    // Sync to other tabs if requested
    if (shouldSync) {
      this._syncToOtherTabs("MARK_ALL_READ");
    }

    // Collect valid MongoDB ObjectIds for server update
    const realIds = this.notifications
      .map(n => n._id || n.id)
      .filter(id => id && /^[0-9a-fA-F]{24}$/.test(id));

    // Update on server
    if (realIds.length > 0) {
      apiService.put("/notifications/read-all").catch(err => {
        console.warn("Failed to mark all notifications as read on server:", err);
        // Fallback to batch update endpoint
        apiService.put("/notifications/read", { ids: realIds }).catch(err2 =>
          console.warn("Failed backend markAllAsRead:", err2)
        );
      });
    }
  }

  /**
   * Fetch notifications from the server
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Notifications
   */
  async getNotifications(options = {}) {
    // Queue the fetch operation to prevent overlapping requests
    this.fetchQueue = this.fetchQueue.then(async () => {
      if (this.isLoading) {
        console.log("Notifications already loading, request queued");
        return this.notifications;
      }

      this.isLoading = true;
      let success = false;

      try {
        if (!this.initialized) {
          console.warn("Trying to fetch notifications before initialization");
        }

        console.log("Fetching notifications from server...");
        const response = await apiService.get("/notifications", options);
        this.lastFetch = Date.now();

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
          success = true;
          return this.notifications;
        }

        console.log("No notifications found or invalid response format");
        this.notifications = [];
        this.unreadCount = 0;
        this.notifyListeners();
        return [];
      } catch (error) {
        console.error("Error fetching notifications from API:", error);

        // Don't reset notifications if we already have some and this is just an error
        if (!success && this.notifications.length === 0) {
          this.notifications = [];
          this.unreadCount = 0;
          this.notifyListeners();
        }
        return this.notifications;
      } finally {
        this.isLoading = false;
      }
    }).catch(err => {
      console.error("Unexpected error in notification fetch queue:", err);
      this.isLoading = false;
      return this.notifications;
    });

    return this.fetchQueue;
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
    // Log the incoming settings for debugging
    console.log("Updating NotificationService settings:", settings);
    console.log("Messages notification setting specifically:", 
      settings?.messages,
      "typeof:", typeof settings?.messages);
    
    // Ensure boolean values are properly handled
    const normalizedSettings = {};
    if (settings) {
      // Explicitly convert to boolean where needed
      normalizedSettings.messages = settings.messages === false ? false : Boolean(settings.messages);
      normalizedSettings.calls = settings.calls === false ? false : Boolean(settings.calls);
      normalizedSettings.stories = settings.stories === false ? false : Boolean(settings.stories);
      normalizedSettings.likes = settings.likes === false ? false : Boolean(settings.likes);
      normalizedSettings.comments = settings.comments === false ? false : Boolean(settings.comments);
      normalizedSettings.photoRequests = settings.photoRequests === false ? false : Boolean(settings.photoRequests);
    }
    
    console.log("Normalized notification settings:", normalizedSettings);
    
    // Update our settings
    this.userSettings = { ...this.userSettings, notifications: normalizedSettings };
    
    // Persist settings via settingsService using dynamic import
    import('./settingsService.jsx')
      .then(module => {
        const settingsService = module.default;
        return settingsService.updateNotificationSettings(normalizedSettings);
      })
      .then(() => console.log('Notification settings saved to server'))
      .catch(err => console.error('Failed to save notification settings to server:', err));
    
    // Notify all listeners of the settings change
    this.notifyListeners();
    
    // Log the final state of settings
    console.log("Final state of notification settings:", this.userSettings.notifications);
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
   * Refresh notifications manually
   * @returns {Promise<Array>} - Refreshed notifications
   */
  refreshNotifications() {
    return this.getNotifications({ _t: Date.now() }); // Add timestamp to bust cache
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

// Provide cleanup method on module itself for application shutdown
notificationServiceInstance.globalCleanup = () => {
  notificationServiceInstance.cleanup();
};

export default notificationServiceInstance;
