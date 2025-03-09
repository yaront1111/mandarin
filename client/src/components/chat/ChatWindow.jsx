import React from 'react';
import ChatHeader from './ChatHeader';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

export default function ChatWindow({ messages = [], onSend, title }) {
  return (
    <div style={{ border: '1px solid #ccc', width: '100%', maxWidth: '600px', margin: '0 auto' }}>
      <ChatHeader title={title} />
      <div style={{ height: '300px', overflowY: 'auto', padding: '0.5rem' }}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isOwn={msg.isOwn} />
        ))}
      </div>
      <MessageInput onSend={onSend} />
    </div>
  );
}
