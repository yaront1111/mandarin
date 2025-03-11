// src/components/chat/WinkMessage.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';
import Avatar from '../ui/Avatar';
import { formatDistanceToNow } from '../../utils/dateFormatter';
import { sendWink } from '../../services/matchService';

const WinkMessage = ({
  user,
  timestamp,
  onReply,
  onStartChat,
  isPremium,
  isRead = false,
  onMarkAsRead
}) => {
  const dispatch = useDispatch();

  // Format the timestamp
  const formattedTime = timestamp ? formatDistanceToNow(new Date(timestamp), { addSuffix: true }) : '';

  // Handle reply wink action
  const handleReplyWink = async () => {
    try {
      if (!isRead && onMarkAsRead) {
        onMarkAsRead();
      }

      await sendWink(user.id);

      dispatch({
        type: 'ui/showToast',
        payload: {
          type: 'success',
          message: `Wink sent to ${user.firstName}!`
        }
      });

      if (onReply) {
        onReply();
      }
    } catch (error) {
      console.error('Error sending wink:', error);
      dispatch({
        type: 'ui/showToast',
        payload: {
          type: 'error',
          message: 'Failed to send wink. Please try again.'
        }
      });
    }
  };

  // Handle start chat action
  const handleStartChat = () => {
    if (!isPremium) {
      dispatch({ type: 'ui/showUpgradeModal', payload: 'messaging' });
      return;
    }

    if (!isRead && onMarkAsRead) {
      onMarkAsRead();
    }

    if (onStartChat) {
      onStartChat();
    }
  };

  return (
    <div className={`p-4 bg-bg-card rounded-lg shadow-md border ${isRead ? 'border-gray-800' : 'border-brand-pink'}`}>
      {/* User info and timestamp */}
      <div className="flex items-center mb-3">
        <Avatar src={user.avatar} alt={user.firstName} size={40} />
        <div className="ml-3 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-text-primary">{user.firstName}</h3>
            {!isRead && (
              <span className="bg-brand-pink text-white text-xs px-2 py-0.5 rounded-full">
                New
              </span>
            )}
          </div>
          <p className="text-text-secondary text-xs">
            {formattedTime}
          </p>
        </div>
      </div>

      {/* Wink message */}
      <div className="flex items-center justify-center py-6 px-4 bg-bg-dark rounded-lg mb-4">
        <div className="text-4xl mr-3">👁️</div>
        <div>
          <p className="text-lg text-text-primary font-medium">
            {user.firstName} winked at you!
          </p>
          <p className="text-sm text-text-secondary">
            Send a wink back or start a conversation
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={handleReplyWink}
          className="flex-1 py-2 px-4 bg-brand-pink text-white rounded-md hover:bg-opacity-90 transition-colors"
        >
          <div className="flex items-center justify-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Wink Back
          </div>
        </button>

        <button
          onClick={handleStartChat}
          className={`flex-1 py-2 px-4 rounded-md transition-colors ${
            isPremium 
              ? 'bg-bg-input text-text-primary hover:bg-opacity-80' 
              : 'bg-bg-input text-text-secondary'
          } border border-gray-700 flex items-center justify-center`}
        >
          {isPremium ? (
            <>
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Start Chat
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Premium Only
            </>
          )}
        </button>
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
  onReply: PropTypes.func,
  onStartChat: PropTypes.func,
  isPremium: PropTypes.bool,
  isRead: PropTypes.bool,
  onMarkAsRead: PropTypes.func
};

WinkMessage.defaultProps = {
  isPremium: false,
  isRead: false,
  onReply: () => {},
  onStartChat: () => {},
  onMarkAsRead: () => {}
};

export default WinkMessage;
