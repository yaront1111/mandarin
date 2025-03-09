import React from 'react';
import PropTypes from 'prop-types';
import Avatar from '../ui/Avatar';

const MatchCard = ({ match, isActive, onClick }) => {
  // Determine which user to display (other than current user)
  const otherUser = match?.userA || match?.userB;
  
  // Calculate last message time or default
  const lastActive = match?.lastMessageAt 
    ? new Date(match.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'No messages yet';
  
  // Determine if user is online
  const isOnline = otherUser?.isOnline;
  
  // Handle unread counts
  const unreadCount = match?.unreadCount || 0;
  
  if (!otherUser) {
    return null;
  }
  
  return (
    <div 
      className={`p-3 hover:bg-opacity-70 cursor-pointer transition-colors ${
        isActive ? 'bg-brand-pink bg-opacity-10' : 'bg-bg-card'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center space-x-3">
        <div className="relative">
          <Avatar src={otherUser.avatar} alt={otherUser.firstName} size={48} />
          {isOnline && (
            <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-success ring-2 ring-bg-card"></span>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center">
            <h4 className={`font-medium truncate ${isActive ? 'text-brand-pink' : 'text-text-primary'}`}>
              {otherUser.firstName}
            </h4>
            <span className="text-xs text-text-secondary whitespace-nowrap">
              {lastActive}
            </span>
          </div>
          
          <div className="flex justify-between items-center mt-1">
            <p className="text-sm text-text-secondary truncate">
              {match.lastMessage || 'Start a conversation'}
            </p>
            
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-brand-pink text-white text-xs">
                {unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

MatchCard.propTypes = {
  match: PropTypes.object.isRequired,
  isActive: PropTypes.bool,
  onClick: PropTypes.func
};

MatchCard.defaultProps = {
  isActive: false,
  onClick: () => {}
};

export default MatchCard;
