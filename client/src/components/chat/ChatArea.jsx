// src/components/chat/ChatArea.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { classNames } from './chatUtils.jsx';
import styles from '../../styles/Messages.module.css';

/**
 * ChatArea component to encapsulate the chat area and handle blocked status styling
 */
const ChatArea = ({ children, isUserBlocked = false, className, ...rest }) => {
  return (
    <div 
      className={classNames(
        styles.chatArea,
        isUserBlocked && styles.blockedChatArea,
        className
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