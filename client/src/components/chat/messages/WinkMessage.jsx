import React from 'react';

/**
 * WinkMessage component - Renders a wink message with emoji
 * 
 * @param {Object} props - Component props
 * @param {Object} props.message - Message object
 * @returns {React.ReactElement} The wink message component
 */
const WinkMessage = ({ message }) => {
  return (
    <div className="wink-message">
      <span className="wink-emoji" role="img" aria-label="wink">😉</span>
      <div className="wink-text">Sent a wink</div>
      
      {/* Add styling */}
      <style jsx>{`
        .wink-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .wink-emoji {
          font-size: 1.5rem;
          animation: pulse 1.5s infinite;
        }
        
        .wink-text {
          font-size: 0.9rem;
          color: var(--text-medium);
        }
        
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default WinkMessage;