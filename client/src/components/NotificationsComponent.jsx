import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  FaBell,
  FaTimes,
  // FaTrash, // Removed as per no-deletion requirement
  FaCheck,
  FaFilter,
  FaEnvelope,
  FaHeart,
  FaCamera,
  FaImage,
  FaComment,
  FaPhone,
  FaSyncAlt,
} from "react-icons/fa";
import { useNotifications } from "../context/NotificationContext"; // Corrected path assuming standard structure
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next"; // Add translation hook

// Import common components
import { Button, LoadingSpinner } from "./common"; // Assuming path is correct
// Import hooks and utilities
import { useApi } from "../hooks/useApi"; // Assuming path is correct
// import { useMounted } from "../hooks/useMounted"; // REMOVED - File doesn't exist
import { formatDate, logger } from "../utils"; // Assuming path is correct
// Keep direct import for socket service since it requires global state interaction / direct listening
import socketService from "../services/socketService"; // Assuming path is correct

// Create contextual logger
const log = logger.create('NotificationsComponent');

// BroadcastChannel for cross-tab synchronization (optional, depends on browser support)
let notificationChannel;
try {
  notificationChannel = new BroadcastChannel("notifications_sync");
  log.info("BroadcastChannel API available for cross-tab sync.");
} catch (e) {
  log.warn("BroadcastChannel not supported in this browser. Cross-tab sync disabled.");
  notificationChannel = null; // Ensure it's null if not supported
}

/**
 * Represents an individual notification item.
 * Memoized for performance optimization.
 */
const NotificationItem = React.memo(({ notification, onClick }) => {
  // ... (NotificationItem implementation remains the same) ...

  // Get sender nickname function (could be moved to utils)
  const getSenderNickname = (notif) => {
    return (
      notif.sender?.nickname ||
      notif.data?.sender?.nickname ||
      notif.data?.requester?.nickname ||
      notif.data?.owner?.nickname ||
      notif.data?.user?.nickname ||
      "Someone"
    );
  };

  // Get icon function (could be moved to utils)
  const getNotificationIcon = (type) => {
    switch (type) {
      case "message": return FaEnvelope;
      case "like": case "match": return FaHeart;
      case "photoRequest": case "photoResponse": return FaCamera;
      case "story": return FaImage;
      case "comment": return FaComment;
      case "call": return FaPhone;
      default: return FaBell;
    }
  };

  // Get action text function (could be moved to utils)
   const getNotificationAction = (notif) => {
    switch (notif.type) {
      case "message":
        return notif.count > 1 ? `sent you ${notif.count} messages` : "sent you a message";
      case "like":
        return "liked your profile";
      case "match":
        return "matched with you";
      case "photoRequest":
        return "requested access to your photo";
      case "photoResponse":
        const status = notif.data?.status || "";
        return status === "approved" ? "approved your photo request" : "declined your photo request";
      case "story":
        return notif.count > 1 ? `shared ${notif.count} new stories` : "shared a new story";
      case "comment":
        return notif.count > 1 ? `left ${notif.count} comments on your post` : "commented on your post";
      case "call":
        return "called you";
      default:
        return "sent a notification";
    }
  };


  if (!notification) {
    log.warn("NotificationItem received null notification prop.");
    return null;
  }

  const NotificationIcon = getNotificationIcon(notification.type);
  const formattedTime = formatDate(notification.createdAt, { showRelative: true, showTime: false, showDate: false });
  const count = notification.count > 1 ? notification.count : null;
  const senderNickname = getSenderNickname(notification);
  const actionText = getNotificationAction(notification);


  const onClickHandler = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    log.debug("Notification item clicked:", notification.id);
    if (onClick) {
      onClick(notification);
    }
  }, [notification, onClick]);


  if (!notification.id || !notification.type || !notification.createdAt) {
      log.error("Rendering NotificationItem with invalid data:", notification);
      return <div className="notification-item error">Invalid notification data</div>;
  }

  return (
    <div
      className={`notification-item ${!notification.read ? "unread" : ""}`}
      onClick={onClickHandler}
      role="listitem"
      aria-labelledby={`notification-title-${notification.id}`}
      aria-describedby={`notification-desc-${notification.id}`}
    >
      <div className="notification-icon" aria-hidden="true">
        <NotificationIcon />
      </div>

      <div className="notification-content">
        <div className="notification-title" id={`notification-title-${notification.id}`}>
          <span className="notification-sender">{senderNickname}</span> {actionText}
          {count && <span className="notification-count"> ({count})</span>}
        </div>

        <div className="notification-message" id={`notification-desc-${notification.id}`}>
          {notification.message || notification.content || notification.title || ""}
        </div>

        <div className="notification-time">
          {formattedTime}
          {!notification.read && <span className="notification-status">•&nbsp;New</span>}
        </div>
      </div>
    </div>
  );
});
NotificationItem.displayName = 'NotificationItem';

/**
 * Main component for displaying notifications list, handling filters, refresh, and real-time updates.
 */
const NotificationsComponent = ({
  showHeader = true,
  showFilters = true,
  isDropdown = false,
  isMobile = false,
  onClose,
  maxHeight = 400,
  className = "",
  style = {},
  customFilters = null,
}) => {
  const { t } = useTranslation(); // Initialize translation function
  
  const {
    notifications,
    unreadCount,
    loading: loadingNotifications,
    socketConnected,
    markAllAsRead: contextMarkAllAsRead,
    addTestNotification: contextAddTestNotification,
    handleNotificationClick: contextHandleClick,
    fetchNotifications: contextRefreshNotifications,
  } = useNotifications();

  const [activeFilter, setActiveFilter] = useState("all");
  const [filteredNotifications, setFilteredNotifications] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visibilityState, setVisibilityState] = useState(() =>
    typeof document !== "undefined" ? document.visibilityState : "visible"
  );

  // const api = useApi(); // Removed as handleClearAll is removed
  // const { isMounted } = useMounted(); // REMOVED

  const listRef = useRef(null);
  const lastRefreshRef = useRef(Date.now());
  const refreshTimeoutRef = useRef(null);
  const componentIsMounted = useRef(true); // Use a simple ref for mounted state check

  // --- Effects ---

  // Set mounted ref
  useEffect(() => {
    componentIsMounted.current = true;
    return () => {
        componentIsMounted.current = false;
    };
  }, []);


  // Handle visibility change
  useEffect(() => {
    // ... (visibility effect remains the same) ...
     const handleVisibilityChange = () => {
      if (typeof document === "undefined") return; // Guard for SSR or environments without document

      const newState = document.visibilityState;
      log.debug("Document visibility changed:", newState);
      setVisibilityState(newState);

      // If becoming visible and it's been > 30s since last refresh, trigger refresh
      if (newState === "visible" && Date.now() - lastRefreshRef.current > 30000) {
        log.info("Tab became visible after >30s, refreshing notifications.");
        contextRefreshNotifications();
        lastRefreshRef.current = Date.now();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }
  }, [contextRefreshNotifications]);

  // Handle cross-tab synchronization
  useEffect(() => {
    // ... (cross-tab sync effect remains the same) ...
    const handleCrossTabSync = (event) => {
      if (!event?.data) return;
      const { type, data } = event.data;
      log.debug("Received cross-tab message:", type, data);

      // Refresh list if another tab received/read notifications
      if (type === "NOTIFICATION_READ" || type === "NOTIFICATION_RECEIVED" || type === "NOTIFICATIONS_CLEARED") {
        log.info(`Cross-tab sync (${type}), refreshing notifications.`);
        contextRefreshNotifications();
      }
    };

    if (notificationChannel) {
      notificationChannel.addEventListener("message", handleCrossTabSync);
      return () => {
        notificationChannel.removeEventListener("message", handleCrossTabSync);
      };
    }
  }, [contextRefreshNotifications]);

  // Handle direct socket events
  useEffect(() => {
    // ... (direct socket event effect remains the same) ...
     const handleDirectNotification = (data) => {
      log.debug("⚡ DIRECT socket notification received in COMPONENT:", data);
      // This provides near real-time feedback, context might have slight delay
      contextRefreshNotifications(); // Refresh immediately
      lastRefreshRef.current = Date.now();

      // Broadcast to other tabs that a notification was received
      if (notificationChannel) {
        notificationChannel.postMessage({ type: "NOTIFICATION_RECEIVED", data });
      }
    };

    // Ensure socketService and socket exist before attaching listeners
    if (socketService?.socket) {
      log.debug("📱 Attaching direct socket event listeners in NotificationsComponent.");
      const events = [
        "notification", "newMessage", "newLike", "photoPermissionRequestReceived",
        "photoPermissionResponseReceived", "newComment", "incomingCall"
      ];
      events.forEach(event => socketService.socket.on(event, handleDirectNotification));

      // Check initial connection state
      log.debug("Direct socket check - Connected:", socketService.isConnected());
      log.debug("Direct socket check - ID:", socketService.socket.id);

      // Cleanup listeners on unmount
      return () => {
        log.debug("🧹 Cleaning up direct socket listeners in NotificationsComponent.");
        if (socketService.socket) {
            events.forEach(event => socketService.socket.off(event, handleDirectNotification));
        }
        // Clear any pending polling timeouts
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }
      };
    } else {
        log.warn("Socket service or socket instance not available for direct listeners.");
    }
  }, [contextRefreshNotifications]);

  // Polling fallback mechanism
  const previousConnectedRef = useRef(socketConnected);
  useEffect(() => {
    // ... (polling effect, check componentIsMounted.current instead of isMounted()) ...
    log.debug(`Socket connection state changed. Previous: ${previousConnectedRef.current}, Current: ${socketConnected}`);

    // If socket just disconnected, start polling
    if (!socketConnected && previousConnectedRef.current) {
      log.warn("Socket disconnected. Initiating polling fallback.");
      const pollInterval = 60000; // Poll every 60 seconds

      const pollForUpdates = () => {
        // Only poll if component is still mounted and socket is *still* disconnected
        if (componentIsMounted.current && !socketService.isConnected()) { // Check ref
          log.debug(`Polling for notifications (socket disconnected).`);
          contextRefreshNotifications();
          lastRefreshRef.current = Date.now();
          // Schedule next poll
          refreshTimeoutRef.current = setTimeout(pollForUpdates, pollInterval);
        } else {
          log.info("Polling stopped (component unmounted or socket reconnected).");
          // Clear timeout if it exists and polling is stopped
           if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
            refreshTimeoutRef.current = null;
          }
        }
      };
      // Start polling after a short delay
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current); // Clear previous before setting new
      refreshTimeoutRef.current = setTimeout(pollForUpdates, 5000);
    }

    // If socket just reconnected, ensure polling stops and refresh
    if (socketConnected && !previousConnectedRef.current) {
      log.info("Socket reconnected. Stopping any active polling and refreshing.");
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      contextRefreshNotifications();
      lastRefreshRef.current = Date.now();
    }

    // Update previous connection state ref
    previousConnectedRef.current = socketConnected;

    // Cleanup polling timer on unmount or when socket connects
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [socketConnected, contextRefreshNotifications]); // Removed isMounted from dependencies

  // Scroll to top
  const prevNotificationsLength = useRef(notifications?.length || 0);
  useEffect(() => {
    // ... (scroll effect remains the same) ...
     const currentLength = notifications?.length || 0;
    if (currentLength > prevNotificationsLength.current && listRef.current) {
      log.debug("New notifications detected, scrolling list to top.");
      listRef.current.scrollTop = 0;
    }
    prevNotificationsLength.current = currentLength;
  }, [notifications]);

  // Filter notifications
  useEffect(() => {
    // ... (filter effect remains the same) ...
     if (!notifications) {
      setFilteredNotifications([]);
      return;
    }
    log.debug(`Filtering notifications. Count: ${notifications.length}, Filter: ${activeFilter}`);

    let filtered = [...notifications]; // Create a mutable copy

    // Apply type filter
    if (activeFilter !== "all") {
      if (activeFilter === "unread") {
        filtered = filtered.filter((n) => !n.read);
      } else {
        // Handle potential variations like 'photoRequest'/'photoResponse' both mapping to 'Photos' filter
        const filterTypeMap = {
            'Photos': ['photoRequest', 'photoResponse'],
            'Likes': ['like', 'match'],
            'Messages': ['message']
            // Add other mappings as needed based on filter labels
        };
        const typesToFilter = filterTypeMap[activeFilter] || [activeFilter]; // Fallback to direct match
        filtered = filtered.filter((n) => typesToFilter.includes(n.type));
      }
    }

    // Optional: Grouping similar notifications (Example: multiple likes from same user)
    // This adds complexity, enable if required by UX. Kept original logic here.
    const groupedNotifications = [];
    const notificationGroups = {};

    filtered.forEach((notification) => {
        const senderId = notification.sender?.id || notification.data?.sender?.id || notification.data?.requester?.id || "unknown_sender";
        // Use a more specific group key if needed, e.g., include date range
        const groupKey = `${senderId}_${notification.type}`;

        if (!notificationGroups[groupKey]) {
            notificationGroups[groupKey] = {
            ...notification,
            count: 1, // Initialize count
            originalItems: [notification], // Store original items if needed later
            };
        } else {
            // Increment count and update timestamp to the latest one
            notificationGroups[groupKey].count += 1;
            notificationGroups[groupKey].originalItems.push(notification);
            if (new Date(notification.createdAt) > new Date(notificationGroups[groupKey].createdAt)) {
                notificationGroups[groupKey].createdAt = notification.createdAt;
                // Optionally update other fields like message based on the latest item
            }
        }
    });

    // Convert grouped map back to an array
    Object.values(notificationGroups).forEach(group => groupedNotifications.push(group));

    // Sort the final list by creation date (newest first)
    groupedNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    setFilteredNotifications(groupedNotifications);
    log.debug(`Filtered notifications count: ${groupedNotifications.length}`);
  }, [notifications, activeFilter]);


  // --- Event Handlers ---

  // Handle manual refresh
  const handleRefresh = useCallback(async (e) => {
    // ... (handler, check componentIsMounted.current instead of isMounted()) ...
     if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isRefreshing) return; // Prevent multiple refresh calls

    log.info("Manual refresh triggered.");
    setIsRefreshing(true);
    try {
      await contextRefreshNotifications();
      lastRefreshRef.current = Date.now();
      toast.success("Notifications refreshed!");
    } catch (error) {
      log.error("Failed to refresh notifications:", error);
      toast.error("Could not refresh notifications. Please try again.");
    } finally {
      // Ensure state is updated only if component is still mounted
      // Add a small delay to prevent button flickering
      setTimeout(() => {
        if (componentIsMounted.current) { // Check ref
          setIsRefreshing(false);
        }
      }, 300);
    }
  }, [contextRefreshNotifications, isRefreshing]); // Removed isMounted dependency

  // Handle filter change
  const handleFilterChange = useCallback((filter) => {
    // ... (handler remains the same) ...
    log.debug("Filter changed to:", filter);
    setActiveFilter(filter);
    // Scroll list to top when filter changes
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, []);

  // Handle mark all as read
  const handleMarkAllAsRead = useCallback((e) => {
    // ... (handler remains the same) ...
     if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    log.info("Marking all notifications as read.");
    contextMarkAllAsRead(); // Call the context function

    // Broadcast to other tabs
    if (notificationChannel) {
      notificationChannel.postMessage({ type: "NOTIFICATION_READ", data: { all: true } });
    }
    toast.success("All notifications marked as read.");
  }, [contextMarkAllAsRead]);

  // Handle notification click
  const handleNotificationClick = useCallback((notification) => {
    // ... (handler remains the same) ...
     log.debug("Handling click for notification:", notification.id);
    contextHandleClick(notification); // Delegate to context/service logic

    // Broadcast read status change to other tabs if it was unread
    if (!notification.read && notificationChannel) {
      notificationChannel.postMessage({ type: "NOTIFICATION_READ", data: { id: notification.id } });
    }

    // Close dropdown/modal if applicable
    if (isDropdown && onClose) {
      onClose();
    }
  }, [contextHandleClick, isDropdown, onClose]);

  // Handle add test notification
  const handleAddTestNotification = useCallback((e) => {
    // ... (handler remains the same) ...
     if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    log.info("Adding test notification.");
    contextAddTestNotification(); // Call context function
  }, [contextAddTestNotification]);

  // --- Rendering Logic ---

  // Define filter options
  const getFilterOptions = useCallback(() => {
    // ... (logic remains the same) ...
     const defaultFilters = [
      { id: "all", label: "All" },
      { id: "unread", label: "Unread" },
      { id: "Messages", label: "Messages" }, // Use consistent key for mapping
      { id: "Likes", label: "Likes" },     // Use consistent key for mapping
      { id: "Photos", label: "Photos" },   // Use consistent key for mapping
      // { id: "story", label: "Stories" }, // Original filter, adjust if needed
    ];

    // Allow customization via props
    if (customFilters && Array.isArray(customFilters)) {
      // Filter default options based on customFilters array provided
      return defaultFilters.filter(filter => customFilters.includes(filter.id));
    }
    return defaultFilters;
  }, [customFilters]);

  // Render filter buttons
  const renderFilterButtons = () => {
    // ... (render logic remains the same) ...
     const filters = getFilterOptions();
    return (
      <div className="notification-filters" role="tablist" aria-label="Notification Filters">
        {filters.map((filter) => (
          <Button
            key={filter.id}
            className={`filter-btn ${activeFilter === filter.id ? "active" : ""}`}
            onClick={() => handleFilterChange(filter.id)}
            variant={activeFilter === filter.id ? "primary" : "secondary"} // Changed from outline to secondary
            size="small"
            role="tab"
            aria-selected={activeFilter === filter.id}
            aria-controls="notification-list-panel" // Associate with the list panel
          >
            {filter.label}
          </Button>
        ))}
      </div>
    );
  };

  // Render loading state
  if (loadingNotifications && notifications?.length === 0) {
    // ... (render logic remains the same) ...
     return (
      <div className={`notification-loading ${className}`} style={style}>
        <LoadingSpinner size="medium" text={t('notifications.loading', 'Loading notifications...')} centered />
      </div>
    );
  }

  // Render empty state
  if (!filteredNotifications || filteredNotifications.length === 0) {
    // ... (render logic remains the same) ...
     return (
      <div className={`notification-empty ${className}`} style={style}>
        <FaBell size={32} aria-hidden="true" />
        <p>
          {activeFilter === 'unread' ? t('notifications.noUnreadNotifications', 'No unread notifications') :
           activeFilter === 'all' ? t('notifications.noNotifications', 'No notifications yet') :
           t('notifications.noFilteredNotifications', 'No {{filter}} notifications', {filter: activeFilter.toLowerCase()})}
        </p>
        <div className="notification-empty-actions">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            isLoading={isRefreshing}
            variant="secondary"
            size="small"
            icon={<FaSyncAlt />}
          >
            {isRefreshing ? t('notifications.refreshing', 'Refreshing...') : t('notifications.refresh', 'Refresh')}
          </Button>
          {/* Optionally show add test button in dev environments */}
          {process.env.NODE_ENV === 'development' && (
              <Button
                onClick={handleAddTestNotification}
                variant="primary"
                size="small"
                className="mt-3 ml-2" // Original classes
              >
                Add Test
              </Button>
          )}
        </div>
        {/* Display connection status if disconnected */}
        {!socketConnected && (
          <div className="notification-connection-status">
             <div className="connection-info"> {/* Wrapper for icon and text */}
                <span className="connection-dot disconnected" title="Disconnected"></span>
                <small>{t('notifications.updatesPaused', 'Real-time updates paused')}</small>
            </div>
            <Button
              onClick={() => {
                log.info("Manual reconnect attempt triggered.");
                if (socketService?.reconnect) {
                  socketService.reconnect();
                  toast.info("Attempting to reconnect...");
                } else {
                    toast.warn("Reconnect function not available.");
                }
              }}
              variant="link" // Use link style for less emphasis
              size="small" // Smallest available size
              icon={<FaSyncAlt />}
              className="reconnect-btn"
              title="Attempt to reconnect"
            >
              {t('notifications.reconnect', 'Reconnect')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Render the main notification list
  return (
    // ... (main return structure remains the same) ...
     <div className={`notification-container ${className}`} style={style} role="region" aria-label="Notifications">
      {/* Header Section */}
      {showHeader && (
        <div className="notification-header">
          <div className="notification-header-title">
            <span>{t('notifications.title', 'Notifications')}</span>
            {activeFilter !== "all" && <span className="notification-filter-indicator">({activeFilter})</span>}
            {/* Connection Status Indicator */}
            <div className="notification-connection-indicator" title={socketConnected ? "Real-time connection active" : "Disconnected - Updates via polling"}>
              <span className={`connection-dot ${socketConnected ? "connected" : "disconnected"}`}></span>
              {!socketConnected && <small className="connection-status-text">{t('notifications.offline', 'Offline')}</small>}
            </div>
          </div>
          <div className="notification-header-actions">
            {/* Refresh Button */}
            <Button
              className="notification-header-action"
              onClick={handleRefresh}
              title="Refresh notifications"
              variant="link"
              size="small"
              icon={<FaSyncAlt className={isRefreshing ? "spin" : ""} />}
              disabled={isRefreshing}
              aria-label="Refresh notifications"
            >
              {t('notifications.refresh', 'Refresh')}
            </Button>
            {/* Mark All Read Button */}
            {unreadCount > 0 && (
              <Button
                className="notification-header-action"
                onClick={handleMarkAllAsRead}
                variant="link"
                size="small"
                title="Mark all notifications as read"
                aria-label={`Mark all ${unreadCount} as read`} // More specific label
              >
                {t('notifications.markAllRead', 'Mark all read')} ({unreadCount})
              </Button>
            )}
            {/* No "Clear All" button as per requirement */}
            {/* Close Button (for dropdowns) */}
            {isDropdown && onClose && (
              <Button
                className="notification-close-btn"
                onClick={onClose}
                variant="secondary" // Changed from ghost to secondary
                size="small"
                icon={<FaTimes />}
                aria-label="Close notifications"
              >
                {t('common.close', 'Close')}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Filter Buttons (conditionally rendered based on props) */}
      {showFilters && !isMobile && renderFilterButtons()}

      {/* Notification List */}
      <div
        ref={listRef}
        className="notification-list"
        style={{ maxHeight: `${maxHeight}px` }}
        role="list" // Changed from tabpanel to list as filters control content, not tabs
        id="notification-list-panel" // ID for aria-controls
        aria-live="polite" // Announce changes politely
      >
        {filteredNotifications.map((notification) => (
          <NotificationItem
            // Use a stable key, preferably notification.id
            key={notification.id || `notification-${Math.random()}`}
            notification={notification}
            onClick={handleNotificationClick}
          />
        ))}
      </div>

      {/* Filters at Footer (for mobile) */}
      {showFilters && isMobile && <div className="notification-footer">{renderFilterButtons()}</div>}
    </div>
  );
};

export default NotificationsComponent;
