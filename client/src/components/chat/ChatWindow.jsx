import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import ChatHeader from './ChatHeader';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

const ChatWindow = ({ match, messages, onSendMessage }) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  // Get the other user (not current user)
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
        {/* Date separator */}
        <div className="flex justify-center mb-4">
          <span className="px-3 py-1 bg-bg-input rounded-full text-xs text-text-secondary">
            Today
          </span>
        </div>

        {/* Messages */}
        <div className="space-y-4">
          {messages?.length > 0 ? (
            messages.map(message => (
              <MessageBubble
                key={message.id}
                message={message}
                isMine={message.senderId !== otherUser.id}
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

      <MessageInput
        value={newMessage}
        onChange={setNewMessage}
        onSend={handleSendMessage}
      />
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
