// src/components/chat/ChatHeader.jsx
import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { FaArrowLeft, FaVideo, FaEllipsisH, FaBan, FaFlag, FaUser, FaExclamationTriangle, FaExclamationCircle, FaSpinner, FaLock } from 'react-icons/fa';
import Avatar from '../common/Avatar.jsx';
import { translate } from '../../utils';
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
  userTier,
  customStyles,
  pendingPhotoRequests,
  isApprovingRequests,
  onApprovePhotoRequests,
  isActionDisabled,
  isConnected
}) => {
  // Use custom styles if provided, otherwise use default styles
  const useStyles = customStyles || styles;
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const moreButtonRef = useRef(null);
  const { t } = useTranslation();

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
      <div className={useStyles.chatHeader}>
        {isMobile && (
          <button 
            className={useStyles.backButton} 
            onClick={onBackClick}
            aria-label="Back to conversations"
            type="button"
          >
            <FaArrowLeft />
          </button>
        )}
      
      <div 
        className={useStyles.conversationInfo} 
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
          user={user}
          size="medium" 
          status={user.online ? 'online' : 'offline'}
          showOnlineStatus={true}
        />
        <div className={useStyles.userInfo}>
          <h3 className={useStyles.userName}>
            {displayName}
            {user.isBlocked && <span className={useStyles.blockedTag}>{translate('common.blocked', t, 'Blocked')}</span>}
          </h3>
          <span className={`${useStyles.userStatus} ${user.isBlocked ? useStyles.blockedStatus : ''}`}>
            {user.isBlocked 
              ? translate('common.blocked', t, 'Blocked') 
              : (user.online 
                  ? translate('common.online', t, 'Online') 
                  : translate('common.offline', t, 'Offline'))}
          </span>
          {isConnected === false && (
            <span className={useStyles.connectionStatus} title={translate('chat.connectionLost', t, 'Connection lost')}>
              <FaExclamationCircle className={useStyles.statusIcon} />
              <span>{translate('chat.disconnected', t, 'Disconnected')}</span>
            </span>
          )}
        </div>
      </div>
      
      <div className={useStyles.chatActions}>
        {pendingPhotoRequests > 0 && onApprovePhotoRequests && (
          <button
            className={useStyles.chatHeaderBtn || useStyles.videoCallButton}
            onClick={onApprovePhotoRequests}
            title={translate('chat.approvePhotoRequests', t, `Approve ${pendingPhotoRequests} photo request(s)`)}
            aria-label={translate('chat.approvePhotoRequests', t, "Approve photo requests")}
            disabled={isApprovingRequests}
            type="button"
          >
            {isApprovingRequests ? <FaSpinner className="fa-spin" /> : <FaLock />}
          </button>
        )}
        
        <button 
          className={useStyles.videoCallButton} 
          onClick={onStartVideoCall}
          aria-label={translate('chat.startVideoCall', t, "Start video call")}
          title={translate('chat.startVideoCall', t, "Start video call")}
          type="button"
          disabled={userTier === 'FREE' || (isActionDisabled !== undefined ? isActionDisabled : false)}
        >
          <FaVideo />
        </button>
        
        <button 
          ref={moreButtonRef}
          className={useStyles.moreOptionsButton} 
          onClick={toggleDropdown}
          aria-label={translate('common.moreOptions', t, "More options")}
          title={translate('common.moreOptions', t, "More options")}
          type="button"
        >
          <FaEllipsisH />
        </button>
        
        {showDropdown && (
          <div ref={dropdownRef} className={useStyles.headerDropdown}>
            <button 
              className={useStyles.dropdownItem} 
              onClick={handleViewProfile}
              type="button"
            >
              <FaUser /> {translate('common.viewProfile', t, "View Profile")}
            </button>
            <button 
              className={useStyles.dropdownItem} 
              onClick={handleBlockUser}
              type="button"
            >
              <FaBan /> {user.isBlocked 
                ? translate('common.unblockUser', t, "Unblock User") 
                : translate('common.blockUser', t, "Block User")}
            </button>
            <button 
              className={useStyles.dropdownItem} 
              onClick={handleReportUser}
              type="button"
            >
              <FaFlag /> {translate('common.reportUser', t, "Report User")}
            </button>
          </div>
        )}
      </div>
      </div>
      
      {user.isBlocked && (
        <div className={useStyles.blockedUserBanner} role="alert">
          <div>
            <FaExclamationTriangle />
            {translate('chat.blockedUserMessage', t, "You have blocked this user. They will not receive any messages from you.")}
          </div>
          <button
            className={useStyles.unblockButton}
            onClick={handleBlockUser}
            type="button"
          >
            {translate('common.unblock', t, "Unblock")}
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
      username: PropTypes.string,
      nickname: PropTypes.string,
      photo: PropTypes.string,
      online: PropTypes.bool,
      isBlocked: PropTypes.bool,
    }).isRequired,
    pendingPhotoRequests: PropTypes.number,
  }),
  isMobile: PropTypes.bool,
  onBackClick: PropTypes.func.isRequired,
  onStartVideoCall: PropTypes.func.isRequired,
  onProfileClick: PropTypes.func.isRequired,
  onBlockUser: PropTypes.func,
  onReportUser: PropTypes.func,
  userTier: PropTypes.string,
  customStyles: PropTypes.object,
  pendingPhotoRequests: PropTypes.number,
  isApprovingRequests: PropTypes.bool,
  onApprovePhotoRequests: PropTypes.func,
  isActionDisabled: PropTypes.bool,
  isConnected: PropTypes.bool
};

export default React.memo(ChatHeader);