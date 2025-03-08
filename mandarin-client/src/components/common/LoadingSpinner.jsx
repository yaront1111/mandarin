// src/components/common/LoadingSpinner.jsx
import React from 'react';
import PropTypes from 'prop-types';

/**
 * A generic spinner for loading states.
 *
 * Usage:
 * {isLoading && <LoadingSpinner size={32} color="#FF00FF" />}
 */
function LoadingSpinner({ size, color }) {
  // Example: CSS-based spinner using "animate-spin" utility (Tailwind style)
  // or your own .spin animation from theme.css
  const spinnerStyle = {
    width: size,
    height: size,
    borderTopColor: color,
  };

  return (
    <div className="flex items-center justify-center p-4">
      <div
        className="rounded-full border-4 border-gray-300 border-t-transparent animate-spin"
        style={spinnerStyle}
      />
    </div>
  );
}

LoadingSpinner.propTypes = {
  /** Size in pixels for the spinner (width/height) */
  size: PropTypes.number,
  /** Color for the spinner's border-top */
  color: PropTypes.string,
};

LoadingSpinner.defaultProps = {
  size: 24,
  color: '#FFFFFF',
};

export default LoadingSpinner;
