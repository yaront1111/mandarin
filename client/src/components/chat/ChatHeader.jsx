// src/components/chat/ChatHeader.jsx
import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FaArrowLeft, FaVideo, FaEllipsisH, FaBan, FaFlag, FaUser, FaExclamationTriangle } from 'react-icons/fa';
import Avatar from '../common/Avatar.jsx';
import styles from '../../styles/Messages.module.css';

/**
 * Header component for chat conversations
 */
const ChatHeader = ({
  conversation,
  isMobile = false,
  onBackClick,
  onStartVideoCall,
  onProfileClick,
  onBlockUser,
  onReportUser,
  userTier
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const moreButtonRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target) &&
        !moreButtonRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!conversation || !conversation.user) return null;

  const { user } = conversation;
  const displayName = user.nickname || user.username || 'User';
  
  const toggleDropdown = (e) => {
    e.stopPropagation();
    setShowDropdown(prev => !prev);
  };

  const handleViewProfile = (e) => {
    e.stopPropagation();
    setShowDropdown(false);
    onProfileClick();
  };
  
  const handleBlockUser = (e) => {
    e.stopPropagation();
    setShowDropdown(false);
    if (onBlockUser) onBlockUser(user._id);
  };
  
  const handleReportUser = (e) => {
    e.stopPropagation();
    setShowDropdown(false);
    if (onReportUser) onReportUser(user._id);
  };
  
  return (
    <>
      <div className={styles.chatHeader}>
        {isMobile && (
          <button 
            className={styles.backButton} 
            onClick={onBackClick}
            aria-label="Back to conversations"
            type="button"
          >
            <FaArrowLeft />
          </button>
        )}
      
      <div 
        className={styles.conversationInfo} 
        onClick={onProfileClick}
        role="button" 
        tabIndex={0}
        aria-label={`View ${displayName}'s profile`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onProfileClick();
          }
        }}
      >
        <Avatar 
          src={user.photo} 
          size="medium" 
          status={user.online ? 'online' : 'offline'} 
        />
        <div className={styles.userInfo}>
          <h3 className={styles.userName}>
            {displayName}
            {user.isBlocked && <span className={styles.blockedTag}>Blocked</span>}
          </h3>
          <span className={`${styles.userStatus} ${user.isBlocked ? styles.blockedStatus : ''}`}>
            {user.isBlocked ? 'Blocked' : (user.online ? 'Online' : 'Offline')}
          </span>
        </div>
      </div>
      
      <div className={styles.chatActions}>
        <button 
          className={styles.videoCallButton} 
          onClick={onStartVideoCall}
          aria-label="Start video call"
          title="Start video call"
          type="button"
          disabled={userTier === 'FREE'}
        >
          <FaVideo />
        </button>
        
        <button 
          ref={moreButtonRef}
          className={styles.moreOptionsButton} 
          onClick={toggleDropdown}
          aria-label="More options"
          title="More options"
          type="button"
        >
          <FaEllipsisH />
        </button>
        
        {showDropdown && (
          <div ref={dropdownRef} className={styles.headerDropdown}>
            <button 
              className={styles.dropdownItem} 
              onClick={handleViewProfile}
              type="button"
            >
              <FaUser /> View Profile
            </button>
            <button 
              className={styles.dropdownItem} 
              onClick={handleBlockUser}
              type="button"
            >
              <FaBan /> {user.isBlocked ? 'Unblock User' : 'Block User'}
            </button>
            <button 
              className={styles.dropdownItem} 
              onClick={handleReportUser}
              type="button"
            >
              <FaFlag /> Report User
            </button>
          </div>
        )}
      </div>
      </div>
      
      {user.isBlocked && (
        <div className={styles.blockedUserBanner} role="alert">
          <div>
            <FaExclamationTriangle />
            You have blocked this user. They will not receive any messages from you.
          </div>
          <button
            className={styles.unblockButton}
            onClick={handleBlockUser}
            type="button"
          >
            Unblock
          </button>
        </div>
      )}
    </>
  );
};

ChatHeader.propTypes = {
  conversation: PropTypes.shape({
    user: PropTypes.shape({
      _id: PropTypes.string.isRequired,
      username: PropTypes.string.isRequired,
      nickname: PropTypes.string,
      photo: PropTypes.string,
      online: PropTypes.bool,
    }).isRequired,
  }),
  isMobile: PropTypes.bool,
  onBackClick: PropTypes.func.isRequired,
  onStartVideoCall: PropTypes.func.isRequired,
  onProfileClick: PropTypes.func.isRequired,
  onBlockUser: PropTypes.func,
  onReportUser: PropTypes.func,
  userTier: PropTypes.string,
};

export default React.memo(ChatHeader);