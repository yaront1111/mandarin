import React from 'react';
import PropTypes from 'prop-types';

/**
 * Reusable loading spinner component
 */
const LoadingSpinner = ({ 
  size = 'medium', 
  color = 'primary', 
  centered = false,
  fullPage = false,
  text = '',
  className = '',
  overlay = false
}) => {
  const spinnerSizeClass = size === 'small' 
    ? 'spinner-sm' 
    : size === 'large' 
      ? 'spinner-lg' 
      : '';
  
  const spinnerColorClass = `spinner-${color}`;
  
  const containerClasses = `spinner-container 
    ${centered ? 'centered' : ''} 
    ${fullPage ? 'full-page' : ''} 
    ${overlay ? 'with-overlay' : ''} 
    ${className}`;
  
  return (
    <div className={containerClasses}>
      {overlay && <div className="spinner-overlay"></div>}
      <div className={`spinner ${spinnerSizeClass} ${spinnerColorClass}`}>
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
        <div className="spinner-blade"></div>
      </div>
      {text && <p className="spinner-text">{text}</p>}
    </div>
  );
};

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  color: PropTypes.oneOf(['primary', 'secondary', 'light', 'dark']),
  centered: PropTypes.bool,
  fullPage: PropTypes.bool,
  text: PropTypes.string,
  className: PropTypes.string,
  overlay: PropTypes.bool
};

export default LoadingSpinner;