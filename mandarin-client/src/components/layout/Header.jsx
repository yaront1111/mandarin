// src/components/layout/Header.jsx
import React from 'react';
import PropTypes from 'prop-types';

/**
 * Top header component containing the logo/title,
 * optional premium badge, stealth mode toggle, and notifications.
 */
function Header({
  appTitle,
  showPremiumBadge,
  stealthMode,
  toggleStealthMode,
  notificationsCount,
}) {
  return (
    <header className="header">
      <div className="app-logo">
        <h1 className="app-title">{appTitle}</h1>
        {showPremiumBadge && (
          <span className="premium-badge">Premium</span>
        )}
      </div>

      <div className="header-actions">
        {/* Stealth Mode Toggle */}
        <button
          type="button"
          className="btn btn-icon"
          onClick={toggleStealthMode}
          aria-label="Toggle stealth mode"
        >
          {stealthMode ? '👁️‍🗨️' : '👁️'}
        </button>

        {/* Notifications Icon */}
        <button
          type="button"
          className="btn btn-icon relative"
          aria-label="Notifications"
        >
          <span>🔔</span>
          {notificationsCount > 0 && (
            <span className="badge">
              {notificationsCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

Header.propTypes = {
  /** Title or logo text */
  appTitle: PropTypes.string,
  /** Whether to show the 'Premium' badge */
  showPremiumBadge: PropTypes.bool,
  /** Current stealth mode state */
  stealthMode: PropTypes.bool,
  /** Function to toggle stealth mode */
  toggleStealthMode: PropTypes.func,
  /** Notifications count for the badge */
  notificationsCount: PropTypes.number,
};

Header.defaultProps = {
  appTitle: 'ConnectX',
  showPremiumBadge: false,
  stealthMode: false,
  toggleStealthMode: () => {},
  notificationsCount: 0,
};

export default Header;
