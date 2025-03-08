// src/components/screens/DiscoverGrid.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import UserCard from '../kinkCompatibility/UserCard';
import PrivatePhotoRequest from '../privatePhotos/PrivatePhotoRequest';

/**
 * Displays a grid of user cards for the "Discover" screen.
 * - Could also host filters, pagination, or other controls.
 */
function DiscoverGrid({ users, onReportUser }) {
  const [requestedUsers, setRequestedUsers] = useState([]);

  const handleRequestPrivate = (user) => {
    // Example logic: track user IDs for whom we've requested private photos
    setRequestedUsers((prev) => [...prev, user.id]);
  };

  const handleCancelRequest = (user) => {
    setRequestedUsers((prev) => prev.filter((id) => id !== user.id));
  };

  return (
    <div className="user-grid">
      {users.map((user) => {
        const hasRequested = requestedUsers.includes(user.id);

        return (
          <div key={user.id} className="user-card-container">
            <UserCard
              user={user}
              onRequestPrivate={() => console.log('Not implemented at the card level')}
              onReportUser={onReportUser}
              onSendIcebreaker={(u) => console.log('Icebreaker to', u.name)}
              onLike={(u) => console.log('Liked user:', u.name)}
              onPass={(u) => console.log('Passed on user:', u.name)}
            />
            {/* Optionally override or layer private photo logic here */}
            <div className="p-2">
              <PrivatePhotoRequest
                hasRequested={hasRequested}
                onRequestAccess={() => handleRequestPrivate(user)}
                onCancelRequest={() => handleCancelRequest(user)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

DiscoverGrid.propTypes = {
  /**
   * Array of user objects with shape:
   * {
   *   id: number|string,
   *   name: string,
   *   age: number,
   *   distance: number,
   *   compatibility: number,
   *   photoUrl: string,
   *   online: bool
   * }
   */
  users: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
    age: PropTypes.number.isRequired,
    distance: PropTypes.number.isRequired,
    compatibility: PropTypes.number.isRequired,
    photoUrl: PropTypes.string.isRequired,
    online: PropTypes.bool,
  })).isRequired,
  /** Callback for reporting a user */
  onReportUser: PropTypes.func,
};

DiscoverGrid.defaultProps = {
  onReportUser: (u) => console.log('Reporting user:', u),
};

export default DiscoverGrid;
