// src/components/stories/StoryItem.jsx
import React from 'react';
import PropTypes from 'prop-types';

/**
 * Individual story item for a user.
 * Usually shown as a circular avatar plus a username below.
 */
function StoryItem({ story, onClick }) {
  const { userName, avatarUrl, isNew } = story;

  return (
    <div className="story-item" onClick={onClick} role="button" tabIndex={0}>
      <div className="story-avatar" style={{ borderColor: isNew ? 'var(--color-primary)' : 'var(--color-bg-input)' }}>
        <img src={avatarUrl} alt={`${userName}'s story`} />
      </div>
      <p className="story-user">{userName}</p>
    </div>
  );
}

StoryItem.propTypes = {
  /** Object with { id, userName, avatarUrl, isNew } */
  story: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    userName: PropTypes.string.isRequired,
    avatarUrl: PropTypes.string,
    isNew: PropTypes.bool,
  }).isRequired,
  /** Handler when story is clicked */
  onClick: PropTypes.func,
};

StoryItem.defaultProps = {
  onClick: () => {},
};

export default StoryItem;
