// src/components/mapDiscovery/MapView.jsx
import React from 'react';
import PropTypes from 'prop-types';
import MapPin from './MapPin';

/**
 * A container that renders a map (placeholder or real)
 * and positions pins for each user location.
 */
function MapView({ mapImageUrl, pins, onPinClick }) {
  return (
    <div className="map-container">
      <img
        src={mapImageUrl}
        alt="Map"
      />

      {/* Render each pin */}
      {pins.map((pin) => (
        <MapPin
          key={pin.id}
          label={pin.label}
          style={{ top: pin.top, left: pin.left, right: pin.right, bottom: pin.bottom }}
          onClick={() => onPinClick(pin)}
        />
      ))}

      {/* Example controls in bottom-right corner */}
      <div className="map-controls">
        <button className="btn btn-icon">
          <span>🔍</span>
        </button>
        <button className="btn btn-icon">
          <span style={{ color: 'var(--color-warning)' }}>⚡</span>
        </button>
      </div>
    </div>
  );
}

MapView.propTypes = {
  /** URL or path for the map image (or can be a real map library) */
  mapImageUrl: PropTypes.string.isRequired,
  /**
   * Array of pin objects:
   * [
   *   { id: 1, label: 'J', top: '25%', left: '25%' },
   *   { id: 2, label: 'M', top: '33%', right: '33%' },
   *   ...
   * ]
   */
  pins: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    label: PropTypes.string.isRequired,
    top: PropTypes.string,
    left: PropTypes.string,
    right: PropTypes.string,
    bottom: PropTypes.string,
  })),
  /** Called when a pin is clicked */
  onPinClick: PropTypes.func,
};

MapView.defaultProps = {
  pins: [],
  onPinClick: () => {},
};

export default MapView;
