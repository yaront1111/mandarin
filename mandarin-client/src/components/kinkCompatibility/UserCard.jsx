// src/components/kinkCompatibility/UserCard.jsx
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

/**
 * Displays a user's info, including kink compatibility percentage.
 * Also includes optional actions like private photo request and reporting.
 */
function UserCard({
  user,
  onRequestPrivate,
  onReportUser,
  onSendIcebreaker,
  onLike,
  onPass
}) {
  const { name, age, distance, compatibility, photoUrl, online } = user;

  return (
    <div className="user-card">
      {/* Image Section */}
      <div className="user-card-image">
        <img src={photoUrl} alt={name} />
        <div className="user-card-overlay">
          <div className="user-card-details">
            <div>
              <h3 className="user-name">{name}, {age}</h3>
              <p className="user-distance">{distance} miles away</p>
            </div>
            <div className="status-indicators">
              {online && (
                <span
                  className="online-indicator"
                  title="Online now"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="user-card-content">
        {/* Kink Compatibility */}
        <div className="compatibility-meter">
          <div className="compatibility-label">
            <div className="text-sm">Kink Compatibility</div>
            <div className="compatibility-value">{compatibility}%</div>
          </div>
          <div className="compatibility-bar">
            <div
              className="compatibility-progress"
              style={{ width: `${compatibility}%` }}
            />
          </div>
        </div>

        {/* Private Photo Request & Report */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            className="private-photo-request"
            onClick={() => onRequestPrivate(user)}
          >
            <span className="private-photo-icon not-requested">🔒</span>
            <span className="text-xs">Request Private</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary flex items-center"
            onClick={() => onReportUser(user)}
          >
            <span className="mr-1">🛡️</span>
            <span className="text-xs">Report</span>
          </button>
        </div>

        {/* Card Actions */}
        <div className="user-card-actions">
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => onPass(user)}
          >
            <span style={{ color: 'var(--color-error)' }}>✕</span>
          </button>
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => onSendIcebreaker(user)}
          >
            <span style={{ color: 'var(--color-info)' }}>💬</span>
          </button>
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => onLike(user)}
          >
            <span style={{ color: 'var(--color-primary)' }}>❤️</span>
          </button>
        </div>
      </div>
    </div>
  );
}

UserCard.propTypes = {
  user: PropTypes.shape({
    name: PropTypes.string.isRequired,
    age: PropTypes.number.isRequired,
    distance: PropTypes.number.isRequired,
    compatibility: PropTypes.number.isRequired,
    photoUrl: PropTypes.string.isRequired,
    online: PropTypes.bool,
  }).isRequired,
  /** Called when user requests private photos */
  onRequestPrivate: PropTypes.func,
  /** Called when user wants to report */
  onReportUser: PropTypes.func,
  /** Called when user wants to send an icebreaker */
  onSendIcebreaker: PropTypes.func,
  /** Called when user likes someone */
  onLike: PropTypes.func,
  /** Called when user passes (dislikes/swipes left) */
  onPass: PropTypes.func,
};

UserCard.defaultProps = {
  onRequestPrivate: () => {},
  onReportUser: () => {},
  onSendIcebreaker: () => {},
  onLike: () => {},
  onPass: () => {},
};

export default UserCard;
