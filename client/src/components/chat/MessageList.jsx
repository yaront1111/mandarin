// src/components/chat/MessageList.jsx
import React, { useRef, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { groupMessagesByDate, formatMessageDateSeparator } from './chatUtils.jsx';
import MessageItem from './MessageItem.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import styles from '../../styles/Messages.module.css';
// Direct translation without helper functions

/**
 * Displays a list of messages grouped by date with date separators
 */
const MessageList = ({
  messages,
  currentUserId,
  messagesLoading = false,
  isSending = false,
  typingUser = null,
  isMobile = false,
  onScroll,
  messagesEndRef,
}) => {
  const containerRef = useRef(null);
  const { t } = useTranslation();

  // Memoized translations using direct t() calls with fallbacks
  const translations = useMemo(() => ({
    messageConversation: t('messageConversation') || 'Message conversation',
    loadingMessages: t('loadingMessages') || 'Loading messages',
    typing: t('typing') || 'is typing'
  }), [t]);
  
  // Keep scroll at bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef?.current && containerRef.current) {
      // Only auto-scroll if user is near the bottom (within 200px)
      const container = containerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
      
      if (isNearBottom) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, messagesEndRef]);

  // Group messages by date
  const groupedMessagesByDate = Array.isArray(messages) 
    ? groupMessagesByDate(messages) 
    : {};

  return (
    <div 
      className={styles.messagesArea} 
      ref={containerRef}
      onScroll={onScroll}
      role="log"
      aria-live="polite"
      aria-label={translations.messageConversation || "Message conversation"}
    >
      {Object.entries(groupedMessagesByDate).map(([date, dailyMessages]) => (
        <div key={date} className={styles.messageGroup}>
          <div className={styles.dateSeparator} aria-label={formatMessageDateSeparator(date)}>
            {formatMessageDateSeparator(date)}
          </div>
          
          {dailyMessages.map((message) => (
            <MessageItem
              key={message._id || message.tempId}
              message={message}
              currentUserId={currentUserId}
              isSending={isSending}
            />
          ))}
        </div>
      ))}
      
      {typingUser && <TypingIndicator userName={typingUser} />}
      
      {/* Invisible element used for auto-scrolling */}
      <div ref={messagesEndRef} className={styles.messagesEnd} aria-hidden="true" />
    </div>
  );
};

MessageList.propTypes = {
  messages: PropTypes.arrayOf(PropTypes.shape({
    _id: PropTypes.string,
    tempId: PropTypes.string,
    sender: PropTypes.string.isRequired,
    recipient: PropTypes.string,
    content: PropTypes.string,
    createdAt: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
  })).isRequired,
  currentUserId: PropTypes.string.isRequired,
  messagesLoading: PropTypes.bool,
  isSending: PropTypes.bool,
  typingUser: PropTypes.string,
  isMobile: PropTypes.bool,
  onScroll: PropTypes.func,
  messagesEndRef: PropTypes.oneOfType([
    PropTypes.func, 
    PropTypes.shape({ current: PropTypes.any })
  ])
};

export default React.memo(MessageList);