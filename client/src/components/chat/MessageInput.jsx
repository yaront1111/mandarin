import React, { useState } from 'react';

export default function MessageInput({ onSend }) {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim()) return;
    if (onSend) onSend(text.trim());
    setText('');
  };

  return (
    <div style={{ display: 'flex', padding: '0.5rem', borderTop: '1px solid #ccc' }}>
      <input
        type="text"
        style={{ flex: 1, padding: '0.5rem' }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSend();
        }}
        placeholder="Type a message..."
      />
      <button style={{ marginLeft: '0.5rem' }} onClick={handleSend}>
        Send
      </button>
    </div>
  );
}
