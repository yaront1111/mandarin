// src/components/ui/Image.jsx
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getFullImageUrl, isImageUrlValid } from '../../utils/imageUtils';

/**
 * A reliable image component with error handling and loading states
 */
const Image = ({
  src,
  alt = '',
  className = '',
  objectFit = 'cover',
  fallbackSrc = '/placeholder.jpg',
  onLoad,
  onError
}) => {
  const [imgSrc, setImgSrc] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);

    const fullSrc = getFullImageUrl(src);

    // Check if image exists and is loadable
    isImageUrlValid(fullSrc)
      .then(isValid => {
        if (isValid) {
          setImgSrc(fullSrc);
        } else {
          setImgSrc(fallbackSrc);
          setError(true);
          if (onError) onError();
        }
        setLoading(false);
      });

    return () => {
      // Cleanup if component unmounts during load check
    };
  }, [src, fallbackSrc, onError]);

  const handleLoad = () => {
    setLoading(false);
    if (onLoad) onLoad();
  };

  const handleError = () => {
    setError(true);
    setImgSrc(fallbackSrc);
    if (onError) onError();
  };

  return (
    <div className={`relative ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-input animate-pulse">
          <svg className="w-8 h-8 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      <img
        src={imgSrc || fallbackSrc}
        alt={alt}
        className={`w-full h-full ${objectFit === 'cover' ? 'object-cover' : 'object-contain'} ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onLoad={handleLoad}
        onError={handleError}
      />

      {error && !loading && (
        <div className="absolute bottom-0 left-0 right-0 bg-error bg-opacity-60 text-white text-xs p-1 text-center">
          Image Failed to Load
        </div>
      )}
    </div>
  );
};

Image.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string,
  className: PropTypes.string,
  objectFit: PropTypes.oneOf(['cover', 'contain']),
  fallbackSrc: PropTypes.string,
  onLoad: PropTypes.func,
  onError: PropTypes.func
};

export default Image;
