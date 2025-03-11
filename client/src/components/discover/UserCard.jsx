// src/components/discover/UserCard.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Avatar from '../ui/Avatar'
import InterestTags from '../profile/InterestTags';

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
  const [isLiked, setIsLiked] = useState(false);

  const handleLike = () => {
    if (!isLiked) {
      setIsLiked(true);
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
        isExpanded ? 'scale-105 z-10' : 'hover:shadow-xl'
      }`}
      onClick={handleCardClick}
    >
      <div className="relative">
        {/* Main image */}
        <div className="aspect-square">
          <img
            src={user.avatar || '/images/default-avatar.png'}
            alt={user.firstName}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Online indicator */}
        {user.isOnline && (
          <div className="absolute top-2 right-2 flex items-center bg-black bg-opacity-50 px-2 py-1 rounded-full">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
            <span className="text-white text-xs">Online</span>
          </div>
        )}

        {/* Stories indicator */}
        {user.hasStories && (
          <button
            className="absolute top-2 left-2 bg-gradient-to-r from-brand-pink to-brand-purple rounded-full w-8 h-8 flex items-center justify-center border-2 border-white"
            onClick={handleViewStories}
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        )}

        {/* Name and age overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black to-transparent">
          <h3 className="text-white font-semibold text-lg">
            {user.firstName}, {user.age}
          </h3>
        </div>
      </div>

      <div className="p-3">
        {/* Tags */}
        <div className="mb-2">
          <InterestTags interests={user.interests} />
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
            title="Like"
          >
            <svg className="w-5 h-5" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>

          {/* Free users can only send winks unless matched */}
          {!isPremium ? (
            <button
              className="rounded-full w-10 h-10 flex items-center justify-center bg-bg-input text-text-secondary hover:text-brand-pink"
              onClick={handleWink}
              title="Send Wink"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 8h.01M9 16h.01M19 8c-1.857-3.316-5.359-5-9-5-3.642 0-7.143 1.684-9 5 1.857 3.316 5.359 5 9 5 3.642 0 7.143-1.684 9-5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.5 10.5C9.5 11.33 8.83 12 8 12S6.5 11.33 6.5 10.5 7.17 9 8 9s1.5.67 1.5 1.5z" />
              </svg>
            </button>
          ) : (
            <button
              className="rounded-full w-10 h-10 flex items-center justify-center bg-bg-input text-text-secondary hover:text-brand-pink"
              onClick={handleMessage}
              title="Send Message"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          )}
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <p className="text-text-primary text-sm mb-3">{user.bio}</p>

            <div className="flex justify-between">
              <button
                className="px-3 py-2 bg-brand-pink text-white rounded-md hover:bg-opacity-90 text-sm"
                onClick={handleMessage}
              >
                {isPremium ? 'Send Message' : 'Quick Message'}
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
    firstName: PropTypes.string.isRequired,
    age: PropTypes.number.isRequired,
    bio: PropTypes.string,
    avatar: PropTypes.string,
    isOnline: PropTypes.bool,
    interests: PropTypes.array,
    hasStories: PropTypes.bool,
    hasPrivatePhotos: PropTypes.bool,
    lastMessage: PropTypes.string
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

export default UserCard;
