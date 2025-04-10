"use client"

import { useState, useEffect, useRef } from "react"
import {
  FaBell,
  FaTimes,
  FaTrash,
  FaCheck,
  FaFilter,
  FaEnvelope,
  FaHeart,
  FaCamera,
  FaImage,
  FaComment,
  FaPhone,
  FaSyncAlt,
} from "react-icons/fa"
import { useNotifications } from "../context"
import { toast } from "react-toastify"

// Import common components 
import { Button, LoadingSpinner } from "./common"
// Import hooks and utilities
import { useApi, useMounted } from "../hooks"
import { formatDate, logger } from "../utils"
// Keep direct import for socket service since it requires global state
import socketService from "../services/socketService"

// Create contextual logger
const log = logger.create('NotificationsComponent')

// BroadcastChannel for cross-tab synchronization
let notificationChannel
try {
  notificationChannel = new BroadcastChannel("notifications_sync")
} catch (e) {
  log.warn("BroadcastChannel not supported in this browser")
}

/**
 * Comprehensive notifications component that combines both list and item display
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
  const {
    notifications,
    unreadCount,
    isLoading: loadingNotifications,
    socketConnected,
    markAllAsRead,
    addTestNotification,
    handleNotificationClick: contextHandleClick,
    refreshNotifications,
  } = useNotifications()

  const [activeFilter, setActiveFilter] = useState("all")
  const [filteredNotifications, setFilteredNotifications] = useState([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [visibilityState, setVisibilityState] = useState(document.visibilityState)
  
  const api = useApi()
  const { isMounted } = useMounted()
  const listRef = useRef(null)
  const lastRefreshRef = useRef(Date.now())
  const refreshTimeoutRef = useRef(null)

  // Handle visibility change for tab switching
  useEffect(() => {
    const handleVisibilityChange = () => {
      const newState = document.visibilityState
      setVisibilityState(newState)

      // If becoming visible and it's been more than 30 seconds since last refresh
      if (newState === "visible" && Date.now() - lastRefreshRef.current > 30000) {
        refreshNotifications()
        lastRefreshRef.current = Date.now()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [refreshNotifications])

  // Setup cross-tab synchronization
  useEffect(() => {
    const handleCrossTabSync = (event) => {
      const { type, data } = event.data || {}

      if (type === "NOTIFICATION_READ" || type === "NOTIFICATION_RECEIVED") {
        refreshNotifications()
      }
    }

    if (notificationChannel) {
      notificationChannel.addEventListener("message", handleCrossTabSync)
    }

    return () => {
      if (notificationChannel) {
        notificationChannel.removeEventListener("message", handleCrossTabSync)
      }
    }
  }, [refreshNotifications])

  // Direct socket connection for real-time notifications
  useEffect(() => {
    // Setup direct socket event listener for immediate updates
    const handleDirectNotification = (data) => {
      log.debug("⚡ DIRECT NOTIFICATION RECEIVED IN COMPONENT:", data)

      // Force refresh immediately
      refreshNotifications()
      lastRefreshRef.current = Date.now()

      // Broadcast to other tabs
      if (notificationChannel) {
        notificationChannel.postMessage({
          type: "NOTIFICATION_RECEIVED",
          data,
        })
      }
    }
    
    // Setup socket connection/disconnection handlers
    const handleSocketConnect = () => {
      log.debug("Socket connected in component handler")
      // Update our local state immediately, don't wait for context
      setConnectionState("connected")
    }
    
    const handleSocketDisconnect = () => {
      log.debug("Socket disconnected in component handler")
      // Update our local state immediately, don't wait for context
      setConnectionState("disconnected")
    }

    // Function to attach socket event listeners
    const attachSocketListeners = () => {
      if (socketService.socket) {
        log.debug("📱 Setting up direct socket handlers in NotificationsComponent")

        // Listen for all types of notification events
        socketService.socket.on("notification", handleDirectNotification)
        socketService.socket.on("newMessage", handleDirectNotification)
        socketService.socket.on("newLike", handleDirectNotification)
        socketService.socket.on("photoPermissionRequestReceived", handleDirectNotification)
        socketService.socket.on("photoPermissionResponseReceived", handleDirectNotification)
        socketService.socket.on("newComment", handleDirectNotification)
        socketService.socket.on("incomingCall", handleDirectNotification)
        
        // Add connection state handlers
        socketService.socket.on("connect", handleSocketConnect)
        socketService.socket.on("disconnect", handleSocketDisconnect)

        // Test the socket connection by logging its state
        const isConnected = socketService.isConnected()
        log.debug("Socket connected:", isConnected)
        log.debug("Socket ID:", socketService.socket.id)
        
        // Make sure our local state reflects reality
        setConnectionState(isConnected ? "connected" : "disconnected")
      }
    }
    
    // Initial attachment
    attachSocketListeners()
    
    return () => {
      if (socketService.socket) {
        socketService.socket.off("notification", handleDirectNotification)
        socketService.socket.off("newMessage", handleDirectNotification)
        socketService.socket.off("newLike", handleDirectNotification)
        socketService.socket.off("photoPermissionRequestReceived", handleDirectNotification)
        socketService.socket.off("photoPermissionResponseReceived", handleDirectNotification)
        socketService.socket.off("newComment", handleDirectNotification)
        socketService.socket.off("incomingCall", handleDirectNotification)
        socketService.socket.off("connect", handleSocketConnect)
        socketService.socket.off("disconnect", handleSocketDisconnect)
      }

      // Clear any pending refresh timeouts
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [refreshNotifications])

  // Create a ref to store the previous connection state that persists between renders
  const previousConnectedRef = useRef(socketConnected);
  
  // Add a connection state flag to avoid false disconnection messages
  const [connectionState, setConnectionState] = useState(socketConnected ? "connected" : "disconnected");
  
  // Force socket check on component mount with improved synchronization and troubleshooting
  useEffect(() => {
    // Check actual socket connection status directly
    const checkSocketStatus = async () => {
      try {
        console.log(`[Notifications] Checking socket status - context says: ${socketConnected}`);
        
        if (socketService) {
          console.log(`[Notifications] SocketService exists: ${!!socketService}`);
          
          if (socketService.socket) {
            console.log(`[Notifications] Socket object exists with ID: ${socketService.socket.id || 'none'}`);
            
            // Get real connection status from the socket service using multiple checks
            const isActuallyConnected = socketService.isConnected();
            const socketDirectConnected = socketService.socket.connected;
            
            console.log(`[Notifications] Socket status checks - isConnected(): ${isActuallyConnected}, socket.connected: ${socketDirectConnected}`);
            
            // Use either method to determine if connected
            const reallyConnected = isActuallyConnected || socketDirectConnected;
            
            // If state doesn't match reality, adjust the connection state
            if (socketConnected !== reallyConnected || connectionState !== (reallyConnected ? "connected" : "disconnected")) {
              console.log(`[Notifications] Aligning component connection state with actual socket state (${reallyConnected})`);
              setConnectionState(reallyConnected ? "connected" : "disconnected");
              
              // If we detect a connection but context doesn't know about it yet,
              // force a refresh of notifications
              if (reallyConnected && !socketConnected) {
                console.log("[Notifications] Detected socket is actually connected but context doesn't know - forcing refresh");
                setTimeout(() => {
                  refreshNotifications();
                }, 1000);
              }
            }
          } else {
            console.log(`[Notifications] SocketService exists but socket object is missing`);
            setConnectionState("disconnected");
          }
        } else {
          console.log(`[Notifications] SocketService is missing entirely`);
          setConnectionState("disconnected");
        }
      } catch (err) {
        log.error("Error checking socket status:", err);
        setConnectionState("disconnected");
      }
    };
    
    // Run check immediately
    checkSocketStatus();
    
    // Also set up a periodic check every 10 seconds to ensure connection state is accurate
    const intervalCheck = setInterval(checkSocketStatus, 10000);
    
    return () => {
      clearInterval(intervalCheck);
    };
  }, [socketConnected, refreshNotifications]);

  // Monitor socket connection status and refresh when reconnected
  useEffect(() => {
    // Always check the actual socket status instead of just relying on the context state
    const actualSocketConnected = socketService.isConnected();
    
    log.debug(`Socket connection change detected - context: ${socketConnected}, actual: ${actualSocketConnected}`);
    
    // Use the actual socket status for our component's connection state
    setConnectionState(actualSocketConnected ? "connected" : "disconnected");
    
    // Track state changes based on the actual socket status for better reliability
    const wasConnected = previousConnectedRef.current;
    
    // If socket reconnects, refresh notifications
    if (actualSocketConnected && !wasConnected) {
      log.debug("Socket reconnected - refreshing notifications");
      refreshNotifications();
      lastRefreshRef.current = Date.now();
    }

    // If socket disconnects, set up polling fallback
    if (!actualSocketConnected && wasConnected) {
      log.debug("Socket disconnected - setting up polling fallback");
      
      // Set up a polling mechanism when socket is disconnected
      const pollInterval = 60000; // 1 minute

      const pollForUpdates = () => {
        // Check the actual socket status before polling
        if (!socketService.isConnected()) {
          log.debug("Polling for notifications while socket is disconnected");
          refreshNotifications();
          lastRefreshRef.current = Date.now();

          // Only schedule next poll if socket is still disconnected
          refreshTimeoutRef.current = setTimeout(pollForUpdates, pollInterval);
        } else {
          log.debug("Socket reconnected during polling cycle, stopping poll");
          // Also update our connection state to match reality
          setConnectionState("connected");
        }
      };

      // Start polling after a short delay
      refreshTimeoutRef.current = setTimeout(pollForUpdates, 5000);
    }

    // Update the ref at the end of the effect to track the actual socket status
    previousConnectedRef.current = actualSocketConnected;

    // Clean up polling timers when component unmounts or socket reconnects
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [socketConnected, refreshNotifications])

  // Scroll to top when new notifications arrive
  const prevNotificationsLength = useRef(notifications?.length || 0)
  useEffect(() => {
    if (notifications?.length > prevNotificationsLength.current && listRef.current) {
      listRef.current.scrollTop = 0
    }
    prevNotificationsLength.current = notifications?.length || 0
  }, [notifications])

  // Handle manual refresh
  const handleRefresh = async (e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    if (isRefreshing) return

    setIsRefreshing(true)
    try {
      await refreshNotifications()
      lastRefreshRef.current = Date.now()
      toast.success("Notifications refreshed")
    } catch (error) {
      toast.error("Failed to refresh notifications")
    } finally {
      setTimeout(() => {
        if (isMounted()) {
          setIsRefreshing(false)
        }
      }, 500)
    }
  }

  // Apply filters when notifications change
  useEffect(() => {
    if (!notifications) {
      setFilteredNotifications([])
      return
    }

    let filtered = [...notifications]

    // Apply type filter
    if (activeFilter !== "all") {
      if (activeFilter === "unread") {
        filtered = filtered.filter((n) => !n.read)
      } else {
        filtered = filtered.filter((n) => n.type === activeFilter)
      }
    }

    // Group similar notifications if they're from the same sender and type
    const groupedNotifications = []
    const notificationGroups = {}

    filtered.forEach((notification) => {
      const senderId =
        notification.sender?._id || notification.data?.sender?._id || notification.data?.requester?._id || "unknown"

      const groupKey = `${senderId}_${notification.type}`

      if (!notificationGroups[groupKey]) {
        notificationGroups[groupKey] = {
          ...notification,
          count: 1,
          originalItems: [notification],
        }
      } else {
        notificationGroups[groupKey].count += 1
        notificationGroups[groupKey].originalItems.push(notification)

        // Use the most recent timestamp
        if (new Date(notification.createdAt) > new Date(notificationGroups[groupKey].createdAt)) {
          notificationGroups[groupKey].createdAt = notification.createdAt
        }
      }
    })

    // Convert groups back to array
    Object.values(notificationGroups).forEach((group) => {
      groupedNotifications.push(group)
    })

    // Sort by creation date (newest first)
    groupedNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    setFilteredNotifications(groupedNotifications)
  }, [notifications, activeFilter])

  // Handle filter change
  const handleFilterChange = (filter) => {
    setActiveFilter(filter)
  }

  // Handle clear all notifications
  const handleClearAll = async () => {
    try {
      const response = await api.delete("/notifications/clear-all")
      toast.success(`Cleared ${response?.count || 0} notifications`)
      refreshNotifications() // Refresh immediately after clearing
      lastRefreshRef.current = Date.now()
    } catch (error) {
      log.error("Error clearing notifications:", error)
      toast.error("Error clearing notifications")
    }
  }

  // Handle marking all as read
  const handleMarkAllAsRead = (e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    markAllAsRead()

    // Broadcast to other tabs
    if (notificationChannel) {
      notificationChannel.postMessage({
        type: "NOTIFICATION_READ",
        data: { all: true },
      })
    }

    toast.success("All notifications marked as read")
  }

  // Handle notification click
  const handleNotificationClick = (notification) => {
    contextHandleClick(notification)

    // Broadcast to other tabs if this was an unread notification
    if (!notification.read && notificationChannel) {
      notificationChannel.postMessage({
        type: "NOTIFICATION_READ",
        data: { id: notification._id },
      })
    }

    if (isDropdown && onClose) {
      onClose()
    }
  }

  // Handle adding a test notification
  const handleAddTestNotification = (e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    addTestNotification()
  }

  // Define filter options - either use customFilters or default filters
  const getFilterOptions = () => {
    // Default filter options
    const defaultFilters = [
      { id: "all", label: "All" },
      { id: "unread", label: "Unread" },
      { id: "message", label: "Messages" },
      { id: "like", label: "Likes" },
      { id: "photoRequest", label: "Photos" },
      { id: "story", label: "Stories" },
    ]

    // If customFilters is provided, only use those filters
    if (customFilters && Array.isArray(customFilters) && customFilters.length > 0) {
      return defaultFilters.filter((filter) => customFilters.includes(filter.id))
    }

    return defaultFilters
  }

  // Render filter buttons
  const renderFilterButtons = () => {
    const filters = getFilterOptions()

    return (
      <div className="notification-filters">
        {filters.map((filter) => (
          <Button
            key={filter.id}
            className={`filter-btn ${activeFilter === filter.id ? "active" : ""}`}
            onClick={() => handleFilterChange(filter.id)}
            variant={activeFilter === filter.id ? "primary" : "light"}
            size="small"
          >
            {filter.label}
          </Button>
        ))}
      </div>
    )
  }

  // Render loading state
  if (loadingNotifications) {
    return (
      <div className={`notification-loading ${className}`} style={style}>
        <LoadingSpinner size="medium" text="Loading notifications..." centered />
      </div>
    )
  }

  // Render empty state
  if (!filteredNotifications || filteredNotifications.length === 0) {
    return (
      <div className={`notification-empty ${className}`} style={style}>
        <FaBell size={32} />
        <p>No {activeFilter !== "all" ? `${activeFilter} ` : ""}notifications yet</p>

        <div className="notification-empty-actions">
          <Button 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            isLoading={isRefreshing}
            variant="secondary"
            size="small"
            icon={<FaSyncAlt />}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>

          {isDropdown && (
            <Button 
              onClick={handleAddTestNotification} 
              variant="primary"
              size="small"
              className="mt-3 ml-2"
            >
              Add Test Notification
            </Button>
          )}
        </div>

        {connectionState === "disconnected" && (
          <div className="notification-connection-status">
            <span className="dot disconnected"></span>
            <small>Real-time updates disconnected</small>
            <Button
              onClick={() => {
                log.debug("Manual reconnect requested");
                // Try to reconnect socket
                if (socketService && socketService.socket) {
                  socketService.reconnect();
                  toast.info("Attempting to reconnect...");
                }
              }}
              variant="secondary"
              size="small"
              icon={<FaSyncAlt />}
              className="reconnect-btn"
            >
              Reconnect
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`notification-container ${className}`} style={style}>
      {showHeader && (
        <div className="notification-header">
          <div className="notification-header-title">
            <span>Notifications</span>
            {activeFilter !== "all" && <span className="notification-filter-indicator">({activeFilter})</span>}

            {/* Connection indicator with click action to force reconnect */}
            <div 
              className="notification-connection-indicator" 
              title={connectionState === "connected" ? "Connected" : "Disconnected - Notifications will be updated via polling"}
              onClick={() => {
                if (connectionState !== "connected" && socketService) {
                  console.log("[Notifications] Manual socket reconnect requested");
                  try {
                    socketService.reconnect();
                    toast.info("Attempting to reconnect socket...");
                    setTimeout(() => refreshNotifications(), 2000);
                  } catch (e) {
                    console.error("[Notifications] Manual reconnect failed:", e);
                  }
                }
              }}
              style={{ cursor: connectionState !== "connected" ? "pointer" : "default" }}
            >
              <span className={`connection-dot ${connectionState === "connected" ? "connected" : "disconnected"}`}></span>
              {connectionState === "disconnected" && <small className="connection-status-text">Offline</small>}
            </div>
          </div>

          <div className="notification-header-actions">
            {/* Test notification button */}
            <Button 
              className="notification-header-action" 
              onClick={handleAddTestNotification} 
              title="Add test notification"
              variant="link"
              size="small"
              icon={<FaBell />}
            />
            
            {/* Refresh button */}
            <Button 
              className="notification-header-action" 
              onClick={handleRefresh} 
              title="Refresh notifications"
              variant="link"
              size="small"
              icon={<FaSyncAlt className={isRefreshing ? "spin" : ""} />}
            />

            {unreadCount > 0 && (
              <Button 
                className="notification-header-action" 
                onClick={handleMarkAllAsRead}
                variant="link"
                size="small"
              >
                Mark all read
              </Button>
            )}

            {!isDropdown && (
              <>
                <Button 
                  className="notification-header-action" 
                  onClick={() => handleFilterChange(activeFilter === "all" ? "unread" : "all")}
                  variant="link"
                  size="small"
                  icon={<FaFilter />}
                >
                  {activeFilter === "all" ? "Show unread" : "Show all"}
                </Button>

                <Button 
                  className="notification-header-action" 
                  onClick={handleClearAll}
                  variant="link"
                  size="small"
                  icon={<FaTrash />}
                >
                  Clear all
                </Button>
              </>
            )}

            {isDropdown && onClose && (
              <Button 
                className="notification-close-btn" 
                onClick={onClose}
                variant="light"
                size="small"
                icon={<FaTimes />}
                aria-label="Close notifications"
              />
            )}
          </div>
        </div>
      )}

      {showFilters && !isMobile && renderFilterButtons()}

      <div ref={listRef} className="notification-list" style={{ maxHeight: `${maxHeight}px` }}>
        {filteredNotifications.map((notification, index) => {
          // Create a stable, unique key that won't cause re-renders
          // Use a combination of fields to ensure uniqueness, falling back to index if needed
          const uniqueId = notification._id || 
                          notification.id || 
                          (notification.createdAt && notification.type ? 
                           `${notification.type}-${notification.createdAt}` : 
                           `notification-index-${index}`);
                           
          return (
            <NotificationItem
              key={uniqueId}
              notification={notification}
              onClick={handleNotificationClick}
              aria-label={`Notification: ${notification.message || notification.type || 'New notification'}`}
            />
          );
        })}
        {filteredNotifications.length === 0 && (
          <div className="notification-empty-state">
            <p>No notifications to display</p>
          </div>
        )}
      </div>

      {showFilters && isMobile && <div className="notification-footer">{renderFilterButtons()}</div>}
    </div>
  )
}

/**
 * Individual notification item component
 */
const NotificationItem = ({ notification, onClick }) => {
  if (!notification) return null

  // Select the appropriate icon based on notification type
  const NotificationIcon = getNotificationIcon(notification.type)

  // Format the notification time
  const formattedTime = formatDate(notification.createdAt, { showRelative: true, showTime: false, showDate: false })

  // Check if this notification has multiple items (bundled)
  const count = notification.count > 1 ? notification.count : null

  // Get sender nickname
  const senderNickname = getSenderNickname(notification)

  // Handle notification click
  const onClickHandler = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (onClick) {
      onClick(notification)
    }
  }

  // Get notification action text based on type
  const actionText = getNotificationAction(notification)

  return (
    <div className={`notification-item ${!notification.read ? "unread" : ""}`} onClick={onClickHandler}>
      <div className="notification-icon">
        <NotificationIcon />
      </div>

      <div className="notification-content">
        <div className="notification-title">
          <span className="notification-sender">{senderNickname}</span> {actionText}
          {count && <span className="notification-count"> ({count})</span>}
        </div>

        <div className="notification-message">{notification.message || notification.content || notification.title}</div>

        <div className="notification-time">
          {formattedTime}
          {!notification.read && <span className="notification-status">•&nbsp;New</span>}
        </div>
      </div>
    </div>
  )
}

/**
 * Get the appropriate icon component for a notification type
 */
function getNotificationIcon(type) {
  switch (type) {
    case "message":
      return FaEnvelope
    case "like":
    case "match":
      return FaHeart
    case "photoRequest":
    case "photoResponse":
      return FaCamera
    case "story":
      return FaImage
    case "comment":
      return FaComment
    case "call":
      return FaPhone
    default:
      return FaBell
  }
}

/**
 * Extract sender nickname from notification
 */
function getSenderNickname(notification) {
  return (
    notification.sender?.nickname ||
    notification.data?.sender?.nickname ||
    notification.data?.requester?.nickname ||
    notification.data?.owner?.nickname ||
    notification.data?.user?.nickname ||
    "Someone"
  )
}

/**
 * Get appropriate action text based on notification type
 */
function getNotificationAction(notification) {
  switch (notification.type) {
    case "message":
      return notification.count > 1 ? `sent you ${notification.count} messages` : "sent you a message"

    case "like":
      return "liked your profile"

    case "match":
      return "matched with you"

    case "photoRequest":
      return "requested access to your photo"

    case "photoResponse":
      const status = notification.data?.status || ""
      return status === "approved" ? "approved your photo request" : "declined your photo request"

    case "story":
      return notification.count > 1 ? `shared ${notification.count} new stories` : "shared a new story"

    case "comment":
      return notification.count > 1 ? `left ${notification.count} comments on your post` : "commented on your post"

    case "call":
      return "called you"

    default:
      return "sent a notification"
  }
}

export default NotificationsComponent