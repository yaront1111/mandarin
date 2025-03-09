import React from 'react';

export default function MessageBubble({ message, isOwn = false }) {
  const bubbleStyle = {
    margin: '0.5rem',
    padding: '0.5rem 1rem',
    borderRadius: '1.2rem',
    maxWidth: '80%',
    backgroundColor: isOwn ? '#dcf8c6' : '#ffffff',
    alignSelf: isOwn ? 'flex-end' : 'flex-start',
    boxShadow: '0 1px 1px rgba(0,0,0,0.2)',
  };

  return (
    <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
      <div style={bubbleStyle}>
        <p style={{ margin: 0 }}>{message.content}</p>
      </div>
    </div>
  );
}
