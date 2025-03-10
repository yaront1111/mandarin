import React from 'react';
import PropTypes from 'prop-types';

/**
 * ChatHeader component renders the header for the chat window.
 */
const ChatHeader = ({ match }) => {
  // Render header based on match details (e.g., display the other user's name or avatar)
  return (
    <div className="flex items-center p-4 border-b border-gray-800 bg-bg-card">
      {/* Example: Show match partner's name */}
      <h2 className="text-lg font-semibold">
        {match?.otherUserName || 'Chat'}
      </h2>
    </div>
  );
};

ChatHeader.propTypes = {
  match: PropTypes.object.isRequired,
};

export default ChatHeader;
