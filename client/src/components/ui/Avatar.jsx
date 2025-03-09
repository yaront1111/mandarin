// src/components/ui/Avatar.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { getAvatarUrl } from '../../utils/imageUtils';
import Image from './Image';

function Avatar({ src, alt = 'avatar', size = 50, className = '' }) {
  const avatar = getAvatarUrl(src, alt);
  const style = {
    width: size,
    height: size,
    borderRadius: '50%',
  };

  return (
    <div
      className={`bg-bg-input flex items-center justify-center overflow-hidden ${className}`}
      style={style}
    >
      {avatar.type === 'image' ? (
        <Image
          src={avatar.url}
          alt={alt}
          className="w-full h-full"
          fallbackSrc="/placeholder.jpg"
        />
      ) : (
        <span className="text-text-primary text-lg font-semibold">
          {avatar.initial}
        </span>
      )}
    </div>
  );
}

Avatar.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string,
  size: PropTypes.number,
  className: PropTypes.string
};

export default Avatar;
