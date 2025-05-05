// src/components/chat/ConversationItem.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { FaCircle } from 'react-icons/fa';
import { formatPreviewTime, formatMessagePreview } from './chatUtils.jsx';
import Avatar from '../common/Avatar.jsx';
import styles from '../../styles/Messages.module.css';

/**
 * Represents a single conversation in the conversations list sidebar
 */
const ConversationItem = ({
  conversation,
  isActive = false, // Provide default value to avoid PropType warning
  currentUserId,
  onClick,
}) => {
  if (!conversation || !conversation.user) {
    console.warn("Invalid conversation object passed to ConversationItem");
    return null;
  }

  const { user, lastMessage, unreadCount = 0 } = conversation;
  // Ensure the user object has a username property
  if (!user.username) {
    console.warn("User missing username property in ConversationItem:", user._id);
    user.username = user.nickname || "Unknown User";
  }
  const hasUnread = unreadCount > 0;
  
  return (
    <div
      className={`${styles.conversationItem} ${isActive ? styles.active : ''}`}
      onClick={() => onClick(conversation)}
      role="listitem"
      aria-selected={isActive}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick(conversation);
        }
      }}
    >
      <Avatar 
        user={user}
        size="medium" 
        borderActive={isActive}
        status={user.online ? 'online' : 'offline'}
        showOnlineStatus={true}
      />
      
      <div className={styles.conversationDetails}>
        <div className={styles.conversationHeader}>
          <span className={styles.conversationName}>{user.nickname || user.username}</span>
          <span className={styles.messageTime}>
            {lastMessage?.createdAt ? formatPreviewTime(lastMessage.createdAt) : ''}
          </span>
        </div>
        
        <div className={styles.messagePreview}>
          <span className={styles.previewText}>
            {lastMessage ? formatMessagePreview(lastMessage, currentUserId) : 'No messages yet'}
          </span>
          
          {hasUnread && (
            <div className={styles.unreadIndicator}>
              <FaCircle className={styles.unreadDot} aria-hidden="true" />
              {unreadCount > 1 && (
                <span className={styles.unreadCount} aria-label={`${unreadCount} unread messages`}>
                  {unreadCount}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

ConversationItem.propTypes = {
  conversation: PropTypes.shape({
    user: PropTypes.shape({
      _id: PropTypes.string.isRequired,
      username: PropTypes.string.isRequired,
      nickname: PropTypes.string,
      photo: PropTypes.string,
      online: PropTypes.bool,
    }).isRequired,
    lastMessage: PropTypes.shape({
      content: PropTypes.string,
      createdAt: PropTypes.string,
      type: PropTypes.string,
      sender: PropTypes.string,
    }),
    unreadCount: PropTypes.number,
  }).isRequired,
  isActive: PropTypes.bool.isRequired,
  currentUserId: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
};

export default React.memo(ConversationItem);