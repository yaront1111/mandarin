import React, { useState, useRef, useEffect } from 'react';
import { FaSmile, FaPaperPlane, FaPaperclip, FaTimes, FaSpinner } from 'react-icons/fa';
import { logger } from '../../utils';

// Create a logger for this component
const log = logger.create('MessageInput');

// Common emoji shortcuts
const commonEmojis = ['😊', '😂', '👍', '❤️', '🎉', '🙏', '😉', '🔥', '💯', '👏'];

/**
 * MessageInput component - Renders the message input field with emoji and file upload
 * 
 * @param {Object} props - Component props
 * @param {string} props.value - Current input value
 * @param {Function} props.onChange - Function to call when input changes
 * @param {Function} props.onSend - Function to call when send button is clicked
 * @param {Function} props.onTyping - Function to call when user is typing
 * @param {Function} props.onFileSelect - Function to call when file is selected
 * @param {Object} props.attachment - Currently selected attachment
 * @param {Function} props.onClearAttachment - Function to clear attachment
 * @param {boolean} props.isUploading - Whether a file is currently uploading
 * @param {number} props.uploadProgress - Upload progress percentage
 * @returns {React.ReactElement} The message input component
 */
const MessageInput = ({
  value,
  onChange,
  onSend,
  onTyping,
  onFileSelect,
  attachment,
  onClearAttachment,
  isUploading,
  uploadProgress
}) => {
  const [showEmojis, setShowEmojis] = useState(false);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  
  // Handle click outside emoji picker to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojis(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Focus input when component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);
  
  // Handle key presses
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() || attachment) {
        handleSend();
      }
    }
  };
  
  // Handle typing notification
  const handleInput = (e) => {
    onChange(e.target.value);
    if (onTyping) {
      onTyping();
    }
  };
  
  // Handle send button click
  const handleSend = () => {
    if ((value.trim() || attachment) && !isUploading) {
      onSend();
      setShowEmojis(false);
    }
  };
  
  // Handle emoji selection
  const handleEmojiSelect = (emoji) => {
    onChange(value + emoji);
    inputRef.current.focus();
  };
  
  // Handle file button click
  const handleFileButtonClick = () => {
    fileInputRef.current.click();
  };
  
  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      log.debug(`File selected: ${file.name} (${file.type})`);
      onFileSelect(file);
    }
    
    // Reset the input value to allow selecting the same file again
    e.target.value = '';
  };
  
  return (
    <div className="message-input-container">
      {/* Attachment preview */}
      {attachment && (
        <div className="attachment-preview">
          <div className="attachment-info">
            {isUploading ? (
              <>
                <FaSpinner className="spin" />
                <span>Uploading... {uploadProgress}%</span>
              </>
            ) : (
              <span>{attachment.name}</span>
            )}
          </div>
          <button 
            className="clear-attachment" 
            onClick={onClearAttachment}
            disabled={isUploading}
            aria-label="Remove attachment"
          >
            <FaTimes />
          </button>
        </div>
      )}
      
      <div className="input-row">
        {/* File input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          accept="image/*,application/pdf,text/plain,audio/*,video/*"
        />
        
        {/* Attachment button */}
        <button 
          className="input-button file-button" 
          onClick={handleFileButtonClick}
          disabled={isUploading}
          aria-label="Attach file"
        >
          <FaPaperclip />
        </button>
        
        {/* Text input */}
        <div className="text-input-wrapper">
          <textarea
            ref={inputRef}
            value={value}
            onChange={handleInput}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="message-text-input"
            rows={1}
            disabled={isUploading}
          />
        </div>
        
        {/* Emoji button */}
        <button 
          className="input-button emoji-button" 
          onClick={() => setShowEmojis(!showEmojis)}
          aria-label="Insert emoji"
        >
          <FaSmile />
        </button>
        
        {/* Send button */}
        <button 
          className={`input-button send-button ${(value.trim() || attachment) && !isUploading ? 'active' : 'disabled'}`}
          onClick={handleSend}
          disabled={!(value.trim() || attachment) || isUploading}
          aria-label="Send message"
        >
          <FaPaperPlane />
        </button>
      </div>
      
      {/* Emoji picker */}
      {showEmojis && (
        <div className="emoji-picker" ref={emojiPickerRef}>
          {commonEmojis.map((emoji, index) => (
            <button 
              key={index}
              className="emoji-item"
              onClick={() => handleEmojiSelect(emoji)}
              aria-label={`Emoji ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      
      {/* Add styling */}
      <style jsx>{`
        .message-input-container {
          padding: 0.5rem;
          background-color: var(--bg-light);
          border-top: 1px solid var(--border-color);
        }
        
        .attachment-preview {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem;
          background-color: var(--bg-card);
          border-radius: 8px;
          margin-bottom: 0.5rem;
        }
        
        .attachment-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: var(--text-medium);
        }
        
        .clear-attachment {
          background: none;
          border: none;
          color: var(--text-light);
          cursor: pointer;
          font-size: 0.85rem;
          padding: 0.25rem;
          border-radius: 50%;
        }
        
        .clear-attachment:hover {
          background-color: var(--bg-hover);
        }
        
        .input-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background-color: var(--white);
          border-radius: 24px;
          padding: 0.25rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .input-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: none;
          background: none;
          color: var(--text-light);
          font-size: 1.1rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .input-button:hover {
          background-color: var(--bg-hover);
          color: var(--text-medium);
        }
        
        .send-button.active {
          background-color: var(--primary);
          color: white;
        }
        
        .send-button.active:hover {
          background-color: var(--primary-dark);
          color: white;
        }
        
        .send-button.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .text-input-wrapper {
          flex: 1;
          min-width: 0;
        }
        
        .message-text-input {
          width: 100%;
          border: none;
          background: none;
          font-size: 0.95rem;
          padding: 0.75rem 0;
          outline: none;
          resize: none;
          max-height: 100px;
          overflow-y: auto;
        }
        
        .emoji-picker {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 0.5rem;
          padding: 0.75rem;
          background-color: var(--white);
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          position: absolute;
          bottom: calc(100% + 0.5rem);
          right: 1rem;
          z-index: 10;
        }
        
        .emoji-item {
          font-size: 1.5rem;
          background: none;
          border: none;
          border-radius: 8px;
          padding: 0.25rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .emoji-item:hover {
          background-color: var(--bg-hover);
        }
        
        .spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        /* Dark mode */
        .dark .input-row {
          background-color: var(--medium);
        }
        
        .dark .emoji-picker {
          background-color: var(--dark);
        }
        
        .dark .emoji-item:hover {
          background-color: var(--medium);
        }
        
        .dark .message-text-input {
          color: var(--text-light);
        }
        
        .dark .attachment-preview {
          background-color: var(--dark);
        }
      `}</style>
    </div>
  );
};

export default MessageInput;