import React from 'react';
import { FaVideo } from 'react-icons/fa';

/**
 * VideoCallMessage component - Renders a video call message
 * 
 * @param {Object} props - Component props
 * @param {Object} props.message - Message object
 * @returns {React.ReactElement} The video call message component
 */
const VideoCallMessage = ({ message }) => {
  return (
    <div className="video-call-message">
      <FaVideo className="video-icon" />
      <div className="video-message-text">
        {message.content || 'Video Call'}
      </div>
      
      {/* Add styling */}
      <style jsx>{`
        .video-call-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 500;
        }
        
        .video-icon {
          font-size: 1.2rem;
          color: var(--primary);
        }
        
        .video-message-text {
          font-size: 0.95rem;
        }
        
        /* Dark mode */
        .dark .video-icon {
          color: var(--primary-light);
        }
      `}</style>
    </div>
  );
};

export default VideoCallMessage;