// src/components/chat/ChatArea.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { classNames } from './chatUtils.jsx';
import styles from '../../styles/Messages.module.css';

/**
 * ChatArea component to encapsulate the chat area and handle blocked status styling
 */
const ChatArea = ({ children, isUserBlocked = false, className = '', ...rest }) => {
  // Ensure className is always a string
  const normalizedClassName = typeof className === 'boolean' 
    ? (className ? 'active' : '') // Convert boolean to appropriate string
    : (className || ''); // Use empty string as fallback if null/undefined
    
  return (
    <div 
      className={classNames(
        styles.chatArea,
        isUserBlocked && styles.blockedChatArea,
        normalizedClassName
      )} 
      {...rest}
    >
      {children}
    </div>
  );
};

ChatArea.propTypes = {
  children: PropTypes.node.isRequired,
  isUserBlocked: PropTypes.bool,
  className: PropTypes.string
};

export default React.memo(ChatArea);