import React from 'react';
import PropTypes from 'prop-types';

/**
 * Reusable Card component with consistent styling
 */
const Card = ({ 
  children, 
  title, 
  subtitle, 
  className = '', 
  headerClassName = '',
  bodyClassName = '',
  footerClassName = '',
  footer,
  noPadding = false,
  onClick,
  hover = false 
}) => {
  return (
    <div 
      className={`card ${hover ? 'hover-effect' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {(title || subtitle) && (
        <div className={`card-header ${headerClassName}`}>
          {title && <h3 className="card-title">{title}</h3>}
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
      )}
      
      <div className={`card-body ${noPadding ? 'no-padding' : ''} ${bodyClassName}`}>
        {children}
      </div>
      
      {footer && (
        <div className={`card-footer ${footerClassName}`}>
          {footer}
        </div>
      )}
    </div>
  );
};

Card.propTypes = {
  children: PropTypes.node.isRequired,
  title: PropTypes.node,
  subtitle: PropTypes.node,
  className: PropTypes.string,
  headerClassName: PropTypes.string,
  bodyClassName: PropTypes.string,
  footerClassName: PropTypes.string,
  footer: PropTypes.node,
  noPadding: PropTypes.bool,
  onClick: PropTypes.func,
  hover: PropTypes.bool
};

export default Card;