// src/components/chat/MessageBubble.jsx
import React from 'react';
import PropTypes from 'prop-types';

/**
 * MessageBubble component displays a single chat message.
 */
const MessageBubble = ({ message, isMine, isSequence }) => {
  // Format time from ISO string
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const messageTime = formatTime(message.createdAt);

  // Apply different styles based on whether it's your message or theirs
  const messageContainerClasses = `flex ${isMine ? 'justify-end' : 'justify-start'} ${!isSequence ? 'mt-2' : 'mt-1'}`;
  const messageBubbleClasses = `max-w-xs md:max-w-md rounded-lg px-4 py-2 ${
    isMine 
      ? 'bg-brand-pink text-white rounded-br-none' 
      : 'bg-bg-input text-text-primary rounded-bl-none'
  }`;

  return (
    <div className={messageContainerClasses}>
      <div className={messageBubbleClasses}>
        <p className="break-words">{message.content}</p>
        <div className={`text-xs mt-1 ${isMine ? 'text-right text-pink-100' : 'text-right text-text-secondary'} opacity-70`}>
          {messageTime}
        </div>
      </div>
    </div>
  );
};

MessageBubble.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    createdAt: PropTypes.string.isRequired,
    senderId: PropTypes.string.isRequired
  }).isRequired,
  isMine: PropTypes.bool,
  isSequence: PropTypes.bool
};

MessageBubble.defaultProps = {
  isMine: false,
  isSequence: false
};

export default React.memo(MessageBubble);
