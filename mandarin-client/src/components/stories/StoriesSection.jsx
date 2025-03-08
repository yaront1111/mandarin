// src/components/stories/StoriesSection.jsx
import React from 'react';
import PropTypes from 'prop-types';
import StoryItem from './StoryItem';

/**
 * Renders a row of story items, possibly scrollable horizontally.
 * - Each story is displayed via <StoryItem />.
 */
function StoriesSection({
  stories,
  onClickStory,
}) {
  return (
    <div className="stories-section">
      <h2 className="section-title mb-4">Stories</h2>

      <div className="stories-list">
        {stories.map((story) => (
          <StoryItem
            key={story.id}
            story={story}
            onClick={() => onClickStory(story)}
          />
        ))}
      </div>
    </div>
  );
}

StoriesSection.propTypes = {
  /** Array of story objects with shape { id, userName, avatarUrl, ... } */
  stories: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    userName: PropTypes.string.isRequired,
    avatarUrl: PropTypes.string,
  })).isRequired,
  /** Called when a story item is clicked */
  onClickStory: PropTypes.func,
};

StoriesSection.defaultProps = {
  onClickStory: () => {},
};

export default StoriesSection;
