// src/components/ui/CompatibilityMeter.jsx
import React from 'react';
import PropTypes from 'prop-types';

const CompatibilityMeter = ({ score }) => {
  // Ensure score is within 0-100 range
  const validScore = Math.min(100, Math.max(0, score));

  // Determine color based on score
  const getColor = (score) => {
    if (score >= 80) return 'from-brand-pink to-brand-purple';
    if (score >= 60) return 'from-green-500 to-teal-500';
    if (score >= 40) return 'from-yellow-500 to-amber-500';
    return 'from-red-500 to-orange-500';
  };

  const color = getColor(validScore);

  // Calculate dash array and offset for SVG circle
  const circumference = 2 * Math.PI * 45; // 45 is the radius
  const strokeDashoffset = circumference - (validScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        {/* Background circle */}
        <svg className="w-full h-full" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#2D2D3A"
            strokeWidth="8"
          />

          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={`url(#${color.replace(/[^a-zA-Z0-9]/g, '')})`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 50 50)"
          />

          {/* Gradient definition */}
          <defs>
            <linearGradient id={color.replace(/[^a-zA-Z0-9]/g, '')} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color.split(' ')[0].replace('from-', '')} />
              <stop offset="100%" stopColor={color.split(' ')[1].replace('to-', '')} />
            </linearGradient>
          </defs>
        </svg>

        {/* Score text */}
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-2xl font-bold">{validScore}%</span>
          <span className="text-xs text-text-secondary">Match</span>
        </div>
      </div>

      <p className="mt-2 text-center text-sm text-text-secondary">
        Compatibility Score
      </p>
    </div>
  );
};

CompatibilityMeter.propTypes = {
  score: PropTypes.number.isRequired
};

CompatibilityMeter.defaultProps = {
  score: 0
};

export default CompatibilityMeter;
