// src/components/chat/ChatHeader.jsx
import React from 'react';
import PropTypes from 'prop-types';
import Avatar from '../ui/Avatar';

/**
 * ChatHeader component renders the header for the chat window.
 */
const ChatHeader = ({ match }) => {
  return (
    <div className="flex items-center p-4 border-b border-gray-800 bg-bg-card">
      <div className="flex items-center">
        <div className="relative">
          <Avatar 
            src={match?.otherUserAvatar} 
            alt={match?.otherUserName || 'Chat'} 
            size={40} 
          />
          {match?.otherUserIsOnline && (
            <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-bg-card"></span>
          )}
        </div>
        <div className="ml-3">
          <h2 className="text-lg font-semibold text-text-primary">
            {match?.otherUserName || 'Chat'}
          </h2>
          <p className="text-xs text-text-secondary">
            {match?.otherUserIsOnline ? 'Online now' : 'Offline'}
          </p>
        </div>
      </div>
      
      <div className="ml-auto flex items-center space-x-3">
        {/* Optional buttons for additional functionality */}
        <button className="w-8 h-8 rounded-full bg-bg-input flex items-center justify-center text-text-secondary hover:text-brand-pink transition-colors">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </button>
        <button className="w-8 h-8 rounded-full bg-bg-input flex items-center justify-center text-text-secondary hover:text-brand-pink transition-colors">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
      </div>
    </div>
  );
};

ChatHeader.propTypes = {
  match: PropTypes.object.isRequired,
};

export default ChatHeader;
