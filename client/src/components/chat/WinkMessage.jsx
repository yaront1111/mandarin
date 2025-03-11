// src/components/chat/WinkMessage.jsx
import React from 'react';
import PropTypes from 'prop-types';
import Avatar from '../ui/Avatar';

const WinkMessage = ({
  user,
  timestamp,
  onReply,
  onStartChat,
  isPremium
}) => {
  return (
    <div className="p-4 bg-bg-card rounded-lg shadow-md border border-gray-800">
      <div className="flex items-center mb-3">
        <Avatar src={user.avatar} alt={user.firstName} size={40} />
        <div className="ml-3">
          <h3 className="font-semibold text-text-primary">{user.firstName}</h3>
          <p className="text-text-secondary text-xs">
            {new Date(timestamp).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center py-4 bg-bg-dark rounded-lg mb-3">
        <div className="text-brand-pink text-4xl">👁️</div>
        <p className="ml-2 text-lg text-text-primary font-medium">
          {user.firstName} just winked at you!
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={onReply}
          className="flex-1 py-2 px-4 bg-brand-pink text-white rounded-md hover:bg-opacity-90"
        >
          Wink Back
        </button>

        {isPremium ? (
          <button
            onClick={onStartChat}
            className="flex-1 py-2 px-4 bg-bg-input text-text-primary rounded-md hover:bg-opacity-90 border border-gray-700"
          >
            Start Chat
          </button>
        ) : (
          <button
            onClick={() => alert("Upgrade to Premium to start chatting!")}
            className="flex-1 py-2 px-4 bg-bg-input text-text-secondary rounded-md border border-gray-700 flex items-center justify-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Premium Only
          </button>
        )}
      </div>
    </div>
  );
};

WinkMessage.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    firstName: PropTypes.string.isRequired,
    avatar: PropTypes.string
  }).isRequired,
  timestamp: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.instanceOf(Date)]).isRequired,
  onReply: PropTypes.func.isRequired,
  onStartChat: PropTypes.func.isRequired,
  isPremium: PropTypes.bool
};

WinkMessage.defaultProps = {
  isPremium: false
};

export default WinkMessage;
