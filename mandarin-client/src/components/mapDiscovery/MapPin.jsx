// src/components/mapDiscovery/MapPin.jsx
import React from 'react';
import PropTypes from 'prop-types';

/**
 * Renders a user pin (e.g., initial or short label) on the map.
 * The position is handled by parent (MapView) via absolute styling.
 */
function MapPin({
  label,
  onClick,
  style,
}) {
  return (
    <div
      className="map-pin"
      style={style}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => e.key === 'Enter' && onClick()}
    >
      {label}
    </div>
  );
}

MapPin.propTypes = {
  /** The text or user initial(s) displayed in the pin */
  label: PropTypes.string.isRequired,
  /** Inline styles to position the pin (e.g., { top: '25%', left: '30%' }) */
  style: PropTypes.object,
  /** Handler when pin is clicked */
  onClick: PropTypes.func,
};

MapPin.defaultProps = {
  style: {},
  onClick: () => {},
};

export default MapPin;
