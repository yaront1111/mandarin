// src/components/chat/ChatHeader.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { FaArrowLeft, FaVideo, FaEllipsisH, FaBan, FaFlag, FaUser, FaExclamationTriangle, FaExclamationCircle, FaSpinner, FaLock, FaLockOpen } from 'react-icons/fa';
import Avatar from '../common/Avatar.jsx';
// Use direct translation without helper functions
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
  isConnected,
  photoAccess = false
}) => {
  // Use custom styles if provided, otherwise use default styles
  const useStyles = customStyles || styles;
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const moreButtonRef = useRef(null);
  const { t } = useTranslation();


  // Memoized translations with direct t() calls and fallbacks
  const translations = useMemo(() => ({
    approvePhotoRequests: t('approvePhotoRequests') || 'Approve photo requests',
    blockedUserMessage: t('blockedUserMessage') || 'You have blocked this user. They will not receive any messages from you.',
    disconnected: t('disconnected') || 'Disconnected',
    connectionLost: t('connectionLost') || 'Connection lost',
    startVideoCall: t('startVideoCall') || 'Start video call',
    viewProfile: t('viewProfile') || 'View Profile',
    blockUser: t('blockUser') || 'Block User',
    unblockUser: t('unblockUser') || 'Unblock User',
    reportUser: t('reportUser') || 'Report User',
    blocked: t('blocked') || 'Blocked',
    online: t('online') || 'Online',
    offline: t('offline') || 'Offline',
    moreOptions: t('moreOptions') || 'More options',
    unblock: t('unblock') || 'Unblock'
  }), [t]);

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
            {user.isBlocked && <span className={useStyles.blockedTag}>{translations.blocked || 'Blocked'}</span>}
          </h3>
          <span className={`${useStyles.userStatus} ${user.isBlocked ? useStyles.blockedStatus : ''}`}>
            {user.isBlocked
              ? translations.blocked || 'Blocked'
              : (user.online
                  ? translations.online || 'Online'
                  : translations.offline || 'Offline')}
          </span>
          {isConnected === false && (
            <span className={useStyles.connectionStatus} title={translations.connectionLost || 'Connection lost'}>
              <FaExclamationCircle className={useStyles.statusIcon} />
              <span>{translations.disconnected || 'Disconnected'}</span>
            </span>
          )}
        </div>
      </div>
      
      <div className={useStyles.chatActions}>
        {onApprovePhotoRequests && (
          <button
            className={`${useStyles.chatHeaderBtn || useStyles.videoCallButton} ${photoAccess ? useStyles.photoAccessGranted : ''}`}
            onClick={onApprovePhotoRequests}
            title={pendingPhotoRequests > 0 
              ? `Approve ${pendingPhotoRequests} photo request(s)` 
              : photoAccess 
                ? 'Revoke photo access' 
                : 'Grant photo access'}
            aria-label={photoAccess ? "Revoke photo access" : "Grant photo access"}
            disabled={isApprovingRequests}
            type="button"
          >
            {isApprovingRequests ? <FaSpinner className="fa-spin" /> : photoAccess ? <FaLockOpen /> : <FaLock />}
          </button>
        )}
        
        <button 
          className={useStyles.videoCallButton} 
          onClick={onStartVideoCall}
          aria-label={translations.startVideoCall || "Start video call"}
          title={translations.startVideoCall || "Start video call"}
          type="button"
          disabled={userTier === 'FREE' || (isActionDisabled !== undefined ? isActionDisabled : false)}
        >
          <FaVideo />
        </button>
        
        <button 
          ref={moreButtonRef}
          className={useStyles.moreOptionsButton} 
          onClick={toggleDropdown}
          aria-label={translations.moreOptions || "More options"}
          title={translations.moreOptions || "More options"}
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
              <FaUser /> {translations.viewProfile || "View Profile"}
            </button>
            <button 
              className={useStyles.dropdownItem} 
              onClick={handleBlockUser}
              type="button"
            >
              <FaBan /> {user.isBlocked 
                ? translations.unblockUser || "Unblock User"
                : translations.blockUser || "Block User"}
            </button>
            <button 
              className={useStyles.dropdownItem} 
              onClick={handleReportUser}
              type="button"
            >
              <FaFlag /> {translations.reportUser || "Report User"}
            </button>
          </div>
        )}
      </div>
      </div>
      
      {user.isBlocked && (
        <div className={useStyles.blockedUserBanner} role="alert">
          <div>
            <FaExclamationTriangle />
            {translations.blockedUserMessage || "You have blocked this user. They will not receive any messages from you."}
          </div>
          <button
            className={useStyles.unblockButton}
            onClick={handleBlockUser}
            type="button"
          >
            {translations.unblock || "Unblock"}
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
  isConnected: PropTypes.bool,
  photoAccess: PropTypes.bool
};

export default React.memo(ChatHeader);