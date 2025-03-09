// src/components/ui/UserCard.jsx
import React from 'react';
import PropTypes from 'prop-types';
import Avatar from './Avatar';

const UserCard = ({ user, onClick }) => {
  if (!user) {
    return null;
  }

  return (
    <div
      className="p-3 bg-bg-card hover:bg-opacity-70 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex flex-col items-center">
        <div className="relative">
          <Avatar src={user.avatar} alt={user.firstName} size={64} />
          {user.isOnline && (
            <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-success ring-2 ring-bg-card"></span>
          )}
        </div>
        <h4 className="font-medium truncate text-text-primary mt-2">
          {user.firstName}
        </h4>
        {user.age && (
          <p className="text-xs text-text-secondary">
            {user.age} yrs
          </p>
        )}
      </div>
    </div>
  );
};

UserCard.propTypes = {
  user: PropTypes.shape({
    avatar: PropTypes.string,
    firstName: PropTypes.string,
    isOnline: PropTypes.bool,
    age: PropTypes.number,
  }).isRequired,
  onClick: PropTypes.func,
};

UserCard.defaultProps = {
  onClick: () => {},
};

export default UserCard;
