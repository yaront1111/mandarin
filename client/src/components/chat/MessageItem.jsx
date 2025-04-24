// src/components/chat/MessageItem.jsx
import React from 'react';
import PropTypes from 'prop-types';
import {
    FaCheckDouble, FaCheck, FaSpinner, FaVideo, FaExclamationCircle
} from 'react-icons/fa';
import { formatMessageTime, getFileIcon, classNames } from './chatUtils.jsx';
import styles from '../../styles/embedded-chat.module.css';

const MessageItem = React.memo(({
    message,
    currentUserId,
    isSending = false
}) => {
    // Basic validation
    if (!message || (!message._id && !message.tempId)) {
        console.warn("Invalid message object passed to MessageItem:", message);
        return null;
    }

    const isSentByMe = message.sender === currentUserId;
    const isSystem = message.type === 'system';
    const isPlaceholder = message.metadata?.__localPlaceholder === true;
    const isFailed = message.error === true;

    // Determine Status Indicator
    let statusIndicator = null;
    if (isSentByMe && !isSystem && !isFailed) {
        if (message.pending || (message.tempId && isSending)) {
            statusIndicator = <FaSpinner className="fa-spin" size={14} title="Sending..." style={{color: '#65abff'}} />;
        } else if (message.read) {
            statusIndicator = <FaCheckDouble size={14} title="Read" style={{color: '#4caf50'}} />;
        } else {
            // Always show a check mark for messages sent by the current user
            statusIndicator = <FaCheck size={14} title="Sent" style={{color: '#65abff'}} />;
        }
    } else if (isFailed) {
        statusIndicator = <FaExclamationCircle size={14} title="Failed to send" style={{color: '#f44336'}} />;
    }

    // Render text message content
    const renderTextContent = () => (
        <>
            {isFailed ? (
                <div className={styles.errorMessageContent}>
                    <span className={styles.errorIcon} aria-hidden="true">!</span>
                    <span>{message.content || "Failed to send"}</span>
                </div>
            ) : (
                <div className={styles.messageContent}>{message.content || ""}</div>
            )}
        </>
    );

    // Render wink message content
    const renderWinkContent = () => (
        <div className={styles.winkContent}>
            <p className={styles.messageContent}>😉</p>
            <span className={styles.messageLabel}>Wink</span>
        </div>
    );

    // Render file message content
    const renderFileContent = () => {
        const { metadata } = message;
        if (!metadata) return <p className={styles.messageContent}>Attachment unavailable</p>;

        // Get the best URL from available sources
        const fileUrl = metadata.fileUrl || metadata.url || metadata.serverUrl;
        const localPreviewUrl = isPlaceholder && metadata.url?.startsWith('blob:') ? metadata.url : null;
        
        // Try to use cached URL if available
        let cachedUrl = null;
        if (typeof window !== 'undefined' && window.__fileMessages && message._id && window.__fileMessages[message._id]) {
            cachedUrl = window.__fileMessages[message._id].url;
        }
        
        // Determine which URL to display in order of priority
        const displayUrl = localPreviewUrl || cachedUrl || fileUrl;
        const isImage = metadata.fileType?.startsWith("image/");
        
        return (
            <div className={styles.fileMessage}>
                {isImage ? (
                    <div className={styles.imageContainer}>
                        {displayUrl ? (
                            <a 
                                href={fileUrl || "#"} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className={styles.imageLink} 
                                onClick={(e) => e.stopPropagation()} 
                                title={`View ${metadata.fileName || "image"}`}
                            >
                                <img 
                                    src={displayUrl} 
                                    alt={metadata.fileName || "Image attachment"} 
                                    className={classNames(styles.imageAttachment, isPlaceholder && styles.loading)} 
                                    loading="lazy" 
                                    style={{ display: 'block', visibility: 'visible' }}
                                    onError={(e) => { 
                                        console.error(`Failed to load image: ${displayUrl}`);
                                        e.target.onerror = null; 
                                        e.target.src = "/placeholder-error.svg"; 
                                        e.target.classList.remove(styles.loading);
                                        
                                        // Try to recover the URL from persistent storage if available
                                        if (typeof window !== 'undefined' && 
                                            window.__fileMessages && 
                                            message._id && 
                                            window.__fileMessages[message._id]) {
                                            const cachedUrl = window.__fileMessages[message._id].url;
                                            console.log(`Attempting to recover image URL for ${message._id} from cache: ${cachedUrl}`);
                                            if (cachedUrl && cachedUrl !== displayUrl) {
                                                // Set a small timeout to avoid infinite loop
                                                setTimeout(() => {
                                                    // Update the image source
                                                    e.target.src = cachedUrl;
                                                    
                                                    // Update the metadata URLs in the message object
                                                    // This is important to ensure it's saved when we switch conversations
                                                    if (message.metadata) {
                                                        message.metadata.url = cachedUrl;
                                                        message.metadata.fileUrl = cachedUrl;
                                                        message.metadata.serverUrl = cachedUrl;
                                                    }
                                                }, 100);
                                            }
                                        }
                                    }} 
                                    onLoad={(e) => {
                                        e.target.classList.remove(styles.loading);
                                        
                                        // Store the URL for future reference
                                        if (typeof window !== 'undefined' && message._id && displayUrl && !displayUrl.startsWith('blob:')) {
                                            if (!window.__fileMessages) window.__fileMessages = {};
                                            window.__fileMessages[message._id] = {
                                                url: displayUrl,
                                                timestamp: Date.now()
                                            };
                                            console.log(`Cached image URL for ${message._id}: ${displayUrl}`);
                                            
                                            // Persist to localStorage immediately
                                            try {
                                                localStorage.setItem('mandarin_file_urls', JSON.stringify(window.__fileMessages));
                                                console.log(`Persisted file URLs to localStorage (${Object.keys(window.__fileMessages).length} entries)`);
                                            } catch (e) {
                                                console.warn("Failed to persist file URLs to localStorage", e);
                                            }
                                            
                                            // Also update the metadata URLs in the message object
                                            if (message.metadata) {
                                                message.metadata.url = displayUrl;
                                                message.metadata.fileUrl = displayUrl;
                                                message.metadata.serverUrl = displayUrl;
                                            }
                                        }
                                    }} 
                                />
                            </a>
                        ) : (
                            <div className={styles.imagePlaceholder}>
                                {isPlaceholder ? 'Uploading...' : 'Image unavailable'}
                            </div>
                        )}
                        <div className={styles.imgCaption}>
                            {fileUrl ? (
                                <a 
                                    href={fileUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    onClick={(e) => e.stopPropagation()} 
                                    title={`View ${metadata.fileName || "image"}`}
                                >
                                    {metadata.fileName || "Image"}
                                </a>
                            ) : (
                                <span>{metadata.fileName || "Image"}</span>
                            )}
                            {metadata.fileSize && ` (${Math.round(metadata.fileSize / 1024)} KB)`}
                            {isPlaceholder && !isFailed && 
                                <span className={styles.uploadingIndicatorSmall}> (Uploading...)</span>
                            }
                            {isFailed && 
                                <span className={styles.errorIndicatorSmall}> (Upload Failed)</span>
                            }
                        </div>
                    </div>
                ) : (
                    <div className={styles.fileAttachment}>
                        <span aria-hidden="true">{getFileIcon(metadata)}</span>
                        <div className={styles.fileInfo}>
                            <span className={styles.fileName}>{metadata.fileName || "File"}</span>
                            {metadata.fileSize && 
                                <span className={styles.fileSize}>{`(${Math.round(metadata.fileSize / 1024)} KB)`}</span>
                            }
                            {!isPlaceholder && fileUrl && !isFailed && (
                                <a 
                                    href={fileUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className={styles.downloadLink} 
                                    onClick={(e) => e.stopPropagation()} 
                                    download={metadata.fileName || true}
                                >
                                    Download
                                </a>
                            )}
                            {isPlaceholder && !isFailed && 
                                <span className={styles.uploadingIndicator}>Uploading...</span>
                            }
                            {isFailed && 
                                <span className={styles.errorIndicator}>Upload Failed</span>
                            }
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Render system message content
    const renderSystemContent = () => (
        <div className={classNames(
            styles.systemMessageContent, 
            message.error && styles.errorContent
        )}>
            <p>{message.content}</p>
        </div>
    );

    // Render video call message content
    const renderVideoContent = () => (
        <div className={styles.videoCallMessage}>
            <FaVideo className={styles.videoIcon} aria-hidden="true" />
            <p className={styles.messageContent}>
                {message.content || "Video Call Event"}
            </p>
        </div>
    );

    // Select the appropriate renderer based on message type
    const renderContent = () => {
        switch (message.type) {
            case "text":
                return renderTextContent();
            case "wink":
                return renderWinkContent();
            case "file":
                return renderFileContent();
            case "system":
                return renderSystemContent();
            case "video":
                return renderVideoContent();
            default:
                console.warn(`Unsupported message type: ${message.type}`, message);
                return <p className={styles.messageContent}>Unsupported message</p>;
        }
    };

    // Add a React hook to ensure image URLs are always available
    React.useEffect(() => {
        // For file messages, make sure we prefetch the URL from the cache if available
        if (message.type === 'file' && message._id && typeof window !== 'undefined' && window.__fileMessages && window.__fileMessages[message._id]) {
            const cachedUrl = window.__fileMessages[message._id].url;
            
            // Update the message metadata with the cached URL
            if (message.metadata && cachedUrl && (!message.metadata.url || !message.metadata.fileUrl)) {
                console.log(`Restoring cached URL for message ${message._id} from global cache`);
                message.metadata.url = cachedUrl;
                message.metadata.fileUrl = cachedUrl;
                message.metadata.serverUrl = cachedUrl;
            }
        }
    }, [message]);

    return (
        <div className={styles.messageWrapper}>
            <div
                className={classNames(
                    styles.message, 
                    isSentByMe ? styles.sent : styles.received,
                    isSystem ? styles.systemMessage : "", 
                    isFailed ? styles.error : "",
                    message.type === "wink" ? styles.winkMessage : "", 
                    isPlaceholder ? styles.placeholderMessage : "",
                    message.pending ? styles.pending : ""
                )}
                role={isSystem ? "status" : "listitem"}
                aria-label={
                    isSystem ? 
                    "System message" : 
                    `${isSentByMe ? "Sent" : "Received"} ${message.type} message`
                }
            >
                {renderContent()}
            </div>
            
            {!isSystem && (
                <div className={classNames(
                    styles.messageMeta,
                    isSentByMe ? styles.metaSent : styles.metaReceived
                )}>
                    <span 
                        className={styles.messageTime} 
                        title={new Date(message.createdAt).toLocaleString()}
                    >
                        {formatMessageTime(message.createdAt)}
                    </span>
                    {isSentByMe && (
                        <span className={styles.statusIndicator} aria-hidden="true">
                            {statusIndicator}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
});

MessageItem.displayName = 'MessageItem';

MessageItem.propTypes = {
    message: PropTypes.shape({
        _id: PropTypes.string,
        tempId: PropTypes.string,
        sender: PropTypes.string.isRequired,
        recipient: PropTypes.string,
        content: PropTypes.string,
        createdAt: PropTypes.string.isRequired,
        type: PropTypes.string.isRequired,
        read: PropTypes.bool,
        pending: PropTypes.bool,
        error: PropTypes.bool,
        metadata: PropTypes.shape({
            fileName: PropTypes.string,
            fileType: PropTypes.string,
            fileSize: PropTypes.number,
            fileUrl: PropTypes.string,
            url: PropTypes.string,
            __localPlaceholder: PropTypes.bool,
        }),
        senderName: PropTypes.string,
        senderPhoto: PropTypes.string,
    }).isRequired,
    currentUserId: PropTypes.string.isRequired,
    isSending: PropTypes.bool,
};

export default MessageItem;