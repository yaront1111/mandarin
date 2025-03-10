import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import ChatHeader from './ChatHeader';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

/**
 * ChatWindow component manages the chat conversation UI.
 */
const ChatWindow = ({ match, messages, onSendMessage }) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  // Determine the other user from match details
  const otherUser = match?.userA || match?.userB;

  if (!match || !otherUser) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-text-secondary">Select a match to start chatting</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <ChatHeader match={match} />
      <div className="flex-1 overflow-y-auto p-4 bg-bg-dark">
        {/* Optional: Date separator */}
        <div className="flex justify-center mb-4">
          <span className="px-3 py-1 bg-bg-input rounded-full text-xs text-text-secondary">
            Today
          </span>
        </div>
        <div className="space-y-4">
          {messages.length > 0 ? (
            messages.map(msg => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isMine={msg.senderId === match.currentUserId} // Adjust if you store current user info in match object
              />
            ))
          ) : (
            <div className="text-center text-text-secondary py-8">
              No messages yet. Start the conversation!
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <MessageInput value={newMessage} onChange={setNewMessage} onSend={handleSendMessage} />
    </div>
  );
};

ChatWindow.propTypes = {
  match: PropTypes.object,
  messages: PropTypes.array,
  onSendMessage: PropTypes.func
};

ChatWindow.defaultProps = {
  messages: [],
  onSendMessage: () => {}
};

export default ChatWindow;
