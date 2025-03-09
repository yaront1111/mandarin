// src/components/chat/MessageBubble.jsx
import React from 'react';
import PropTypes from 'prop-types';

const MessageBubble = ({ message, isMine }) => {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-xs md:max-w-md rounded-lg px-4 py-2 ${
        isMine ? 'bg-brand-pink text-white' : 'bg-bg-input text-text-primary'
      }`}>
        <p>{message.content}</p>
        <div className="text-xs mt-1 text-right opacity-70">
          {new Date(message.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </div>
      </div>
    </div>
  );
};

MessageBubble.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.string,
    content: PropTypes.string.isRequired,
    createdAt: PropTypes.string,
    senderId: PropTypes.string
  }).isRequired,
  isMine: PropTypes.bool
};

MessageBubble.defaultProps = {
  isMine: false
};

export default MessageBubble;
