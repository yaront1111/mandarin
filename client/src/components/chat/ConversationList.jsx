// src/components/chat/ConversationList.jsx
import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { FaPlus, FaEnvelope } from 'react-icons/fa';
import styles from '../../styles/Messages.module.css';
import ConversationItem from './ConversationItem.jsx';

/**
 * Displays a list of conversations with preview of the last message
 */
const ConversationList = ({
  conversations = [],
  activeConversation = null,
  onConversationSelect,
  onNewConversation,
  currentUserId,
  onRefresh,
  conversationsLoading = false,
  conversationsListRef,
}) => {
  // Store a ref to use for gesture detection
  const listRef = useRef(null);
  
  // Assign the ref for external access if provided
  const assignRefs = (el) => {
    listRef.current = el;
    if (conversationsListRef) {
      conversationsListRef.current = el;
    }
  };

  return (
    <>
      <div className={styles.conversationsHeader}>
        <h2>Messages</h2>
        <button 
          onClick={onNewConversation} 
          className={styles.newMessageBtn}
          aria-label="New conversation"
          title="Start new conversation"
          type="button"
        >
          <FaPlus />
        </button>
      </div>

      <div 
        className={styles.conversationsList} 
        ref={assignRefs}
        role="list" 
        aria-label="Conversation list"
      >
        {conversations.length === 0 && !conversationsLoading ? (
          <div className={styles.noConversations}>
            <FaEnvelope size={24} aria-hidden="true" />
            <p>No conversations yet</p>
            <button 
              onClick={onNewConversation} 
              className={styles.startConversationBtn}
              type="button"
            >
              Start a Conversation
            </button>
          </div>
        ) : (
          conversations.map((convo) => {
            // Basic validation for conversation object
            if (!convo || !convo.user || !convo.user._id) {
              console.warn("Skipping rendering invalid conversation item:", convo);
              return null; // Skip rendering this item
            }
            
            // Ensure the user object has a username property
            if (!convo.user.username) {
              console.warn("User missing username property in conversation:", convo.user._id);
              convo = {
                ...convo,
                user: {
                  ...convo.user,
                  username: convo.user.nickname || "Unknown User"
                }
              };
            }
            
            return (
              <ConversationItem
                key={convo.user._id}
                conversation={convo}
                isActive={activeConversation && activeConversation.user._id === convo.user._id}
                currentUserId={currentUserId}
                onClick={onConversationSelect}
              />
            );
          })
        )}
      </div>
    </>
  );
};

ConversationList.propTypes = {
  conversations: PropTypes.arrayOf(PropTypes.shape({
    user: PropTypes.shape({
      _id: PropTypes.string.isRequired,
      username: PropTypes.string.isRequired,
      nickname: PropTypes.string,
      photo: PropTypes.string,
      online: PropTypes.bool,
    }).isRequired,
    lastMessage: PropTypes.shape({
      content: PropTypes.string,
      createdAt: PropTypes.string,
      type: PropTypes.string,
    }),
    unreadCount: PropTypes.number,
  })),
  activeConversation: PropTypes.object,
  onConversationSelect: PropTypes.func.isRequired,
  onNewConversation: PropTypes.func.isRequired,
  currentUserId: PropTypes.string.isRequired,
  onRefresh: PropTypes.func,
  conversationsLoading: PropTypes.bool,
  conversationsListRef: PropTypes.oneOfType([
    PropTypes.func, 
    PropTypes.shape({ current: PropTypes.any })
  ]),
};

export default React.memo(ConversationList);