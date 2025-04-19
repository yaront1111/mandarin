// src/services/notificationService.jsx
import apiService from "./apiService"; // Ensure path is correct
import socketService from "./socketService"; // Ensure path is correct
import logger from "../utils/logger"; // Ensure path is correct
import { formatDate } from "../utils"; // Ensure path is correct, if used internally
// Added missing imports for the hook
import { useEffect } from 'react';
import { useNavigate } from "react-router-dom";

// Create a dedicated logger for the service
const log = logger.create("NotificationService");

/**
 * Singleton Notification Service
 * Handles fetching, storing, updating, and managing real-time notifications.
 */
class NotificationService {
  constructor() {
    this.notifications = []; // In-memory store of notifications
    this.unreadCount = 0;    // Count of unread notifications
    this.initialized = false; // Flag to indicate if initialized
    this.userSettings = null; // User's notification preferences
    this.listeners = [];     // Array of listener callbacks for state changes
    this.navigate = null;    // Function provided by UI for navigation
    this.socketListeners = []; // References to active socket listeners
    this.isLoading = false;    // Flag for ongoing API fetch operations
    this.lastFetchTimestamp = 0; // Timestamp of the last successful fetch
    this.fetchInProgress = false; // More robust flag to prevent concurrent fetches
    this.notificationSyncChannel = null; // For cross-tab communication
    this.pollingIntervalId = null; // ID for fallback polling timer

    // Timeframe for bundling similar notifications (e.g., multiple likes from same user)
    this.bundleTimeframeMs = 5 * 60 * 1000; // 5 minutes

    // Centralized list of socket events this service listens to
    this.socketEventHandlers = {
        "notification": this._handleGenericNotification.bind(this),
        "newMessage": this._handleMessageNotification.bind(this),
        "newLike": this._handleLikeNotification.bind(this),
        "photoPermissionRequestReceived": this._handlePhotoRequestNotification.bind(this),
        "photoPermissionResponseReceived": this._handlePhotoResponseNotification.bind(this),
        "newComment": this._handleCommentNotification.bind(this),
        "incomingCall": this._handleCallNotification.bind(this),
        "newStory": this._handleStoryNotification.bind(this),
        // Add other relevant events here
    };

    this.setupNotificationSyncChannel();
  }

  /**
   * Sets up the BroadcastChannel for cross-tab synchronization.
   */
  setupNotificationSyncChannel() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.notificationSyncChannel = new BroadcastChannel("notification_sync");
        this.notificationSyncChannel.onmessage = this._handleCrossTabMessage.bind(this);
        log.info("Cross-tab notification sync channel established.");
      } else {
        log.warn("BroadcastChannel API not available, cross-tab sync disabled.");
      }
    } catch (error) {
      log.error("Failed to initialize BroadcastChannel:", error);
      this.notificationSyncChannel = null;
    }
  }

  /**
   * Handles messages received from other tabs via BroadcastChannel.
   * @param {MessageEvent} event - The message event.
   */
  _handleCrossTabMessage(event) {
    if (!event?.data) return;
    const { type, data } = event.data;
    log.debug(`Received cross-tab message: Type=${type}`, data);

    switch(type) {
      case "NEW_NOTIFICATION":
        // Add notification received in another tab if it doesn't exist here
        this._addNotificationInternal(data, false); // false = don't sync back
        break;
      case "MARK_READ":
        if (data?.notificationId) {
          this._updateReadStatusInternal(data.notificationId, true, false); // true = read, false = don't sync back
        }
        break;
      case "MARK_ALL_READ":
        this._markAllAsReadInternal(false); // false = don't sync back
        break;
      // No "CLEAR_ALL" handling needed as deletion is removed.
      default:
        log.warn("Received unknown cross-tab message type:", type);
    }
  }

  /**
   * Sends updates to other tabs via BroadcastChannel.
   * @param {string} type - The type of update action.
   * @param {*} data - The data associated with the action.
   */
  _syncToOtherTabs(type, data) {
    if (this.notificationSyncChannel) {
      try {
        this.notificationSyncChannel.postMessage({ type, data });
        log.debug(`Synced action to other tabs: Type=${type}`, data);
      } catch (err) {
        log.error("Error posting message to BroadcastChannel:", err);
      }
    }
  }

  /**
   * Sets the navigation function used for handling notification clicks.
   * @param {Function} navigateFunc - React Router's navigate function or similar.
   */
  setNavigate(navigateFunc) {
    if (typeof navigateFunc === 'function') {
      this.navigate = navigateFunc;
      log.info("Navigation function set successfully.");
    } else {
      log.warn("Attempted to set an invalid navigate function.");
      this.navigate = null; // Ensure it's reset if invalid
    }
  }

  /**
   * Initializes the service with user settings and fetches initial data.
   * Should be called once after user authentication.
   * @param {Object} userSettings - User's notification preferences.
   */
  initialize(userSettings) {
    if (this.initialized) {
      log.warn("NotificationService already initialized. Skipping re-initialization.");
      // Optionally update settings if needed: this.updateSettings(userSettings.notifications);
      return;
    }

    log.info("Initializing NotificationService...");
    // Deep copy settings to avoid external mutations
    this.userSettings = JSON.parse(JSON.stringify(userSettings || {}));
    // Ensure 'notifications' object exists with defaults if missing
    this.userSettings.notifications = this.userSettings.notifications || {
      messages: true, calls: true, stories: true, likes: true,
      comments: true, photoRequests: true
    };
    log.debug("Initialized with settings:", this.userSettings.notifications);

    this.initialized = true;

    // Register socket listeners and handle connection state
    this._setupSocketManagement();

    // Fetch initial notifications immediately after initialization
    this.getNotifications().catch(err => {
      log.error("Error fetching initial notifications during initialization:", err);
      // Service might be initialized, but data fetch failed. State remains empty.
      this.notifyListeners(); // Notify potentially waiting UI about the empty state.
    });

    // Start polling as a fallback if socket isn't connected initially
    this._managePolling();

    log.info("NotificationService initialization complete.");
  }

  /**
   * Manages socket connection listeners and state.
   * @private
   */
  _setupSocketManagement() {
    if (!socketService?.socket) {
        log.error("SocketService or socket instance not available for setup.");
        return;
    }
    log.debug("Setting up socket management (event listeners, connect/disconnect handlers).");

    // Remove any previous listeners before adding new ones
    this._removeSocketListeners();

    // Attach listeners for relevant notification events
    for (const event in this.socketEventHandlers) {
        const handler = this.socketEventHandlers[event];
        socketService.socket.on(event, handler);
        this.socketListeners.push({ event, handler }); // Store reference for cleanup
    }
    log.info(`Registered ${this.socketListeners.length} socket event listeners.`);

    // Handle socket connect/disconnect events
    const handleConnect = () => {
      log.info("Socket connected. Ensuring listeners are active and stopping polling.");
      // Optionally re-register listeners if needed (though usually not necessary)
      // this._setupSocketManagement();
      this._managePolling(); // Stops polling if running
      this.refreshNotifications(); // Refresh data on reconnect
    };
    const handleDisconnect = (reason) => {
      log.warn("Socket disconnected. Reason:", reason, ". Starting polling fallback.");
      this._managePolling(); // Starts polling
    };

    socketService.socket.on('connect', handleConnect);
    socketService.socket.on('disconnect', handleDisconnect);
    this.socketListeners.push({ event: 'connect', handler: handleConnect });
    this.socketListeners.push({ event: 'disconnect', handler: handleDisconnect });
  }

   /**
    * Starts or stops polling based on socket connection status.
    * @private
    */
   _managePolling() {
       if (!this.initialized) return; // Don't poll if not initialized

       const isConnected = socketService.isConnected();
       const pollIntervalMs = 60 * 1000; // Poll every 60 seconds

       if (!isConnected && this.pollingIntervalId === null) {
           log.warn("Socket disconnected, starting polling fallback.");
           this.pollingIntervalId = setInterval(async () => {
               if (!socketService.isConnected()) { // Double-check connection before polling
                   log.debug("Polling for notifications...");
                   await this.refreshNotifications();
               } else {
                   log.info("Socket reconnected during polling interval, stopping poll.");
                   this._managePolling(); // Will clear the interval
               }
           }, pollIntervalMs);
           // Initial poll immediately after starting interval
           this.refreshNotifications();
       } else if (isConnected && this.pollingIntervalId !== null) {
           log.info("Socket connected, stopping polling fallback.");
           clearInterval(this.pollingIntervalId);
           this.pollingIntervalId = null;
       }
   }

  /**
   * Removes all registered socket listeners.
   * @private
   */
  _removeSocketListeners() {
    if (socketService?.socket && this.socketListeners.length > 0) {
      log.debug(`Removing ${this.socketListeners.length} socket listeners.`);
      this.socketListeners.forEach(({ event, handler }) => {
        socketService.socket.off(event, handler);
      });
      this.socketListeners = []; // Clear the array
    }
  }

  /**
   * Cleans up resources used by the service (listeners, timers).
   * Should be called on user logout or application shutdown.
   */
  cleanup() {
    log.info("Cleaning up NotificationService resources...");
    this._removeSocketListeners();

    if (this.notificationSyncChannel) {
      this.notificationSyncChannel.close();
      this.notificationSyncChannel = null;
      log.debug("Closed BroadcastChannel.");
    }
    if (this.pollingIntervalId) {
        clearInterval(this.pollingIntervalId);
        this.pollingIntervalId = null;
        log.debug("Cleared polling interval.");
    }

    // Reset internal state
    this.notifications = [];
    this.unreadCount = 0;
    this.listeners = []; // Clear listeners to prevent calls after cleanup
    this.userSettings = null;
    this.navigate = null;
    this.isLoading = false;
    this.fetchInProgress = false;
    this.lastFetchTimestamp = 0;
    this.initialized = false; // Mark as uninitialized
    log.info("NotificationService cleanup complete.");
  }


  // --- Notification Handling Logic ---

  /**
   * Generic handler for various socket events, creating a standard notification object.
   * @param {string} type - The type of the notification (e.g., 'message', 'like').
   * @param {Object} data - The raw data received from the socket event.
   * @param {Object} overrides - Optional fields to override in the created notification.
   * @private
   */
  _handleGenericSocketEvent(type, data, overrides = {}) {
      if (!this.shouldShowNotification(type)) {
          log.debug(`Notification type "${type}" is disabled by user settings. Skipping.`);
          return;
      }
      if (!data) {
          log.warn(`Received empty data for socket event type "${type}". Skipping.`);
          return;
      }

      log.debug(`Handling socket event: Type=${type}`, data);

      // Basic data validation (adapt as needed per event type)
      const id = data._id || data.id || data.likeId || data.callId || data.permissionId || `socket-${type}-${Date.now()}`;
      const createdAt = data.createdAt || data.timestamp || new Date().toISOString();
      const sender = data.sender || data.user || data.caller || null; // Normalize sender info

      const notification = this.sanitizeNotification({
          _id: id,
          type: type,
          title: data.title || `New ${type}`, // Generate default titles if missing
          message: data.message || data.content || `You have a new ${type}.`,
          sender: sender,
          data: data, // Store original data if needed
          read: false,
          createdAt: createdAt,
          ...overrides, // Apply any specific overrides
      });

      if (notification) {
          this._addNotificationInternal(notification, true); // Add internally and sync
      }
  }

    // Specific handlers calling the generic one
    _handleMessageNotification(data) { this._handleGenericSocketEvent('message', data, { title: `New message from ${data.sender?.nickname || 'Someone'}` }); }
    _handleLikeNotification(data) { this._handleGenericSocketEvent(data?.isMatch ? 'match' : 'like', data, { title: data?.isMatch ? `New match with ${data.sender?.nickname || 'Someone'}!` : `${data.sender?.nickname || 'Someone'} liked you` }); }
    _handlePhotoRequestNotification(data) { this._handleGenericSocketEvent('photoRequest', data, { title: `${data.sender?.nickname || 'Someone'} requested photo access` }); }
    _handlePhotoResponseNotification(data) { this._handleGenericSocketEvent('photoResponse', data, { title: `${data.sender?.nickname || 'Someone'} ${data.status === 'approved' ? 'approved' : 'rejected'} your request` }); }
    _handleCommentNotification(data) { this._handleGenericSocketEvent('comment', data, { title: `${data.user?.nickname || 'Someone'} commented on your post` }); }
    _handleCallNotification(data) { this._handleGenericSocketEvent('call', data, { title: `Incoming call from ${data.caller?.name || 'Someone'}` }); }
    _handleStoryNotification(data) { this._handleGenericSocketEvent('story', data, { title: `${data.user?.nickname || 'Someone'} shared a new story` }); }
    _handleGenericNotification(data) { this._handleGenericSocketEvent(data?.type || 'generic', data); }


  /**
   * Checks if a notification type should be shown based on user settings.
   * @param {string} notificationType - The type to check (e.g., 'messages', 'likes').
   * @returns {boolean} - True if the notification should be shown.
   */
  shouldShowNotification(notificationType) {
    if (!this.initialized || !this.userSettings?.notifications) {
      log.warn(`Checking notification type "${notificationType}" before service is initialized or settings loaded. Defaulting to true.`);
      return true; // Default to showing if not initialized or settings missing
    }

    // Map specific types to setting keys if they differ (e.g., 'message' type maps to 'messages' setting)
    const settingKeyMap = {
        'message': 'messages',
        'like': 'likes',
        'match': 'likes', // Matches often controlled by 'likes' setting
        'photoRequest': 'photoRequests',
        'photoResponse': 'photoRequests', // Responses controlled by the request setting
        'comment': 'comments',
        'call': 'calls',
        'story': 'stories',
        // Add other mappings as needed
    };
    const settingKey = settingKeyMap[notificationType] || notificationType; // Fallback to direct type name

    // Check the setting; explicitly check for `false`, otherwise default to true (show)
    const settingValue = this.userSettings.notifications[settingKey];
    const shouldShow = settingValue !== false;

    log.debug(`Should show notification type "${notificationType}" (setting key "${settingKey}"=${settingValue})? -> ${shouldShow}`);
    return shouldShow;
  }

  /**
   * Adds or updates a notification in the local store with bundling logic.
   * @param {Object} notification - The notification object to add/update.
   * @param {boolean} shouldSync - Whether to sync this action to other tabs.
   * @private
   */
    _addNotificationInternal(rawNotification, shouldSync = true) {
        const notification = this.sanitizeNotification(rawNotification);
        if (!notification) {
            log.warn("Attempted to add invalid notification:", rawNotification);
            return;
        }
        log.debug("Adding/Bundling notification:", notification._id, notification.type);

        const now = Date.now();
        let updated = false;

        // Attempt to bundle with existing notifications
        const senderId = notification.sender?._id;
        if (senderId && notification.type) {
            const existingIndex = this.notifications.findIndex(n =>
                n.sender?._id === senderId &&
                n.type === notification.type &&
                (now - new Date(n.createdAt).getTime()) < this.bundleTimeframeMs
            );

            if (existingIndex !== -1) {
                // Bundle: Update existing notification
                const existing = this.notifications[existingIndex];
                existing.count = (existing.count || 1) + 1;
                existing.createdAt = notification.createdAt; // Use latest timestamp
                existing.read = false; // Mark bundle as unread on new addition
                // Optionally update message to reflect bundling
                existing.message = this._getBundledMessage(existing.type, existing.count, existing.sender?.nickname);
                log.info(`Bundled notification ${notification._id} into existing ${existing._id} (count: ${existing.count})`);
                updated = true;
            }
        }

        // If not bundled, add as a new notification
        if (!updated) {
            // Avoid duplicates by ID before adding
            if (this.notifications.some(n => n._id === notification._id)) {
                log.warn(`Notification with ID ${notification._id} already exists. Skipping add.`);
                return;
            }
            notification.count = 1; // Ensure count is initialized
            this.notifications.unshift(notification); // Add to the beginning
            log.info(`Added new notification ${notification._id} (${notification.type})`);
            updated = true;
        }

        // Recalculate unread count and notify listeners if changes occurred
        if (updated) {
            this.recalculateUnreadCount();
            this.sortNotifications();
            this.notifyListeners();
            if (shouldSync) {
                this._syncToOtherTabs("NEW_NOTIFICATION", notification);
            }
            // Optional: Dispatch a browser event for non-React listeners
            window.dispatchEvent(new CustomEvent('newNotification', { detail: notification }));
        }
    }


  /**
   * Generates a message for bundled notifications.
   * @param {string} type - Notification type.
   * @param {number} count - Number of bundled items.
   * @param {string} [nickname] - Sender's nickname.
   * @returns {string} - A user-friendly bundled message.
   * @private
   */
  _getBundledMessage(type, count, nickname = "Someone") {
    switch (type) {
      case "message": return `${count} new messages from ${nickname}`;
      case "like": return `${nickname} and ${count - 1} others liked you`;
      case "comment": return `${count} new comments`;
      // Add other types as needed
      default: return `${count} new ${type} notifications`;
    }
  }

  /**
   * Ensures a notification object has essential fields and defaults.
   * @param {Object} notification - The raw notification data.
   * @returns {Object|null} - The sanitized notification or null if invalid.
   */
  sanitizeNotification(notification) {
    if (!notification || typeof notification !== 'object') return null;

    const id = notification._id || notification.id || `gen-${Date.now()}-${Math.random().toString(16).substring(2, 8)}`;
    const type = notification.type || 'generic';
    const createdAt = notification.createdAt || new Date().toISOString();

    // Basic validation: requires an ID and type.
    if (!id || !type) {
      log.error("Notification missing required fields (id or type):", notification);
      return null;
    }

    return {
      _id: id,
      type: type,
      title: notification.title || `New ${type}`,
      message: notification.message || notification.content || '',
      sender: notification.sender || null,
      data: notification.data || {},
      read: notification.read === true, // Ensure boolean
      createdAt: createdAt,
      count: notification.count || 1, // Default count to 1
    };
  }

  /**
   * Handles clicks on notification items, usually involving navigation.
   * @param {Object} notification - The notification object that was clicked.
   */
  handleNotificationClick(notification) {
    if (!this.initialized) {
        log.warn("Cannot handle notification click, service not initialized.");
        return;
    }
    if (!notification?._id) {
        log.error("handleNotificationClick called with invalid notification object.");
        return;
    }

    log.info(`Handling click for notification: ${notification._id} (${notification.type})`);

    // Mark as read (optimistic update locally, API call follows)
    if (!notification.read) {
      this.markAsRead(notification._id);
    }

    // Perform navigation based on type
    if (!this.navigate) {
      log.warn("Navigate function not available. Cannot navigate.");
      // Optionally dispatch an event if navigation isn't set up
      window.dispatchEvent(new CustomEvent('notificationClickedNoNavigate', { detail: notification }));
      return;
    }

    try {
      let path = "/dashboard"; // Default path
      switch (notification.type) {
        case "message":
          const partnerId = notification.sender?._id || notification.data?.sender?._id;
          path = partnerId ? `/messages/${partnerId}` : '/messages';
          break;
        case "like":
        case "match":
          const profileId = notification.sender?._id;
          path = profileId ? `/user/${profileId}` : '/matches';
          break;
        case "photoRequest":
          path = '/settings?tab=privacy'; // Example path
          break;
        case "photoResponse":
           const ownerId = notification.sender?._id;
           path = ownerId ? `/user/${ownerId}` : '/dashboard'; // Navigate to user or dashboard
           break;
        case "comment":
           const postId = notification.data?.postId || notification.data?.referenceId;
           path = postId ? `/post/${postId}` : '/dashboard'; // Navigate to post or dashboard
           break;
        case "story":
            // Stories might trigger a viewer overlay instead of navigation
            window.dispatchEvent(new CustomEvent('viewStoryFromNotification', { detail: notification.data }));
            return; // Prevent default navigation
        case "call":
            // Calls might trigger a specific call UI event
            window.dispatchEvent(new CustomEvent('callNotificationClicked', { detail: notification.data }));
            return; // Prevent default navigation
        // Add other cases as needed
      }
      log.debug(`Navigating to: ${path}`);
      this.navigate(path);
    } catch (error) {
      log.error("Error during notification navigation:", error);
      this.navigate("/dashboard"); // Fallback navigation
    }
  }

  /**
   * Marks a single notification as read locally and optionally on the server.
   * @param {string} notificationId - The ID of the notification.
   * @param {boolean} shouldSync - Sync action to other tabs.
   */
  markAsRead(notificationId, shouldSync = true) {
    if (!this.initialized) {
        log.warn("Cannot mark as read, service not initialized.");
        return;
    }
    log.debug(`Attempting to mark notification ${notificationId} as read.`);
    this._updateReadStatusInternal(notificationId, true, shouldSync);

    // Send update to server (fire and forget)
    if (notificationId && /^[0-9a-fA-F]{24}$/.test(notificationId)) { // Basic ObjectId check
      apiService.put(`/notifications/read`, { ids: [notificationId] })
        .then(() => log.debug(`Successfully marked ${notificationId} as read on server.`))
        .catch(err => log.warn(`Failed to mark notification ${notificationId} as read on server:`, err.message || err));
    }
  }

  /**
   * Marks all notifications as read locally and optionally on the server.
   * @param {boolean} shouldSync - Sync action to other tabs.
   */
  markAllAsRead(shouldSync = true) {
      if (!this.initialized) {
        log.warn("Cannot mark all as read, service not initialized.");
        return;
      }
      log.info("Marking all notifications as read.");
      this._markAllAsReadInternal(shouldSync);

      // Send update to server (fire and forget)
      apiService.put("/notifications/read-all")
        .then(() => log.info("Successfully marked all notifications as read on server."))
        .catch(err => log.warn("Failed to mark all notifications as read on server:", err.message || err));
  }


  /**
   * Internal helper to update read status for one notification.
   * @param {string} notificationId - ID of the notification.
   * @param {boolean} readStatus - True for read, false for unread.
   * @param {boolean} shouldSync - Sync action to other tabs.
   * @private
   */
  _updateReadStatusInternal(notificationId, readStatus, shouldSync) {
    const index = this.notifications.findIndex(n => n._id === notificationId);
    if (index === -1 || this.notifications[index].read === readStatus) {
      // Not found or already in the desired state
      return;
    }

    this.notifications[index].read = readStatus;
    this.recalculateUnreadCount();
    this.notifyListeners();

    if (shouldSync) {
      this._syncToOtherTabs(readStatus ? "MARK_READ" : "MARK_UNREAD", { notificationId });
    }
    log.debug(`Notification ${notificationId} marked as ${readStatus ? 'read' : 'unread'}. Unread count: ${this.unreadCount}`);
  }

  /**
   * Internal helper to mark all notifications as read.
   * @param {boolean} shouldSync - Sync action to other tabs.
   * @private
   */
  _markAllAsReadInternal(shouldSync) {
      if (this.unreadCount === 0) return; // No changes needed

      let changed = false;
      this.notifications.forEach(n => {
          if (!n.read) {
              n.read = true;
              changed = true;
          }
      });

      if (changed) {
        this.unreadCount = 0;
        this.notifyListeners();
        if (shouldSync) {
            this._syncToOtherTabs("MARK_ALL_READ");
        }
        log.info(`All notifications marked as read. Unread count: ${this.unreadCount}`);
      }
  }

  /**
   * Fetches notifications from the server API.
   * @param {Object} [options] - Optional query parameters for the API call.
   * @returns {Promise<Array>} - Resolves with the current notifications array (after update).
   */
    async getNotifications(options = {}) {
        if (!this.initialized) {
            log.error("Attempted to fetch notifications before service was initialized.");
            return Promise.resolve(this.notifications); // Return current (likely empty) state
        }
        if (this.fetchInProgress) {
            log.warn("Notification fetch already in progress. Skipping duplicate request.");
            return Promise.resolve(this.notifications); // Return current state
        }

        log.info("Fetching notifications from server...");
        this.isLoading = true;
        this.fetchInProgress = true;
        this.notifyListeners(); // Notify UI that loading started

        try {
            // Add cache-busting param if needed: options._t = Date.now();
            const response = await apiService.get("/notifications", options);

            if (response?.success && Array.isArray(response.data)) {
                log.debug(`Received ${response.data.length} notifications from API.`);
                const sanitized = response.data
                    .map(n => this.sanitizeNotification(n))
                    .filter(n => n !== null); // Filter out invalid ones

                // Replace local state with fetched state
                this.notifications = sanitized;
                this.recalculateUnreadCount();
                this.sortNotifications(); // Ensure order is correct
                this.lastFetchTimestamp = Date.now();
                log.info(`Successfully updated notifications. Count: ${this.notifications.length}, Unread: ${this.unreadCount}`);
            } else {
                log.warn("Received invalid or unsuccessful response from /notifications API:", response);
                // Optionally clear local state on failure, or keep stale data? Decide based on UX.
                // this.notifications = []; // Example: Clear on failure
                // this.unreadCount = 0;
                throw new Error("Invalid data received from notification API");
            }
        } catch (error) {
            log.error("Error fetching notifications:", error.message || error);
            // Keep existing notifications on error, don't clear them
            // toast.error("Could not fetch latest notifications."); // Handled by context/UI potentially
        } finally {
            this.isLoading = false;
            this.fetchInProgress = false;
            this.notifyListeners(); // Notify UI about loading state change and potentially new data
        }
        return this.notifications; // Return the current state
    }


  /**
   * Manually triggers a refresh of notifications from the server.
   * @returns {Promise<Array>} - Resolves with the updated notifications array.
   */
  refreshNotifications() {
    log.debug("Manual refresh triggered.");
    return this.getNotifications({ cacheBust: Date.now() }); // Add param to bypass potential caching
  }

  /**
   * Recalculates the unread count based on the current notifications array.
   * @private
   */
  recalculateUnreadCount() {
    const newUnreadCount = this.notifications.filter(n => !n.read).length;
    if (newUnreadCount !== this.unreadCount) {
        log.debug(`Recalculated unread count: ${newUnreadCount}`);
        this.unreadCount = newUnreadCount;
        // No need to call notifyListeners here, called by the calling function
    }
  }

  /**
   * Sorts the notifications array (typically newest first).
   * @private
   */
  sortNotifications() {
    this.notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }


  // --- Listener Management ---

  /**
   * Adds a listener function to be called when notification state changes.
   * @param {Function} listener - The callback function. Receives ({ notifications, unreadCount, isLoading }).
   * @returns {Function} - An unsubscribe function to remove the listener.
   */
  addListener(listener) {
    if (typeof listener !== 'function') {
      log.error("Attempted to add non-function listener.");
      return () => {}; // Return no-op unsubscribe function
    }
    log.debug("Adding notification listener.");
    this.listeners.push(listener);

    // Immediately call the listener with the current state
    try {
      listener({
        notifications: [...this.notifications], // Shallow copy
        unreadCount: this.unreadCount,
        isLoading: this.isLoading,
      });
    } catch (error) {
        log.error("Error calling new listener immediately:", error);
    }


    // Return unsubscribe function
    return () => {
      log.debug("Removing notification listener.");
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notifies all registered listeners with the current state.
   * @private
   */
  notifyListeners() {
    if (!this.initialized && this.listeners.length > 0) {
        // Don't notify if service was cleaned up but listeners somehow persist
        log.warn("Prevented notifyListeners call on uninitialized service.");
        return
    }
    log.debug(`Notifying ${this.listeners.length} listeners.`);
    const state = {
      notifications: [...this.notifications], // Shallow copy
      unreadCount: this.unreadCount,
      isLoading: this.isLoading,
    };
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        log.error("Error notifying listener:", error);
        // Optionally remove faulty listener: this.listeners = this.listeners.filter(l => l !== listener);
      }
    });
  }

  // --- Settings Management ---

  /**
   * Updates user notification preferences.
   * @param {Object} newSettings - The notification-specific settings object.
   */
  updateSettings(newSettings) {
    if (!this.initialized) {
        log.warn("Cannot update settings, service not initialized.");
        return;
    }
    log.info("Updating notification settings:", newSettings);
    // Merge new settings into the existing ones
    this.userSettings.notifications = {
      ...this.userSettings.notifications,
      ...newSettings,
    };
    log.debug("Settings updated to:", this.userSettings.notifications);
    // Persist settings via API (fire and forget)
    // Assuming a general settings service or endpoint exists
    apiService.put('/settings/notifications', this.userSettings.notifications)
        .then(() => log.info("Notification settings saved to server."))
        .catch(err => log.error("Failed to save notification settings:", err));

    this.notifyListeners(); // Notify potentially interested UI parts about setting changes (though unlikely needed)
  }

  // --- Development/Testing ---

  /**
   * Adds a predefined test notification for development purposes.
   * @returns {Object|null} - The added notification object or null.
   */
  addTestNotification() {
    if (!this.initialized) {
      log.warn("Cannot add test notification, service not initialized.");
      return null;
    }
    log.info("Adding test notification...");
    const types = [
      { type: "message", title: "Test Message", message: "This is a test message notification." },
      { type: "like", title: "Test Like", message: "Tester liked your profile." },
      { type: "match", title: "Test Match", message: "You matched with Tester!", data: { isMatch: true } },
      { type: "comment", title: "Test Comment", message: "Tester commented on your post." },
      { type: "photoRequest", title: "Test Photo Request", message: "Tester requests access to your photo." },
      { type: "photoResponse", title: "Test Photo Approval", message: "Tester approved your photo request.", data: { status: 'approved' } },
      { type: "story", title: "Test Story", message: "Tester added a new story." },
    ];
    const randomType = types[Math.floor(Math.random() * types.length)];
    const testNotification = {
      _id: `test-${Date.now()}`,
      sender: { _id: "testUser123", nickname: "Tester" },
      read: false,
      createdAt: new Date().toISOString(),
      ...randomType, // Spread the selected type's properties
    };

    const sanitized = this.sanitizeNotification(testNotification);
    if (sanitized) {
      this._addNotificationInternal(sanitized, true); // Add and sync
      return sanitized;
    }
    return null;
  }

  /**
   * Creates a test notification directly via API (for backend testing).
   * @param {string} [type='system'] - The type of test notification to create.
   */
  async createTestNotificationOnServer(type = "system") {
    if (!this.initialized) {
        log.warn("Cannot create server test notification, service not initialized.");
        return;
    }
    log.info(`Requesting server to create test notification of type: ${type}`);
    try {
      const response = await apiService.post('/notifications/create-test', { type });
      if (response?.success) {
        log.info("Server successfully created test notification:", response.data);
        // It should arrive via socket if backend is configured correctly
      } else {
        log.warn("Server response for test notification creation was not successful:", response);
      }
    } catch (error) {
      log.error("Failed to request server test notification creation:", error);
    }
  }
}

// Export singleton instance
const notificationServiceInstance = new NotificationService();

/**
 * Hook to initialize notification service navigation at the app level.
 * Should be used once in the main App component.
 * ADDED EXPORT KEYWORD HERE
 */
export function useInitializeNotificationServiceNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    // Pass the navigate function to the notification service instance
    log.debug("Initializing notification service navigation via hook.");
    notificationServiceInstance.setNavigate(navigate);

    // Re-check socket connection and potentially register listeners if already initialized
    if (notificationServiceInstance.initialized) {
      log.debug("Service already initialized, ensuring socket management is set up.");
      notificationServiceInstance._setupSocketManagement(); // Re-run setup to be safe
    }

    // Example of how to listen for custom events if needed (e.g., socket force reconnect)
    // const handleSocketReconnect = () => { ... };
    // window.addEventListener('socketReconnected', handleSocketReconnect);
    // return () => window.removeEventListener('socketReconnected', handleSocketReconnect);

  }, [navigate]); // Rerun only if navigate function instance changes
}


export default notificationServiceInstance; // Default export remains the instance
