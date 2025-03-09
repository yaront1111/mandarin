// src/components/ui/CompatibilityMeter.jsx
import React from 'react';
import PropTypes from 'prop-types';

const CompatibilityMeter = ({ score }) => {
  return (
    <div className="w-48 text-center">
      <div className="h-2 w-full bg-bg-input rounded-full overflow-hidden">
        <div 
          className="h-full bg-brand-pink"
          style={{ width: `${score}%` }}
        ></div>
      </div>
      <p className="text-lg font-semibold text-brand-pink mt-1">{score}% Match</p>
    </div>
  );
};

CompatibilityMeter.propTypes = {
  score: PropTypes.number.isRequired
};

export default CompatibilityMeter;
