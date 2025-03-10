// src/components/chat/ChatWindow.jsx
import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import ChatHeader from './ChatHeader';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

/**
 * ChatWindow component manages the chat conversation UI.
 */
const ChatWindow = ({ match, messages, onSendMessage }) => {
  const { user } = useSelector(state => state.auth);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

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

  // Group messages by date for better visual separation
  const groupedMessages = React.useMemo(() => {
    if (!messages || messages.length === 0) return {};
    
    return messages.reduce((groups, message) => {
      const date = new Date(message.createdAt).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
      return groups;
    }, {});
  }, [messages]);

  // Determine the other user from match details
  const otherUser = match?.userA?.id !== user?.id ? match?.userA : match?.userB;

  if (!match || !otherUser) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-text-secondary">Select a match to start chatting</p>
      </div>
    );
  }

  // Create a richer match object for the header
  const enhancedMatch = {
    ...match,
    otherUserName: otherUser.firstName,
    otherUserAvatar: otherUser.avatar,
    otherUserIsOnline: otherUser.isOnline,
    currentUserId: user?.id
  };

  return (
    <div className="h-full flex flex-col">
      <ChatHeader match={enhancedMatch} />
      <div className="flex-1 overflow-y-auto p-4 bg-bg-dark" ref={messagesContainerRef}>
        {messages.length > 0 ? (
          Object.entries(groupedMessages).map(([date, dayMessages]) => (
            <div key={date} className="mb-6">
              {/* Date separator */}
              <div className="flex justify-center mb-4">
                <span className="px-3 py-1 bg-bg-input rounded-full text-xs text-text-secondary">
                  {date === new Date().toLocaleDateString() ? 'Today' : date}
                </span>
              </div>
              
              {/* Messages for this date */}
              <div className="space-y-4">
                {dayMessages.map((msg, index) => {
                  // Check if this message is part of a sequence from same sender
                  const isSequence = index > 0 && dayMessages[index - 1].senderId === msg.senderId;
                  
                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isMine={msg.senderId === user?.id || msg.senderId === 'current-user'}
                      isSequence={isSequence}
                    />
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-text-secondary py-16 flex flex-col items-center">
            <div className="w-16 h-16 bg-bg-input rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="mb-2">No messages yet</p>
            <p className="text-sm">Start the conversation with {otherUser.firstName}!</p>
          </div>
        )}
        <div ref={messagesEndRef} />
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
