// client/src/services/notificationService.jsx
import apiService from "./apiService.jsx";
import { toast } from "react-toastify";
import socketService from "./socketService.jsx";
import { useEffect } from 'react';
import { useNavigate } from "react-router-dom";

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
  }

  // Method to set the navigate function
  setNavigate(navigateFunc) {
    if (typeof navigateFunc === 'function') {
      this.navigate = navigateFunc;
      console.log("Navigate function set successfully in NotificationService");
    } else {
      console.warn("Attempted to set invalid navigate function in NotificationService");
    }
  }

  // --- Initialize ---
  initialize(userSettings) {
    if (this.initialized) {
      console.log("NotificationService already initialized");
      return;
    }

    this.userSettings = userSettings || {
      notifications: {
        messages: true, calls: true, stories: true,
        likes: true, comments: true, photoRequests: true,
      },
    };

    // We won't attempt socket reconnection here - just initialize available services
    // Socket connection will be handled by the auth provider
    if (socketService.isConnected()) {
      this.registerSocketListeners();
    }

    this.initialized = true;
    this.getNotifications();
    console.log("NotificationService initialized successfully");
  }

  // Check socket connection status and register listeners if connected
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

  // --- Clean up socket listeners ---
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

  // --- Register Listeners (ensure event names match server) ---
  registerSocketListeners() {
    if (!socketService.isConnected()) {
      console.warn("NotificationService: Socket not connected. Cannot register listeners.");
      return;
    }

    // Clean up old listeners
    this.cleanup();

    // Define all notification event types we want to listen for
    const notificationEvents = [
      "newMessage",
      "incomingCall",
      "newStory",
      "newLike",
      "notification",
      "newComment",
      "photoPermissionRequestReceived",
      "photoPermissionResponseReceived"
    ];

    console.log(`Registering socket listeners for ${notificationEvents.length} notification types`);

    // --- Register Message Notifications ---
    const messageListener = (data) => {
      if (this.shouldShowNotification("messages") && data) {
        this.addNotification({
          _id: data._id || `msg-${Date.now()}`,
          type: "message",
          title: `New message from ${data.sender?.nickname || "Someone"}`,
          message: data.content,
          time: "Just now",
          read: false,
          sender: data.sender,
          data: data,
          createdAt: data.createdAt || new Date().toISOString(),
        });
      }
    };

    const removeMessageListener = socketService.on("newMessage", messageListener);
    this.socketListeners.push(removeMessageListener);

    // --- Register Call Notifications ---
    const callListener = (data) => {
      if (this.shouldShowNotification("calls") && data) {
        this.addNotification({
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
        });
      }
    };

    const removeCallListener = socketService.on("incomingCall", callListener);
    this.socketListeners.push(removeCallListener);

    // --- Register Story Notifications ---
    const storyListener = (data) => {
      if (this.shouldShowNotification("stories") && data) {
        this.addNotification({
          _id: data._id || `story-${Date.now()}`,
          type: "story",
          title: `${data.user?.nickname || "Someone"} shared a new story`,
          message: "Click to view",
          time: "Just now",
          read: false,
          sender: data.user,
          data: data,
          createdAt: data.createdAt || new Date().toISOString(),
        });
      }
    };

    const removeStoryListener = socketService.on("newStory", storyListener);
    this.socketListeners.push(removeStoryListener);

    // --- Register Like Notifications ---
    const likeListener = (data) => {
      if (this.shouldShowNotification("likes") && data) {
        this.addNotification({
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
        });
      }
    };

    const removeLikeListener = socketService.on("newLike", likeListener);
    this.socketListeners.push(removeLikeListener);

    // --- Register Photo Permission Request Notifications ---
    const photoRequestListener = (data) => {
      if (this.shouldShowNotification("photoRequests") && data) {
        const requesterNickname = data.sender?.nickname || "Someone";
        this.addNotification({
          _id: data.permissionId || `permReq-${Date.now()}`,
          type: "photoRequest",
          title: `${requesterNickname} requested photo access`,
          message: "Click to review",
          time: "Just now",
          read: false,
          sender: data.sender,
          data: data,
          createdAt: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
        });
      }
    };

    const removePhotoRequestListener = socketService.on("photoPermissionRequestReceived", photoRequestListener);
    this.socketListeners.push(removePhotoRequestListener);

    // --- Register Photo Permission Response Notifications ---
    const photoResponseListener = (data) => {
      if (this.shouldShowNotification("photoRequests") && data) {
        const ownerNickname = data.sender?.nickname || "Someone";
        const action = data.status === "approved" ? "approved" : "rejected";
        this.addNotification({
          _id: data.permissionId || `permRes-${Date.now()}`,
          type: "photoResponse",
          title: `${ownerNickname} ${action} your request`,
          message: data.status === "approved" ? "You can now view their photo." : "Request declined.",
          time: "Just now",
          read: false,
          sender: data.sender,
          data: data,
          createdAt: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
        });

        // Dispatch an event for components that need to update their UI
        window.dispatchEvent(new CustomEvent('permissionStatusUpdated', {
          detail: { photoId: data.photoId, status: data.status }
        }));
      }
    };

    const removePhotoResponseListener = socketService.on("photoPermissionResponseReceived", photoResponseListener);
    this.socketListeners.push(removePhotoResponseListener);

    // --- Register Comment Notifications ---
    const commentListener = (data) => {
      if (this.shouldShowNotification("comments") && data) {
        this.addNotification({
          _id: data._id || `comment-${Date.now()}`,
          type: "comment",
          title: `${data.user?.nickname || "Someone"} commented on your post`,
          message: data.content || "Click to view",
          time: "Just now",
          read: false,
          sender: data.user,
          data: data,
          createdAt: data.createdAt || new Date().toISOString(),
        });
      }
    };

    const removeCommentListener = socketService.on("newComment", commentListener);
    this.socketListeners.push(removeCommentListener);

    // --- Register Generic Notification Listener ---
    const genericListener = (data) => {
      if (data?.type && this.shouldShowNotification(data.type)) {
        this.addNotification(data);
      }
    };

    const removeGenericListener = socketService.on("notification", genericListener);
    this.socketListeners.push(removeGenericListener);

    console.log("Socket notification listeners registered successfully");
  }

  // --- Helper methods ---
  shouldShowNotification(notificationType) {
    if (!this.initialized || !this.userSettings) return true;

    // Special case for photo requests
    if (notificationType === "photoRequest" || notificationType === "photoResponse") {
      return this.userSettings.notifications?.photoRequests !== false;
    }

    return this.userSettings.notifications?.[notificationType] !== false;
  }

  isValidNotification(notification) {
    if (!notification) return false;
    const hasId = notification._id || notification.id;
    const hasMessage = notification.message || notification.title || notification.content;
    const hasType = notification.type;
    return Boolean(hasId && hasMessage && hasType);
  }

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

  addNotification(notification) {
    const sanitizedNotification = this.sanitizeNotification(notification);
    if (!sanitizedNotification || !this.isValidNotification(sanitizedNotification)) {
      console.warn("Skipping invalid notification:", notification);
      return;
    }

    // Check for duplicates by ID
    const existingIndex = this.notifications.findIndex(n =>
      (n._id && n._id === sanitizedNotification._id) ||
      (n.id && n.id === sanitizedNotification.id)
    );

    if (existingIndex !== -1) {
      console.log(`Notification already exists with ID: ${sanitizedNotification._id || sanitizedNotification.id}`);
      return;
    }

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
          <div className="notification-title">{title}</div>
          {message && <div className="notification-message">{message}</div>}
        </div>,
        toastOptions
      );
    } catch (error) {
      console.error("Error showing notification toast:", error);
    }
  }

  // --- Handle Notification Click ---
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

  // --- Mark Notifications as Read ---
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

  // --- Get Notifications from Server ---
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

        this.notifications = validNotifications;
        this.unreadCount = validNotifications.filter(n => !n.read).length;
        this.notifyListeners();

        console.log(`Loaded ${validNotifications.length} notifications from server`);
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

  // --- Update Settings, Add Listener, Notify Listeners ---
  updateSettings(settings) {
    this.userSettings = { ...this.userSettings, notifications: settings };
    console.log("Notification settings updated:", settings);
    // Optional: Persist settings via settingsService
  }

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

  // --- Add Test Notification ---
  addTestNotification() {
    const types = [
      { type: "message", title: "Test Message", message: "Hello!" },
      { type: "like", title: "Test Like", message: "Someone liked you." },
      { type: "photoRequest", title: "Test Request", message: "Wants photo access." },
      { type: "photoResponse", title: "Test Response", message: "Request approved.", data:{status:'approved'} }
    ];

    const randomType = types[Math.floor(Math.random() * types.length)];
    const newNotification = {
      _id: `test-${Date.now()}`,
      ...randomType,
      sender: { nickname: "Tester", _id: `testUser-${Date.now()}` },
      read: false,
      createdAt: new Date().toISOString(),
    };

    this.addNotification(newNotification);

    // Also try sending to server via API
    this.createTestNotificationOnServer(newNotification.type);

    return newNotification;
  }

  // Create a test notification on the server
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

// --- Export the Singleton Instance ---
const notificationServiceInstance = new NotificationService();

/**
 * Hook to initialize notification service navigation at the app level
 * This is used by App.jsx to ensure the navigate function is available
 * to the notification service as early as possible
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
