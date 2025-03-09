// src/components/profile/InterestTags.jsx
import React from 'react';
import PropTypes from 'prop-types';

const InterestTags = ({ interests }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {interests.map((interest, index) => (
        <span 
          key={index}
          className="px-3 py-1 bg-bg-input rounded-full text-sm"
        >
          {interest}
        </span>
      ))}
    </div>
  );
};

InterestTags.propTypes = {
  interests: PropTypes.array.isRequired
};

export default InterestTags;
