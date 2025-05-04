// src/components/chat/EmojiPicker.jsx
import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FaTimes } from 'react-icons/fa';
import { COMMON_EMOJIS } from './chatConstants.js';
import styles from '../../styles/Messages.module.css';

/**
 * Reusable emoji picker component
 */
const EmojiPicker = ({
  isVisible,
  onClose,
  onEmojiClick,
  customEmojis = null,
}) => {
  const emojiPickerRef = useRef(null);
  const emojis = customEmojis || COMMON_EMOJIS;

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emojiPickerRef.current && 
        !emojiPickerRef.current.contains(event.target) && 
        !event.target.closest(`.${styles.emojiButton}`)
      ) {
        onClose();
      }
    };
    
    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div 
      className={styles.emojiPicker} 
      ref={emojiPickerRef}
      role="dialog" 
      aria-label="Emoji picker"
    >
      <div className={styles.emojiHeader}>
        <h4>Select Emoji</h4>
        <button 
          onClick={onClose} 
          aria-label="Close emoji picker"
          type="button"
        >
          <FaTimes />
        </button>
      </div>
      <div className={styles.emojiList}>
        {emojis.map((emoji) => (
          <button 
            key={emoji} 
            type="button" 
            onClick={() => onEmojiClick(emoji)} 
            title={emoji} 
            aria-label={`Emoji ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

EmojiPicker.propTypes = {
  isVisible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onEmojiClick: PropTypes.func.isRequired,
  customEmojis: PropTypes.arrayOf(PropTypes.string),
};

export default React.memo(EmojiPicker);