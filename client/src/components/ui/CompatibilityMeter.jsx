import React from 'react';

export default function CompatibilityMeter({ score = 0 }) {
  // score 0-100
  const containerStyle = {
    width: '200px',
    height: '10px',
    backgroundColor: '#e0e0e0',
    borderRadius: '5px',
    overflow: 'hidden',
    marginBottom: '0.5rem'
  };

  const fillStyle = {
    width: `${score}%`,
    height: '100%',
    backgroundColor: score > 70 ? 'green' : score > 40 ? 'orange' : 'red'
  };

  return (
    <div>
      <div style={containerStyle}>
        <div style={fillStyle} />
      </div>
      <span>{score}% compatible</span>
    </div>
  );
}
