import React from 'react';

export default function Badge({ children, color = 'blue' }) {
  const style = {
    backgroundColor: color,
    color: '#fff',
    padding: '0.25rem 0.5rem',
    borderRadius: '0.5rem'
  };

  return <span style={style}>{children}</span>;
}
