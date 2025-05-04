// src/components/chat/ChatInput.jsx
import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
    FaSmile, FaPaperPlane, FaPaperclip, FaTimes, FaHeart, FaSpinner
} from 'react-icons/fa';
import { COMMON_EMOJIS, ACCOUNT_TIER } from './chatConstants.js';
import { classNames } from './chatUtils.jsx';
import defaultStyles from '../../styles/Messages.module.css';

const ChatInput = React.memo(({
    messageValue,
    onInputChange,
    onSubmit,
    onWinkSend = () => {},
    onFileAttachClick,
    onEmojiClick,
    userTier = ACCOUNT_TIER.FREE,
    isSending = false,
    isUploading = false,
    attachmentSelected = false,
    disabled = false,
    isUserBlocked = false,
    inputRef,
    placeholderText = "Type a message...",
    customStyles = null,
}) => {
    // Use custom styles if provided, otherwise use default styles
    const styles = customStyles || defaultStyles;
    const [showEmojis, setShowEmojis] = useState(false);
    const emojiPickerRef = useRef(null);

    // Simple input change handler
    const handleTextAreaChange = (e) => {
        onInputChange(e);
    };

    // Handle Enter key to submit (except when Shift is pressed for new line)
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isSending && !isUploading && !disabled && (messageValue.trim() || attachmentSelected)) {
                 onSubmit();
                 if (e.target) e.target.style.height = "auto";
            }
        }
    };

    // Select emoji and close picker
    const handleLocalEmojiClick = (emoji) => {
        onEmojiClick(emoji);
        setShowEmojis(false);
    };

    // Close emoji picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (emojiPickerRef.current && 
                !emojiPickerRef.current.contains(event.target) && 
                !event.target.closest(`.${styles.emojiButton}`)) {
                setShowEmojis(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    // No longer needed for simple textarea

    // Derived state calculations
    const isFreeUserNoAttachment = userTier === ACCOUNT_TIER.FREE && !attachmentSelected;
    const canSubmit = (messageValue.trim().length > 0 || attachmentSelected) && 
                     !isSending && !isUploading && !disabled;
    
    const effectivePlaceholder = isFreeUserNoAttachment
        ? "Send a wink instead (Free Account)"
        : placeholderText;
        
    const inputDisabled = disabled || isSending || isUploading || isFreeUserNoAttachment;
    const attachDisabled = disabled || isSending || isUploading || userTier === ACCOUNT_TIER.FREE;
    const winkDisabled = disabled || isSending || isUploading;
    const emojiDisabled = disabled || isSending || isUploading;

    return (
        <div className={styles.inputWrapper}>
            {/* Emoji Picker Popup */}
            {showEmojis && (
                <div 
                    className={styles.emojiPicker} 
                    ref={emojiPickerRef}
                    role="dialog" 
                    aria-label="Emoji picker"
                >
                    <div className={styles.emojiHeader}>
                        <h4>Select Emoji</h4>
                        <button 
                            onClick={() => setShowEmojis(false)} 
                            aria-label="Close emoji picker"
                            type="button"
                        >
                            <FaTimes />
                        </button>
                    </div>
                    <div className={styles.emojiList}>
                        {COMMON_EMOJIS.map((emoji) => (
                            <button 
                                key={emoji} 
                                type="button" 
                                onClick={() => handleLocalEmojiClick(emoji)} 
                                title={emoji} 
                                aria-label={`Emoji ${emoji}`}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Main Input Area */}
            <div className={styles.inputArea}>
                {/* Emoji Button */}
                <button 
                    type="button" 
                    className={styles.emojiButton}
                    onClick={() => setShowEmojis(!showEmojis)} 
                    disabled={emojiDisabled} 
                    title="Add Emoji" 
                    aria-label="Add Emoji" 
                    aria-expanded={showEmojis}
                >
                    <FaSmile />
                </button>
                
                {/* Text Input */}
                <textarea 
                    ref={inputRef} 
                    className={classNames(
                        styles.messageInput,
                        isUserBlocked && styles.blockedInput
                    )}
                    placeholder={isUserBlocked ? "Cannot send messages to blocked users" : effectivePlaceholder}
                    value={messageValue} 
                    onChange={handleTextAreaChange} 
                    onKeyPress={handleKeyPress} 
                    rows={1} 
                    disabled={inputDisabled || isUserBlocked} 
                    title={isUserBlocked ? 
                        "This user is blocked" : 
                        (isFreeUserNoAttachment ? 
                            "Upgrade to send text messages" : 
                            "Type a message (Shift+Enter for newline)")}
                    aria-label="Message Input" 
                />
                
                {/* Attachment Button */}
                <button 
                    type="button" 
                    className={styles.attachButton}
                    onClick={onFileAttachClick} 
                    disabled={attachDisabled} 
                    title={userTier === ACCOUNT_TIER.FREE ? 
                        "Upgrade to send files" : 
                        "Attach File"} 
                    aria-label="Attach File"
                >
                    <FaPaperclip />
                </button>
                
                {/* Wink Button */}
                <button 
                    type="button" 
                    className={styles.winkButton}
                    onClick={onWinkSend} 
                    disabled={winkDisabled} 
                    title="Send Wink" 
                    aria-label="Send Wink"
                >
                    <FaHeart />
                </button>
                
                {/* Send Button */}
                <button 
                    type="button" 
                    onClick={onSubmit} 
                    className={classNames(
                        styles.sendButton,
                        !canSubmit && styles.disabled, 
                        (isSending || isUploading) && styles.sending
                    )} 
                    disabled={!canSubmit} 
                    title={attachmentSelected ? "Send File" : "Send Message"} 
                    aria-label={attachmentSelected ? "Send File" : "Send Message"}
                >
                    {isSending || isUploading ? 
                        <FaSpinner className="fa-spin" /> : 
                        <FaPaperPlane />
                    }
                </button>
            </div>
        </div>
    );
});

ChatInput.displayName = 'ChatInput';

ChatInput.propTypes = {
    messageValue: PropTypes.string.isRequired,
    onInputChange: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    onWinkSend: PropTypes.func,
    onFileAttachClick: PropTypes.func.isRequired,
    onEmojiClick: PropTypes.func.isRequired,
    userTier: PropTypes.string,
    isSending: PropTypes.bool,
    isUploading: PropTypes.bool,
    attachmentSelected: PropTypes.bool,
    disabled: PropTypes.bool,
    isUserBlocked: PropTypes.bool,
    inputRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) })
    ]),
    placeholderText: PropTypes.string,
    customStyles: PropTypes.object,
};

export default ChatInput;
