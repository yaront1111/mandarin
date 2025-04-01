import React from 'react';
import { FaTimes, FaVideo, FaChevronLeft } from 'react-icons/fa';
import { Avatar } from '../common';
import { normalizePhotoUrl } from '../../utils';

/**
 * ChatHeader component - Renders the header for a chat conversation
 * 
 * @param {Object} props - Component props
 * @param {Object} props.recipient - Recipient user object
 * @param {Function} props.onClose - Function to call when close button is clicked
 * @param {Function} props.onVideoCall - Function to call when video call button is clicked
 * @param {boolean} props.embedded - Whether the chat is embedded vs full page
 * @returns {React.ReactElement} The chat header component
 */
const ChatHeader = ({ 
  recipient, 
  onClose, 
  onVideoCall,
  embedded = true
}) => {
  return (
    <div className="chat-header">
      {/* Mobile back button for non-embedded mode */}
      {!embedded && (
        <button 
          className="mobile-back-button" 
          onClick={onClose}
          aria-label="Back"
        >
          <FaChevronLeft />
        </button>
      )}
      
      <div className="recipient-info">
        <Avatar 
          src={recipient?.photos?.[0]?.url ? normalizePhotoUrl(recipient.photos[0].url) : null}
          name={recipient?.nickname || 'User'}
          size="medium"
          showStatus={true}
          isOnline={recipient?.isOnline}
        />
        <div className="recipient-details">
          <div className="recipient-name">{recipient?.nickname || 'User'}</div>
          <div className="recipient-status">
            {recipient?.isOnline ? 'Online' : 'Offline'}
          </div>
        </div>
      </div>
      
      <div className="header-actions">
        <button 
          className="video-call-button" 
          onClick={onVideoCall}
          aria-label="Video call"
        >
          <FaVideo />
        </button>
        
        {embedded && (
          <button 
            className="close-button" 
            onClick={onClose}
            aria-label="Close chat"
          >
            <FaTimes />
          </button>
        )}
      </div>
      
      {/* Add styling */}
      <style jsx>{`
        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          background-color: var(--primary);
          color: white;
          border-top-left-radius: 10px;
          border-top-right-radius: 10px;
          position: relative;
        }
        
        .recipient-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .recipient-details {
          display: flex;
          flex-direction: column;
        }
        
        .recipient-name {
          font-weight: 600;
          font-size: 1rem;
        }
        
        .recipient-status {
          font-size: 0.75rem;
          opacity: 0.8;
        }
        
        .header-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .video-call-button,
        .close-button,
        .mobile-back-button {
          background: none;
          border: none;
          color: white;
          font-size: 1.1rem;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .video-call-button:hover,
        .close-button:hover,
        .mobile-back-button:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }
        
        .mobile-back-button {
          position: absolute;
          left: 10px;
          display: none;
        }
        
        /* Mobile adjustments */
        @media (max-width: 768px) {
          .chat-header {
            padding-left: 3rem;
          }
          
          .mobile-back-button {
            display: flex;
          }
        }
        
        /* Dark mode adjustments not needed as header is already dark */
      `}</style>
    </div>
  );
};

export default ChatHeader;