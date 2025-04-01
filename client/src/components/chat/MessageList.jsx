import React, { useEffect, useRef, useState } from 'react';
import { FaCheckDouble, FaCheck, FaSpinner } from 'react-icons/fa';
import { formatDate } from '../../utils';
import { groupMessagesByDate, classNames } from '../../utils/chatUtils';
import MessageItem from './MessageItem';
import { logger } from '../../utils';

// Create a logger for this component
const log = logger.create('MessageList');

/**
 * MessageList component - Renders a list of messages grouped by date
 * 
 * @param {Object} props - Component props
 * @param {Array} props.messages - Array of message objects to display
 * @param {Object} props.currentUser - Current user object
 * @param {boolean} props.isLoading - Whether messages are loading
 * @param {string} props.error - Error message, if any
 * @param {Function} props.onRetry - Function to call when retry button is clicked
 * @param {boolean} props.typingIndicator - Whether to show typing indicator
 * @param {Object} props.recipient - Recipient user object
 * @returns {React.ReactElement} The message list component
 */
const MessageList = ({ 
  messages,
  currentUser,
  isLoading,
  error,
  onRetry,
  typingIndicator,
  recipient
}) => {
  // Ref for auto-scrolling to bottom
  const messagesEndRef = useRef(null);
  
  // Group messages by date
  const groupedMessages = groupMessagesByDate(messages);
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (!messagesEndRef.current) return;
    
    // Only smooth scroll for new messages, not on initial load
    const behavior = messages.length > 0 ? 'smooth' : 'auto';
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    });
  }, [messages]);

  // Count how long we've been loading
  const [loadingTime, setLoadingTime] = useState(0);
  
  // Update loading timer
  useEffect(() => {
    let timer;
    if (isLoading && messages.length === 0) {
      timer = setInterval(() => {
        setLoadingTime(prev => prev + 1);
      }, 1000);
    } else {
      setLoadingTime(0);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isLoading, messages.length]);
  
  // Render loading state with fallback message after 5 seconds
  if (isLoading && messages.length === 0) {
    return (
      <div className="chat-messages-loading">
        <FaSpinner className="spin-animation" />
        <p>Loading messages{'.'.repeat(1 + (loadingTime % 3))}</p>
        
        {loadingTime > 5 && (
          <div className="loading-fallback">
            <p>This is taking longer than expected.</p>
            <button onClick={onRetry} className="retry-button">
              Try Again
            </button>
          </div>
        )}
      </div>
    );
  }

  if (error && messages.length === 0) {
    return (
      <div className="chat-messages-error">
        <p>Error: {error}</p>
        <button onClick={onRetry} className="retry-button">
          Try Again
        </button>
      </div>
    );
  }
  
  // No messages state
  if (!isLoading && messages.length === 0 && !error) {
    return (
      <div className="chat-messages-empty">
        <p>No messages yet. Start the conversation!</p>
      </div>
    );
  }

  return (
    <div className="chat-messages">
      {Object.entries(groupedMessages).map(([date, dateMessages]) => (
        <div key={date} className="message-group">
          <div className="message-date">
            <span>{date}</span>
          </div>
          {dateMessages.map((message, index) => {
            const isCurrentUser = message.sender === currentUser?._id;
            const showAvatar = !isCurrentUser && (
              index === 0 || 
              dateMessages[index - 1]?.sender !== message.sender
            );
            const isPending = message.status === 'pending' || message.pending;
            
            return (
              <MessageItem
                key={message._id || `temp-${message.tempId || index}`}
                message={message}
                isCurrentUser={isCurrentUser}
                showAvatar={showAvatar}
                recipient={recipient}
                isPending={isPending}
              />
            );
          })}
        </div>
      ))}
      
      {/* Typing indicator */}
      {typingIndicator && (
        <div className="typing-indicator">
          <div className="typing-bubble">
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
          </div>
          <span>{recipient?.nickname || 'User'} is typing...</span>
        </div>
      )}
      
      {/* Invisible element for scroll anchoring */}
      <div ref={messagesEndRef} className="message-end-anchor" />
      
      {/* Add styling */}
      <style>{`
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .chat-messages-loading, .chat-messages-error, .chat-messages-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 2rem;
          color: var(--text-light);
          text-align: center;
        }
        
        .spin-animation {
          animation: spin 1s linear infinite;
          font-size: 1.5rem;
          margin-bottom: 1rem;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .loading-fallback {
          margin-top: 1.5rem;
          padding: 0.75rem;
          background-color: var(--bg-light);
          border-radius: 8px;
          width: 80%;
          max-width: 300px;
          opacity: 0;
          animation: fadeIn 0.5s forwards;
        }
        
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        
        .loading-fallback p {
          font-size: 0.9rem;
          margin-bottom: 0.75rem;
        }
        
        .retry-button {
          margin-top: 1rem;
          padding: 0.5rem 1rem;
          background-color: var(--primary);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: background-color 0.2s;
        }
        
        .retry-button:hover {
          background-color: var(--primary-dark);
        }
        
        .chat-messages-empty {
          color: var(--text-medium);
          font-style: italic;
          opacity: 0.8;
        }
        
        .message-group {
          display: flex;
          flex-direction: column;
          margin-bottom: 1rem;
        }
        
        .message-date {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 1rem 0;
          position: relative;
        }
        
        .message-date::before,
        .message-date::after {
          content: '';
          flex: 1;
          height: 1px;
          background-color: var(--border-color);
          margin: 0 10px;
        }
        
        .message-date span {
          font-size: 0.8rem;
          color: var(--text-light);
          background-color: var(--bg-card);
          padding: 0 10px;
        }
        
        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          margin-left: 0.5rem;
          margin-top: 0.25rem;
          max-width: 80%;
        }
        
        .typing-bubble {
          display: flex;
          align-items: center;
          gap: 3px;
          padding: 10px;
          background-color: var(--light);
          border-radius: 18px;
        }
        
        .typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: var(--text-light);
          animation: typing-animation 1.4s infinite;
          opacity: 0.6;
        }
        
        .typing-dot:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        .typing-dot:nth-child(3) {
          animation-delay: 0.4s;
        }
        
        .typing-indicator span {
          font-size: 0.8rem;
          color: var(--text-light);
        }
        
        @keyframes typing-animation {
          0%, 60%, 100% {
            transform: translateY(0);
          }
          30% {
            transform: translateY(-4px);
          }
        }
        
        .message-end-anchor {
          height: 1px;
          width: 100%;
        }
        
        /* Dark mode */
        .dark .typing-bubble {
          background-color: var(--dark);
        }
        
        .dark .typing-dot {
          background-color: var(--light);
        }
        
        .dark .message-date span {
          background-color: var(--dark);
        }
      `}</style>
    </div>
  );
};

export default MessageList;