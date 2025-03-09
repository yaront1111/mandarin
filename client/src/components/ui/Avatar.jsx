import React from 'react';

export default function Avatar({ src, alt = 'avatar', size = 50 }) {
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
