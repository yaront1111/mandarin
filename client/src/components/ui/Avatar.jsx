// src/components/ui/Avatar.jsx
import React from 'react';
import PropTypes from 'prop-types';

function Avatar({ src, alt = 'avatar', size = 50 }) {
  const fallback = '/images/default-avatar.png';
  return (
    <img
      src={src || fallback}
      alt={alt}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover'
      }}
    />
  );
}

Avatar.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string,
  size: PropTypes.number
};

Avatar.defaultProps = {
  src: null,
  alt: 'avatar',
  size: 50
};

export default Avatar;
