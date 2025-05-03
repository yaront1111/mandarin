// src/components/chat/AttachmentPreview.jsx
import React, { useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { FaTimes, FaPaperclip } from 'react-icons/fa';
import { getFileIcon, classNames } from './chatUtils.jsx';
import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from './chatConstants.js';
import styles from '../../styles/embedded-chat.module.css';
import { logger } from '../../utils/logger.js';

// Create a named logger for this component
const log = logger.create('AttachmentPreview');

/**
 * AttachmentPreview component for showing file attachments and upload progress
 * Also handles file selection via a hidden input that can be triggered from parent
 */
const AttachmentPreview = React.memo(({
    // Attachment data
    attachment,
    isUploading,
    uploadProgress,
    
    // Callback functions
    onRemoveAttachment,
    onFileSelected,
    onAttachmentClick,
    
    // Optional props
    error = null,
    disabled = false,
    userTier = null,
    showFileInput = true,
    fileInputAccept = ALLOWED_FILE_TYPES.join(',')
}) => {
    // Reference to hidden file input
    const fileInputRef = useRef(null);
    
    // Format file size for display
    const fileSizeDisplay = attachment?.size 
        ? attachment.size < 1024 * 1024
            ? `(${Math.round(attachment.size / 1024)} KB)`
            : `(${(attachment.size / (1024 * 1024)).toFixed(1)} MB)`
        : "";
        
    // File selection handler
    const handleFileChange = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            const errorMessage = `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`;
            log.warn(errorMessage, file);
            if (onFileSelected) {
                onFileSelected(null, errorMessage);
            }
            e.target.value = null; // Reset input
            return;
        }
        
        // Validate file type
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            const errorMessage = `File type (${file.type || 'unknown'}) not supported.`;
            log.warn(errorMessage, file);
            if (onFileSelected) {
                onFileSelected(null, errorMessage);
            }
            e.target.value = null; // Reset input
            return;
        }
        
        // File is valid, pass it to parent
        if (onFileSelected) {
            onFileSelected(file);
        }
        
        // Reset input for next selection
        e.target.value = null;
    }, [onFileSelected]);
    
    // Click handler to trigger file selection
    const handleAttachmentClick = useCallback(() => {
        if (disabled) return;
        
        if (onAttachmentClick) {
            onAttachmentClick();
        } else if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    }, [disabled, onAttachmentClick]);
    
    // If we're showing attachment preview
    if (attachment) {
        return (
            <div className={classNames(styles.attachmentPreview, error && styles.error)}>
                <div className={styles.attachmentInfo}>
                    <span className={styles.fileIconPreview}>{getFileIcon(attachment)}</span>
                    <span 
                        className={styles.attachmentName} 
                        title={attachment.name}
                    >
                        {attachment.name}
                    </span>
                    <span className={styles.attachmentSize}>{fileSizeDisplay}</span>
                    {error && <span className={styles.errorMessagePreview}>{error}</span>}
                </div>

                {isUploading ? (
                    <div className={styles.uploadProgressContainer}>
                        <div 
                            className={styles.uploadProgressBar} 
                            style={{ width: `${uploadProgress}%` }}
                            role="progressbar"
                            aria-valuenow={uploadProgress}
                            aria-valuemin="0"
                            aria-valuemax="100"
                        ></div>
                        <span className={styles.uploadProgressText}>{uploadProgress}%</span>
                    </div>
                ) : (
                    <button 
                        type="button" 
                        className={styles.removeAttachment} 
                        onClick={onRemoveAttachment} 
                        disabled={isUploading || disabled} 
                        title="Remove attachment" 
                        aria-label="Remove attachment"
                    >
                        <FaTimes />
                    </button>
                )}
            </div>
        );
    }
    
    // If there's no attachment but we should show the file input
    if (showFileInput) {
        return (
            <>
                {/* Hidden file input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                    accept={fileInputAccept}
                    disabled={disabled}
                    aria-hidden="true"
                />
                
                {/* Only show trigger button if requested */}
                {onAttachmentClick && (
                    <button
                        type="button"
                        className={styles.attachButton}
                        onClick={handleAttachmentClick}
                        disabled={disabled || (userTier === 'FREE')}
                        title={userTier === 'FREE' ? "Upgrade to send files" : "Attach File"}
                        aria-label="Attach File"
                    >
                        <FaPaperclip />
                    </button>
                )}
            </>
        );
    }
    
    // Nothing to show
    return null;
});

AttachmentPreview.displayName = 'AttachmentPreview';

AttachmentPreview.propTypes = {
    // Attachment data
    attachment: PropTypes.object,
    isUploading: PropTypes.bool,
    uploadProgress: PropTypes.number,
    
    // Callbacks
    onRemoveAttachment: PropTypes.func,
    onFileSelected: PropTypes.func,
    onAttachmentClick: PropTypes.func,
    
    // Optional props
    error: PropTypes.string,
    disabled: PropTypes.bool,
    userTier: PropTypes.string,
    showFileInput: PropTypes.bool,
    fileInputAccept: PropTypes.string
};

// Set default props to avoid errors if some are not provided
AttachmentPreview.defaultProps = {
    isUploading: false,
    uploadProgress: 0,
    onRemoveAttachment: () => {},
    showFileInput: true,
    disabled: false
};

export default AttachmentPreview;
