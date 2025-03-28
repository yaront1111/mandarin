// client/src/components/NotificationsComponent.jsx
import React, { useState, useEffect } from 'react';
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
  FaPhone
} from 'react-icons/fa';
import { useNotifications } from '../context';
import apiService from '../services/apiService.jsx';
import { toast } from 'react-toastify';

/**
 * Comprehensive notifications component that combines both list and item display
 * Can be used in dropdown or full page contexts
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
  customFilters = null // Add customFilters prop with default value null
}) => {
  const {
    notifications,
    unreadCount,
    isLoading: loadingNotifications,
    markAllAsRead,
    addTestNotification,
    handleNotificationClick: contextHandleClick
  } = useNotifications();

  const [activeFilter, setActiveFilter] = useState('all');
  const [filteredNotifications, setFilteredNotifications] = useState([]);

  // Apply filters when notifications change
  useEffect(() => {
    if (!notifications) {
      setFilteredNotifications([]);
      return;
    }

    let filtered = [...notifications];

    // Apply type filter
    if (activeFilter !== 'all') {
      if (activeFilter === 'unread') {
        filtered = filtered.filter(n => !n.read);
      } else {
        filtered = filtered.filter(n => n.type === activeFilter);
      }
    }

    setFilteredNotifications(filtered);
  }, [notifications, activeFilter]);

  // Handle filter change
  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
  };

  // Handle clear all notifications
  const handleClearAll = async () => {
    try {
      const response = await apiService.delete('/notifications/clear-all');
      if (response.success) {
        toast.success(`Cleared ${response.count} notifications`);
        // Force refresh notifications from server
        window.location.reload();
      } else {
        toast.error('Failed to clear notifications');
      }
    } catch (error) {
      toast.error('Error clearing notifications');
    }
  };

  // Handle marking all as read
  const handleMarkAllAsRead = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    markAllAsRead();
    toast.success('All notifications marked as read');
  };

  // Handle notification click
  const handleNotificationClick = (notification) => {
    contextHandleClick(notification);
    if (isDropdown && onClose) {
      onClose();
    }
  };

  // Handle adding a test notification
  const handleAddTestNotification = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    addTestNotification();
  };

  // Define filter options - either use customFilters or default filters
  const getFilterOptions = () => {
    // Default filter options
    const defaultFilters = [
      { id: 'all', label: 'All' },
      { id: 'unread', label: 'Unread' },
      { id: 'message', label: 'Messages' },
      { id: 'like', label: 'Likes' },
      { id: 'photoRequest', label: 'Photos' },
      { id: 'story', label: 'Stories' }
    ];

    // If customFilters is provided, only use those filters
    if (customFilters && Array.isArray(customFilters) && customFilters.length > 0) {
      return defaultFilters.filter(filter => customFilters.includes(filter.id));
    }

    return defaultFilters;
  };

  // Render filter buttons
  const renderFilterButtons = () => {
    const filters = getFilterOptions();

    return (
      <div className="notification-filters">
        {filters.map(filter => (
          <button
            key={filter.id}
            className={`filter-btn ${activeFilter === filter.id ? 'active' : ''}`}
            onClick={() => handleFilterChange(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>
    );
  };

  // Render loading state
  if (loadingNotifications) {
    return (
      <div className={`notification-loading ${className}`} style={style}>
        <div className="spinner"></div>
        <p>Loading notifications...</p>
      </div>
    );
  }

  // Render empty state
  if (!filteredNotifications || filteredNotifications.length === 0) {
    return (
      <div className={`notification-empty ${className}`} style={style}>
        <FaBell size={32} />
        <p>No {activeFilter !== 'all' ? `${activeFilter} ` : ''}notifications yet</p>

        {isDropdown && (
          <button onClick={handleAddTestNotification} className="btn btn-sm btn-primary mt-3">
            Add Test Notification
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`notification-container ${className}`} style={style}>
      {showHeader && (
        <div className="notification-header">
          <div className="notification-header-title">
            <span>Notifications</span>
            {activeFilter !== 'all' && (
              <span className="notification-filter-indicator">
                ({activeFilter})
              </span>
            )}
          </div>

          <div className="notification-header-actions">
            {unreadCount > 0 && (
              <span className="notification-header-action" onClick={handleMarkAllAsRead}>
                <FaCheck size={14} /> Mark all read
              </span>
            )}

            {!isDropdown && (
              <>
                <span
                  className="notification-header-action"
                  onClick={() => handleFilterChange(activeFilter === 'all' ? 'unread' : 'all')}
                >
                  <FaFilter size={14} /> {activeFilter === 'all' ? 'Show unread' : 'Show all'}
                </span>

                <span className="notification-header-action" onClick={handleClearAll}>
                  <FaTrash size={14} /> Clear all
                </span>
              </>
            )}

            {isDropdown && onClose && (
              <button className="notification-close-btn" onClick={onClose}>
                <FaTimes />
              </button>
            )}
          </div>
        </div>
      )}

      {showFilters && !isMobile && renderFilterButtons()}

      <div
        className="notification-list"
        style={{ maxHeight: `${maxHeight}px` }}
      >
        {filteredNotifications.map((notification) => (
          <NotificationItem
            key={notification._id || notification.id || `notification-${Math.random()}`}
            notification={notification}
            onClick={handleNotificationClick}
          />
        ))}
      </div>

      {showFilters && isMobile && (
        <div className="notification-footer">
          {renderFilterButtons()}
        </div>
      )}
    </div>
  );
};

/**
 * Individual notification item component
 */
const NotificationItem = ({ notification, onClick }) => {
  if (!notification) return null;

  // Select the appropriate icon based on notification type
  const NotificationIcon = getNotificationIcon(notification.type);

  // Format the notification time
  const notificationTime = formatNotificationTime(notification.createdAt);

  // Check if this notification has multiple items (bundled)
  const count = notification.count > 1 ? notification.count : null;

  // Get sender nickname
  const senderNickname = getSenderNickname(notification);

  // Handle notification click
  const onClickHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (onClick) {
      onClick(notification);
    }
  };

  // Get notification action text based on type
  const actionText = getNotificationAction(notification);

  // Determine if this is a new notification (less than 1 minute old)
  const isNew = notification.createdAt &&
                new Date().getTime() - new Date(notification.createdAt).getTime() < 60000;

  return (
    <div
      className={`notification-item ${!notification.read ? "unread" : ""} ${isNew ? "new-notification" : ""}`}
      onClick={onClickHandler}
    >
      <div className="notification-icon">
        <NotificationIcon />
      </div>

      <div className="notification-content">
        <div className="notification-title">
          <span className="notification-sender">{senderNickname}</span> {actionText}
          {count && <span className="notification-count"> ({count})</span>}
        </div>

        <div className="notification-message">
          {notification.message || notification.content || notification.title}
        </div>

        <div className="notification-time">
          {notificationTime}
          {!notification.read && <span className="notification-time-dot"></span>}
          {!notification.read && <span className="notification-status">Unread</span>}
        </div>
      </div>
    </div>
  );
};

/**
 * Get the appropriate icon component for a notification type
 */
function getNotificationIcon(type) {
  switch (type) {
    case 'message':
      return FaEnvelope;
    case 'like':
    case 'match':
      return FaHeart;
    case 'photoRequest':
    case 'photoResponse':
      return FaCamera;
    case 'story':
      return FaImage;
    case 'comment':
      return FaComment;
    case 'call':
      return FaPhone;
    default:
      return FaBell;
  }
}

/**
 * Format notification time in a human-readable way
 */
function formatNotificationTime(timestamp) {
  if (!timestamp) return "Just now";

  const now = new Date();
  const notificationTime = new Date(timestamp);
  const diffMs = now - notificationTime;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return notificationTime.toLocaleDateString();
}

/**
 * Extract sender nickname from notification
 */
function getSenderNickname(notification) {
  return notification.sender?.nickname ||
         notification.data?.sender?.nickname ||
         notification.data?.requester?.nickname ||
         notification.data?.owner?.nickname ||
         notification.data?.user?.nickname ||
         "Someone";
}

/**
 * Get appropriate action text based on notification type
 */
function getNotificationAction(notification) {
  switch (notification.type) {
    case "message":
      return notification.count > 1
        ? `sent you ${notification.count} messages`
        : "sent you a message";

    case "like":
      return "liked your profile";

    case "match":
      return "matched with you";

    case "photoRequest":
      return "requested access to your photo";

    case "photoResponse":
      const status = notification.data?.status || "";
      return status === "approved"
        ? "approved your photo request"
        : "declined your photo request";

    case "story":
      return notification.count > 1
        ? `shared ${notification.count} new stories`
        : "shared a new story";

    case "comment":
      return notification.count > 1
        ? `left ${notification.count} comments on your post`
        : "commented on your post";

    case "call":
      return "called you";

    default:
      return "sent a notification";
  }
}

export default NotificationsComponent;
