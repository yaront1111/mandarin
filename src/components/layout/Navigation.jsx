// src/components/layout/Navigation.jsx
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

/**
 * Bottom navigation bar for tab-based navigation.
 * Each tab has an icon and label.
 */
function Navigation({ activeTab, onTabChange, chatCount }) {
  // For simplicity, we define nav items inline. You could also pass them as props.
  const navItems = [
    { key: 'discover', label: 'Discover', icon: '🔍' },
    { key: 'map', label: 'Map', icon: '🗺️' },
    { key: 'matches', label: 'Matches', icon: '❤️' },
    { key: 'messages', label: 'Chats', icon: '💬' },
    { key: 'stories', label: 'Stories', icon: '📷' },
    { key: 'profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <nav className="nav">
      <ul className="nav-list">
        {navItems.map(item => {
          const isActive = item.key === activeTab;
          return (
            <li key={item.key} className="nav-item">
              <button
                type="button"
                className={classNames('nav-link', { active: isActive })}
                onClick={() => onTabChange(item.key)}
              >
                <span>{item.icon}</span>
                {/* If it's the messages tab, show chatCount badge */}
                {item.key === 'messages' && chatCount > 0 && (
                  <span className="badge">{chatCount}</span>
                )}
                <span className="nav-link-text">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

Navigation.propTypes = {
  /** Key of the currently active tab (e.g. 'discover') */
  activeTab: PropTypes.string.isRequired,
  /** Called when a tab is clicked, passes the new tab key */
  onTabChange: PropTypes.func.isRequired,
  /** Number of unread messages (for the "messages" tab badge) */
  chatCount: PropTypes.number,
};

Navigation.defaultProps = {
  chatCount: 0,
};

export default Navigation;
