import React, { memo } from 'react';
import { FaCheckDouble, FaCheck, FaSpinner, FaFile, FaImage, FaFileAlt, 
         FaFilePdf, FaFileAudio, FaFileVideo } from 'react-icons/fa';
import { Avatar } from '../common';
import { formatDate, normalizePhotoUrl } from '../../utils';
import { getFileIconType, classNames } from '../../utils/chatUtils';
import TextMessage from './messages/TextMessage';
import FileMessage from './messages/FileMessage';
import VideoCallMessage from './messages/VideoCallMessage';
import WinkMessage from './messages/WinkMessage';

/**
 * MessageItem component - Renders an individual message
 * 
 * @param {Object} props - Component props
 * @param {Object} props.message - Message object to display
 * @param {boolean} props.isCurrentUser - Whether the message is from the current user
 * @param {boolean} props.showAvatar - Whether to show the avatar
 * @param {Object} props.recipient - Recipient user object
 * @param {boolean} props.isPending - Whether the message is pending delivery
 * @returns {React.ReactElement} The message item component
 */
const MessageItem = ({
  message,
  isCurrentUser,
  showAvatar = true,
  recipient,
  isPending = false
}) => {
  // Handle different message types
  const renderMessageContent = () => {
    switch (message.type) {
      case 'text':
        return <TextMessage message={message} />;
      case 'file':
        return <FileMessage message={message} />;
      case 'video':
        return <VideoCallMessage message={message} />;
      case 'wink':
        return <WinkMessage message={message} />;
      default:
        return <TextMessage message={message} />;
    }
  };
  
  // Render read/delivered indicators
  const renderMessageStatus = () => {
    if (isPending) {
      return <FaSpinner className="message-status-icon spin" />;
    }
    
    if (message.status === 'error') {
      return <span className="message-status-icon error">!</span>;
    }
    
    if (isCurrentUser) {
      return message.read ? 
        <FaCheckDouble className="message-status-icon read" /> : 
        <FaCheck className="message-status-icon sent" />;
    }
    
    return null;
  };
  
  return (
    <div className={classNames(
      'message-container',
      isCurrentUser ? 'sent' : 'received',
      isPending ? 'pending' : '',
      message.status === 'error' ? 'error' : ''
    )}>
      {!isCurrentUser && showAvatar && (
        <div className="message-avatar">
          <Avatar 
            src={recipient?.photos?.[0]?.url ? normalizePhotoUrl(recipient.photos[0].url) : null}
            name={recipient?.nickname || 'User'}
            size="small"
          />
        </div>
      )}
      
      <div className="message-content-wrapper">
        <div className="message-content">
          {renderMessageContent()}
          <div className="message-meta">
            <time className="message-time">
              {formatDate(message.createdAt, { showTime: true, showDate: false })}
            </time>
            {renderMessageStatus()}
          </div>
        </div>
      </div>
      
      {/* Add styling */}
      <style jsx>{`
        .message-container {
          display: flex;
          margin-bottom: 0.5rem;
          max-width: 80%;
          align-self: flex-start;
          animation: fadeIn 0.3s ease-in-out;
        }
        
        .message-container.sent {
          align-self: flex-end;
          flex-direction: row-reverse;
        }
        
        .message-avatar {
          margin-right: 0.5rem;
          align-self: flex-end;
        }
        
        .message-content-wrapper {
          display: flex;
          flex-direction: column;
        }
        
        .message-content {
          position: relative;
          padding: 0.75rem 1rem;
          border-radius: 18px;
          background-color: var(--bg-light);
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
          overflow: hidden;
          word-break: break-word;
        }
        
        .message-container.sent .message-content {
          background-color: var(--primary-subtle);
          color: var(--text-dark);
          border-bottom-right-radius: 4px;
        }
        
        .message-container.received .message-content {
          border-bottom-left-radius: 4px;
        }
        
        .message-meta {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 4px;
          margin-top: 4px;
          font-size: 0.7rem;
          color: var(--text-light);
        }
        
        .message-time {
          font-size: 0.7rem;
          color: var(--text-light);
        }
        
        .message-status-icon {
          font-size: 0.8rem;
        }
        
        .message-status-icon.read {
          color: var(--primary);
        }
        
        .message-status-icon.sent {
          color: var(--text-light);
        }
        
        .message-status-icon.error {
          color: var(--danger);
        }
        
        .message-container.pending {
          opacity: 0.7;
        }
        
        .message-container.error .message-content {
          background-color: var(--danger-light);
          border: 1px solid var(--danger);
        }
        
        .spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        /* Dark mode */
        .dark .message-content {
          background-color: var(--medium);
        }
        
        .dark .message-container.sent .message-content {
          background-color: var(--primary-dark);
        }
      `}</style>
    </div>
  );
};

// Use memo to prevent unnecessary re-renders
export default memo(MessageItem);