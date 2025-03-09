import React from 'react';

export default function Button({ children, onClick, disabled, style }) {
  const baseStyle = {
    backgroundColor: disabled ? '#ccc' : '#007bff',
    color: '#fff',
    padding: '0.5rem 1rem',
    border: 'none',
    borderRadius: '4px',
    cursor: disabled ? 'not-allowed' : 'pointer'
  };

  return (
    <button
      style={{ ...baseStyle, ...style }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
