import React from 'react';

export default function InterestTags({ interests = [] }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {interests.map((tag, i) => (
        <span
          key={i}
          style={{
            backgroundColor: '#ddd',
            padding: '0.25rem 0.5rem',
            borderRadius: '4px'
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
