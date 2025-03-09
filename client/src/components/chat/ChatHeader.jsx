import React from 'react';

export default function ChatHeader({ title = 'Chat Room' }) {
  return (
    <div style={{ backgroundColor: '#f1f1f1', padding: '0.5rem' }}>
      <h2>{title}</h2>
    </div>
  );
}
