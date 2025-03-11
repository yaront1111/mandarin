// src/components/ui/Spinner.jsx
import React from 'react';
import PropTypes from 'prop-types';

const Spinner = ({ size = 'md', color = 'brand-pink' }) => {
  const sizeClass = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  }[size] || 'w-8 h-8';

  const borderClass = {
    sm: 'border-2',
    md: 'border-3',
    lg: 'border-4',
    xl: 'border-4'
  }[size] || 'border-3';

  return (
    <div className={`${sizeClass} rounded-full ${borderClass} border-t-transparent border-${color} animate-spin`}></div>
  );
};

Spinner.propTypes = {
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  color: PropTypes.string
};

export default Spinner;
