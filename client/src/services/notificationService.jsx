// client/src/services/notificationService.jsx
import apiService from "./apiService.jsx";
import { toast } from "react-toastify";
import socketService from "./socketService.jsx";
import { useEffect } from 'react';        // <-- Import useEffect
import { useNavigate } from "react-router-dom"; // <-- Import useNavigate

class NotificationService {
  constructor() {
    this.notifications = [];
    this.unreadCount = 0;
    this.initialized = false;
    this.userSettings = null;
    this.listeners = [];
    this.navigate = null; // Store navigate function
  }

  // Method to set the navigate function
  setNavigate(navigateFunc) {
    if (typeof navigateFunc === 'function') {
        this.navigate = navigateFunc;
    } else {
        console.warn("Attempted to set invalid navigate function in NotificationService");
    }
  }

  // --- Initialize ---
  initialize(userSettings) {
    this.userSettings = userSettings || {
      notifications: {
        messages: true, calls: true, stories: true,
        likes: true, comments: true, photoRequests: true,
      },
    };
    this.initialized = true;
    this.registerSocketListeners();
    this.getNotifications();
  }

  // --- Register Listeners (ensure event names match server) ---
  registerSocketListeners() {
    if (!socketService.socket) {
      console.warn("NotificationService: Socket not ready.");
      return;
    }
    // Clean up old listeners
    const events = [
      "newMessage", "incomingCall", "newStory", "newLike",
      "photo_permission_request", "photo_permission_response", // Old ones to remove
      "newComment", "notification",
      "photoPermissionRequestReceived", "photoPermissionResponseReceived" // New ones
    ];
    events.forEach(event => socketService.socket.off(event));

    // --- Register Event Handlers ---
    socketService.socket.on("newMessage", (data) => {
      if (this.shouldShowNotification("messages") && data) {
         this.addNotification({/* ... message data ... */ _id: data._id || `msg-${Date.now()}` });
      }
    });
     socketService.socket.on("incomingCall", (data) => {
       if (this.shouldShowNotification("calls") && data) {
          this.addNotification({/* ... call data ... */ _id: data.callId || `call-${Date.now()}` });
       }
     });
     socketService.socket.on("newStory", (data) => {
       if (this.shouldShowNotification("stories") && data) {
          this.addNotification({/* ... story data ... */ _id: data._id || `story-${Date.now()}` });
       }
     });
     socketService.socket.on("newLike", (data) => {
       if (this.shouldShowNotification("likes") && data) {
         this.addNotification({/* ... like data ... */ _id: data._id || `like-${Date.now()}` });
       }
     });
     // NEW Photo Permission Request Listener
     socketService.socket.on("photoPermissionRequestReceived", (data) => {
       if (this.shouldShowNotification("photoRequests") && data) {
         const requesterNickname = data.requester?.nickname || "Someone";
         this.addNotification({
           _id: data.permissionId || `permReq-${Date.now()}`, type: "photoRequest",
           title: `${requesterNickname} requested photo access`,
           message: "Click to review", time: "Just now", read: false,
           sender: data.requester, data: data,
           createdAt: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
         });
       }
     });
     // NEW Photo Permission Response Listener
     socketService.socket.on("photoPermissionResponseReceived", (data) => {
       if (this.shouldShowNotification("photoRequests") && data) {
         const ownerNickname = data.owner?.nickname || "Someone";
         const action = data.status === "approved" ? "approved" : "rejected";
         this.addNotification({
           _id: data.permissionId || `permRes-${Date.now()}`, type: "photoResponse",
           title: `${ownerNickname} ${action} your request`,
           message: data.status === "approved" ? "You can now view their photo." : "Request declined.",
           time: "Just now", read: false, sender: data.owner, data: data,
           createdAt: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
         });
         window.dispatchEvent(new CustomEvent('permissionStatusUpdated', { detail: { photoId: data.photoId, status: data.status } }));
       }
     });
      socketService.socket.on("newComment", (data) => {
        if (this.shouldShowNotification("comments") && data) {
           this.addNotification({/* ... comment data ... */ _id: data._id || `comment-${Date.now()}` });
        }
      });
      socketService.socket.on("notification", (data) => {
        if (data?.type && this.shouldShowNotification(data.type)) {
           this.addNotification(data);
        }
      });
  }

  // --- Other methods (shouldShowNotification, isValidNotification, sanitizeNotification, addNotification, showToast) ---
  // (Keep these methods as they were in the previous correct version)
   shouldShowNotification(notificationType) {
       if (!this.initialized || !this.userSettings) return true;
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
       return sanitized;
   }
    addNotification(notification) {
       const sanitizedNotification = this.sanitizeNotification(notification);
       if (!sanitizedNotification || !this.isValidNotification(sanitizedNotification)) {
           console.warn("Skipping invalid notification:", notification); return;
       }
       const existingIndex = this.notifications.findIndex(n => (n._id && n._id === sanitizedNotification._id) || (n.id && n.id === sanitizedNotification.id));
       if (existingIndex !== -1) return;
       this.notifications.unshift(sanitizedNotification);
       if (!sanitizedNotification.read) this.unreadCount++;
       this.showToast(sanitizedNotification);
       this.notifyListeners();
       window.dispatchEvent(new CustomEvent("newNotification", { detail: sanitizedNotification }));
   }
    showToast(notification) {
       const toastOptions = { onClick: () => this.handleNotificationClick(notification), autoClose: 5000, /* ... other options */ };
       const title = notification.title || notification.message || "New Notification";
       const message = (notification.message && notification.message !== title) ? notification.message : "";
       toast(
           <div className="notification-content">
               <div className="notification-title">{title}</div>
               {message && <div className="notification-message">{message}</div>}
           </div>, toastOptions
       );
   }


  // --- Handle Click (Updated Navigation Logic) ---
   handleNotificationClick(notification) {
       if (!notification) return;
       console.log("Handling click for notification:", notification);
       if (!notification.read) this.markAsRead(notification._id || notification.id);

       if (!this.navigate) {
           console.warn("Navigate function not set in NotificationService.");
           window.dispatchEvent(new CustomEvent("notificationClicked", { detail: notification }));
           return;
       }
       try {
           if (notification.type === "message") {
               const partnerId = notification.sender?._id || notification.data?.sender?._id;
               if (partnerId) this.navigate(`/messages/${partnerId}`);
               else this.navigate(`/messages`);
           } else if (notification.type === "like") {
               const senderId = notification.sender?._id;
               if (senderId) this.navigate(`/user/${senderId}`);
               else this.navigate(`/matches`);
           } else if (notification.type === "photoRequest") {
               this.navigate(`/settings?tab=privacy`); // Navigate to settings or a specific requests view
           } else if (notification.type === "photoResponse") {
               const ownerId = notification.sender?._id;
               if (ownerId) this.navigate(`/user/${ownerId}`);
               else this.navigate('/dashboard');
           } else if (notification.type === "story") {
               const storyId = notification.data?.storyId || notification._id;
               if (storyId) window.dispatchEvent(new CustomEvent("viewStory", { detail: { storyId } }));
               else this.navigate('/dashboard');
           } else if (notification.type === "comment") {
              const contentRef = notification.data?.referenceId || notification.data?.postId;
              // Example: if (contentRef) this.navigate(`/post/${contentRef}`); else this.navigate('/dashboard');
              this.navigate('/dashboard');
           } else {
               this.navigate("/dashboard");
           }
       } catch (error) {
           console.error("Error during navigation:", error);
           this.navigate("/dashboard");
       }
       document.querySelectorAll(".notification-dropdown").forEach((dropdown) => {
           if (dropdown instanceof HTMLElement) dropdown.style.display = "none";
       });
   }

  // --- Mark Read Methods (Keep as before) ---
   markAsRead(notificationId) {
       if (!notificationId) return;
       const index = this.notifications.findIndex(n => (n._id && n._id === notificationId) || (n.id && n.id === notificationId));
       if (index === -1 || this.notifications[index].read) return;
       const updatedNotifications = [ ...this.notifications ];
       updatedNotifications[index] = { ...updatedNotifications[index], read: true };
       this.notifications = updatedNotifications;
       this.unreadCount = Math.max(0, this.unreadCount - 1);
       this.notifyListeners();
       if (notificationId && /^[0-9a-fA-F]{24}$/.test(notificationId)) {
           apiService.put("/notifications/read", { ids: [notificationId] }).catch(() => {
               apiService.put(`/notifications/${notificationId}/read`).catch(err => console.warn(`Failed backend markAsRead for ${notificationId}:`, err));
           });
       }
   }
    markAllAsRead() {
       if (this.unreadCount === 0) return;
       this.notifications = this.notifications.map(n => ({ ...n, read: true }));
       this.unreadCount = 0;
       this.notifyListeners();
       const realIds = this.notifications.map(n => n._id || n.id).filter(id => id && /^[0-9a-fA-F]{24}$/.test(id));
       if (realIds.length > 0) {
           apiService.put("/notifications/read-all").catch(() => {
               apiService.put("/notifications/read", { ids: realIds }).catch(err => console.warn("Failed backend markAllAsRead:", err));
           });
       }
   }

  // --- Get Notifications (Keep as before) ---
  async getNotifications(options = {}) {
    try {
      const response = await apiService.get("/notifications", options);
      if (response.success && Array.isArray(response.data)) {
        const validNotifications = response.data
          .map(n => this.sanitizeNotification(n))
          .filter(n => this.isValidNotification(n));
        this.notifications = validNotifications;
        this.unreadCount = validNotifications.filter(n => !n.read).length;
        this.notifyListeners();
        return this.notifications;
      }
       this.notifications = []; this.unreadCount = 0; this.notifyListeners(); return [];
    } catch (error) {
      console.error("Error fetching notifications API:", error);
      this.notifications = []; this.unreadCount = 0; this.notifyListeners(); return [];
    }
  }

  // --- Update Settings, Add Listener, Notify Listeners (Keep as before) ---
  updateSettings(settings) {
    this.userSettings = { ...this.userSettings, notifications: settings };
     // Optional: Persist settings via settingsService
  }
  addListener(listener) {
     if (typeof listener !== 'function') return () => {};
     this.listeners.push(listener);
     return () => { this.listeners = this.listeners.filter(l => l !== listener); };
   }
  notifyListeners() {
     const data = { notifications: [...this.notifications], unreadCount: this.unreadCount };
     this.listeners.forEach(listener => {
       try { listener(data); } catch (err) { console.error("Notify listener error:", err); }
     });
   }

   // --- Add Test Notification (Keep as before) ---
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
         read: false, createdAt: new Date().toISOString(),
       };
       this.addNotification(newNotification);
   }
}

// --- Define the Hook outside the class ---
export const useInitializeNotificationServiceNavigation = () => {
    const navigate = useNavigate(); // Get navigate function from router context

    // useEffect hook runs once when a component using this hook mounts
    useEffect(() => {
        // Pass the navigate function to the singleton service instance
        notificationServiceInstance.setNavigate(navigate);
        console.log("NotificationService navigation initialized.");

        // Optional: Cleanup if needed, though likely not necessary for a singleton's navigate function
        // return () => { notificationServiceInstance.setNavigate(null); };
    }, [navigate]); // Re-run only if navigate function instance changes (rare)
};


// --- Export the Singleton Instance ---
const notificationServiceInstance = new NotificationService();
export default notificationServiceInstance; // Default export is the instance
