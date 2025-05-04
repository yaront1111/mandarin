// src/components/chat/TypingIndicator.jsx
import React from 'react';
import PropTypes from 'prop-types';
import styles from '../../styles/Messages.module.css';

/**
 * Displays an animated typing indicator
 */
const TypingIndicator = ({ userName = null }) => {
  return (
    <div className={styles.typingIndicatorBubble}>
      <div className={styles.typingIndicator}>
        <div className={styles.dot}></div>
        <div className={styles.dot}></div>
        <div className={styles.dot}></div>
      </div>
      {userName && <span className={styles.typingUserName}>{userName} is typing...</span>}
    </div>
  );
};

TypingIndicator.propTypes = {
  userName: PropTypes.string
};

export default TypingIndicator;