// src/components/chat/ChatHeader.jsx
import React from 'react';
import PropTypes from 'prop-types';

const ChatHeader = ({ match }) => {
  // Your component code...
  return (
    <div className="flex items-center p-4 border-b border-gray-800 bg-bg-card">
      {/* Header content */}
    </div>
  );
};

ChatHeader.propTypes = {
  match: PropTypes.object.isRequired
};

export default ChatHeader;
