import React from 'react';
import PropTypes from 'prop-types';

/**
 * MessageInput component provides an input field for sending messages.
 */
const MessageInput = ({ value = '', onChange, onSend }) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSend();
      }
    }
  };

  return (
    <div className="p-4 border-t border-gray-800 bg-bg-card">
      <div className="flex">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          aria-label="Message input"
          className="flex-1 bg-bg-input rounded-l-full px-4 py-2 focus:outline-none focus:ring-1 focus:ring-brand-pink"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!value.trim()}
          aria-label="Send message"
          className="bg-brand-pink text-white rounded-r-full px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
};

MessageInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onSend: PropTypes.func.isRequired,
};

export default React.memo(MessageInput);
