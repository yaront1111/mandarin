// src/components/discover/UserCard.jsx
import React, { useState, memo } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import Avatar from '../ui/Avatar';
import InterestTags from '../profile/InterestTags';
import { formatDistanceToNow } from '../../utils/dateFormatter';

const UserCard = ({
  user,
  isPremium,
  onLike,
  onSendWink,
  onSendMessage,
  onViewStories,
  onRequestPrivatePhotos
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { likedUsers } = useSelector(state => state.user);
  const isLiked = likedUsers.includes(user.id);
  const hasMatch = user.hasMatch || false;

  // Format the last active time
  const formatLastActive = (date) => {
    if (!date) return 'Unknown';
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  const handleLike = (e) => {
    e.stopPropagation();
    if (!isLiked) {
      onLike(user.id);
    }
  };

  const handleCardClick = () => {
    setIsExpanded(!isExpanded);
  };

  const handleWink = (e) => {
    e.stopPropagation();
    onSendWink(user.id);
  };

  const handleMessage = (e) => {
    e.stopPropagation();
    onSendMessage(user.id);
  };

  const handleViewStories = (e) => {
    e.stopPropagation();
    onViewStories(user.id);
  };

  const handleRequestPrivatePhotos = (e) => {
    e.stopPropagation();
    onRequestPrivatePhotos(user.id);
  };

  return (
    <div
      className={`bg-bg-card rounded-xl overflow-hidden shadow-lg transition-all duration-300 ${
        isExpanded ? 'scale-105 z-10 shadow-xl' : 'hover:shadow-xl'
      }`}
      onClick={handleCardClick}
    >
      <div className="relative">
        {/* Main image */}
        <div className="aspect-square bg-bg-input">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.firstName}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/images/default-avatar.png';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-secondary">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
        </div>

        {/* Status indicators */}
        <div className="absolute top-2 right-2 flex flex-col gap-2 items-end">
          {/* Online indicator */}
          {user.isOnline && (
            <div className="flex items-center bg-black bg-opacity-50 px-2 py-1 rounded-full">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
              <span className="text-white text-xs">Online</span>
            </div>
          )}

          {/* Match indicator */}
          {hasMatch && (
            <div className="flex items-center bg-brand-pink bg-opacity-80 px-2 py-1 rounded-full">
              <svg className="w-3 h-3 text-white mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span className="text-white text-xs">Match</span>
            </div>
          )}

          {/* Premium indicator for premium users */}
          {user.isPremium && (
            <div className="flex items-center bg-yellow-500 bg-opacity-80 px-2 py-1 rounded-full">
              <svg className="w-3 h-3 text-white mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              <span className="text-white text-xs">Premium</span>
            </div>
          )}
        </div>

        {/* Stories indicator */}
        {user.hasStories && (
          <button
            className="absolute top-2 left-2 bg-gradient-to-r from-brand-pink to-brand-purple rounded-full w-8 h-8 flex items-center justify-center border-2 border-white"
            onClick={handleViewStories}
            aria-label="View stories"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        )}

        {/* Name and age overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black to-transparent">
          <h3 className="text-white font-semibold text-lg">
            {user.firstName || 'Anonymous'}, {user.age || '?'}
          </h3>

          {/* Last active indicator */}
          {!user.isOnline && user.lastActive && (
            <p className="text-white text-xs opacity-80">
              Active {formatLastActive(user.lastActive)}
            </p>
          )}
        </div>
      </div>

      <div className="p-3">
        {/* Tags */}
        <div className="mb-2 min-h-[32px]">
          {user.interests && user.interests.length > 0 ? (
            <InterestTags interests={user.interests} />
          ) : (
            <p className="text-text-secondary text-xs italic">No interests listed</p>
          )}
        </div>

        {/* Last message */}
        {user.lastMessage && (
          <div className="text-text-secondary text-sm truncate mb-2">
            <span className="font-semibold">Last: </span>
            {user.lastMessage}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-between mt-2">
          <button
            className={`rounded-full w-10 h-10 flex items-center justify-center ${
              isLiked ? 'bg-brand-pink text-white' : 'bg-bg-input text-text-secondary hover:text-brand-pink'
            }`}
            onClick={handleLike}
            title={isLiked ? "Liked" : "Like"}
            aria-label={isLiked ? "Liked" : "Like"}
          >
            <svg className="w-5 h-5" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>

          {/* Free users can only send winks unless matched */}
          {!isPremium && !hasMatch ? (
            <button
              className="rounded-full w-10 h-10 flex items-center justify-center bg-bg-input text-text-secondary hover:text-brand-pink"
              onClick={handleWink}
              title="Send Wink"
              aria-label="Send Wink"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          ) : (
            <button
              className="rounded-full w-10 h-10 flex items-center justify-center bg-bg-input text-text-secondary hover:text-brand-pink"
              onClick={handleMessage}
              title="Send Message"
              aria-label="Send Message"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </button>
          )}

          {/* Private photos access button */}
          {user.hasPrivatePhotos && (
            <button
              className="rounded-full w-10 h-10 flex items-center justify-center bg-bg-input text-text-secondary hover:text-brand-pink"
              onClick={handleRequestPrivatePhotos}
              title="Request private photos"
              aria-label="Request private photos"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          )}
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <p className="text-text-primary text-sm mb-3">
              {user.bio || "This user hasn't written a bio yet."}
            </p>

            <div className="flex justify-between">
              <button
                className={`px-3 py-2 ${isPremium || hasMatch ? 'bg-brand-pink' : 'bg-bg-input text-text-secondary'} text-white rounded-md hover:bg-opacity-90 text-sm`}
                onClick={handleMessage}
              >
                {isPremium || hasMatch ? 'Send Message' : 'Premium Only'}
              </button>

              {isPremium && (
                <button
                  className="px-3 py-2 bg-brand-purple text-white rounded-md hover:bg-opacity-90 text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    // This would trigger video call functionality
                    console.log(`Video call to ${user.id}`);
                  }}
                >
                  Video Call
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

UserCard.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    firstName: PropTypes.string,
    age: PropTypes.number,
    bio: PropTypes.string,
    avatar: PropTypes.string,
    isOnline: PropTypes.bool,
    interests: PropTypes.array,
    hasStories: PropTypes.bool,
    hasPrivatePhotos: PropTypes.bool,
    lastMessage: PropTypes.string,
    lastActive: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    hasMatch: PropTypes.bool,
    isPremium: PropTypes.bool
  }).isRequired,
  isPremium: PropTypes.bool,
  onLike: PropTypes.func.isRequired,
  onSendWink: PropTypes.func.isRequired,
  onSendMessage: PropTypes.func.isRequired,
  onViewStories: PropTypes.func.isRequired,
  onRequestPrivatePhotos: PropTypes.func.isRequired
};

UserCard.defaultProps = {
  isPremium: false
};

// Use React.memo to prevent unnecessary re-renders
export default memo(UserCard);
