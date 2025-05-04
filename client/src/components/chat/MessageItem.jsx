// src/components/chat/MessageItem.jsx
import React from 'react';
import PropTypes from 'prop-types';
import {
    FaCheckDouble, FaCheck, FaSpinner, FaVideo, FaExclamationCircle
} from 'react-icons/fa';
import { formatMessageTime, getFileIcon, classNames } from './chatUtils.jsx';
import styles from '../../styles/Messages.module.css';
import { logger } from '../../utils/logger.js';

// Create a named logger for this component
const log = logger.create('MessageItem');

const MessageItem = React.memo(({
    message,
    currentUserId,
    isSending = false
}) => {
    // Basic validation
    if (!message || (!message._id && !message.tempId)) {
        log.warn("Invalid message object passed to MessageItem:", message);
        return null;
    }

    // Generate a consistent hash for message to use as an alternative lookup key
    const getMessageHash = (msg) => {
        if (!msg) return '';
        const contentKey = (msg.content || '').substring(0, 30);
        const fileName = msg.metadata?.fileName || '';
        const timeStr = msg.createdAt?.substring(0, 16) || ''; // Less strict time matching
        return `${msg.sender}-${timeStr}-${fileName}-${contentKey}-${msg.type}`;
    };
    
    // Memoize the message hash to avoid recalculating
    const messageHash = React.useMemo(() => 
        message.type === 'file' ? getMessageHash(message) : null,
    [message]);

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
        if (typeof window !== 'undefined' && window.__fileMessages) {
            // Try ID-based lookup first
            if (message._id && window.__fileMessages[message._id]) {
                cachedUrl = window.__fileMessages[message._id].url;
            }
            // Try hash-based lookup if available
            else if (messageHash && window.__fileMessagesByHash && window.__fileMessagesByHash[messageHash]) {
                cachedUrl = window.__fileMessagesByHash[messageHash].url;
            }
        }
        
        // Determine which URL to display in order of priority
        const displayUrl = localPreviewUrl || cachedUrl || fileUrl;
        const isImage = metadata.fileType?.startsWith("image/");
        
        // Store the URL for future reference if it's valid and we have an ID
        const storeFileUrl = (url) => {
            if (typeof window !== 'undefined' && url && !url.startsWith('blob:')) {
                // Initialize storage if needed
                if (!window.__fileMessages) window.__fileMessages = {};
                if (!window.__fileMessagesByHash) window.__fileMessagesByHash = {};
                
                const urlData = {
                    url: url,
                    timestamp: Date.now(),
                    fileName: metadata.fileName
                };
                
                // Store by ID if available
                if (message._id) {
                    window.__fileMessages[message._id] = {
                        ...urlData,
                        hash: messageHash
                    };
                }
                
                // Also store by hash for additional lookup capability
                if (messageHash) {
                    window.__fileMessagesByHash[messageHash] = {
                        ...urlData,
                        id: message._id
                    };
                }
                
                // Throttle localStorage updates
                if (!window.__fileUrlPersistTimeout) {
                    window.__fileUrlPersistTimeout = setTimeout(() => {
                        try {
                            localStorage.setItem('mandarin_file_urls', JSON.stringify(window.__fileMessages));
                            localStorage.setItem('mandarin_file_urls_by_hash', JSON.stringify(window.__fileMessagesByHash));
                            log.debug(`Persisted ${Object.keys(window.__fileMessages).length} file URLs to localStorage`);
                        } catch (e) {
                            log.warn("Failed to persist file URLs to localStorage", e);
                        }
                        window.__fileUrlPersistTimeout = null;
                    }, 1000);
                }
                
                return true;
            }
            return false;
        };
        
        // Update metadata with URL
        const updateMetadataUrl = (url) => {
            if (metadata && url) {
                metadata.url = url;
                metadata.fileUrl = url;
                metadata.serverUrl = url;
                return true;
            }
            return false;
        };
        
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
                                    className={classNames(
                                        styles.imageAttachment, 
                                        isPlaceholder && styles.loading
                                    )} 
                                    loading="lazy" 
                                    style={{ display: 'block', visibility: 'visible', minHeight: '100px' }}
                                    onError={(e) => { 
                                        log.error(`Failed to load image: ${displayUrl}`);
                                        e.target.onerror = null; 
                                        e.target.src = "/placeholder-error.svg"; 
                                        e.target.classList.remove(styles.loading);
                                        
                                        // Try to recover using multiple strategies
                                        if (typeof window !== 'undefined') {
                                            let recoverySuccessful = false;
                                            
                                            // Strategy 1: Check cached URLs by ID
                                            if (message._id && window.__fileMessages && window.__fileMessages[message._id]) {
                                                const cachedUrl = window.__fileMessages[message._id].url;
                                                if (cachedUrl && cachedUrl !== displayUrl) {
                                                    log.debug(`Attempting to recover image URL by ID: ${cachedUrl}`);
                                                    setTimeout(() => {
                                                        e.target.src = cachedUrl;
                                                        updateMetadataUrl(cachedUrl);
                                                    }, 100);
                                                    recoverySuccessful = true;
                                                }
                                            }
                                            
                                            // Strategy 2: Try hash-based lookup
                                            if (!recoverySuccessful && messageHash && window.__fileMessagesByHash && window.__fileMessagesByHash[messageHash]) {
                                                const cachedUrl = window.__fileMessagesByHash[messageHash].url;
                                                if (cachedUrl && cachedUrl !== displayUrl) {
                                                    log.debug(`Attempting to recover image URL by hash: ${cachedUrl}`);
                                                    setTimeout(() => {
                                                        e.target.src = cachedUrl;
                                                        updateMetadataUrl(cachedUrl);
                                                        if (message._id) {
                                                            window.__fileMessages[message._id] = {
                                                                url: cachedUrl,
                                                                timestamp: Date.now(),
                                                                hash: messageHash
                                                            };
                                                        }
                                                    }, 150);
                                                    recoverySuccessful = true;
                                                }
                                            }
                                            
                                            // Strategy 3: Use URL variations
                                            if (!recoverySuccessful) {
                                                // Try changing http to https or vice versa
                                                if (displayUrl && displayUrl.startsWith('http')) {
                                                    const altProtocolUrl = displayUrl.startsWith('https') 
                                                        ? displayUrl.replace('https', 'http')
                                                        : displayUrl.replace('http', 'https');
                                                    
                                                    log.debug(`Attempting protocol switch recovery: ${altProtocolUrl}`);
                                                    setTimeout(() => { 
                                                        e.target.src = altProtocolUrl;
                                                        if (e.target.complete && e.target.naturalWidth > 0) {
                                                            updateMetadataUrl(altProtocolUrl);
                                                            storeFileUrl(altProtocolUrl);
                                                        }
                                                    }, 200);
                                                }
                                            }
                                        }
                                    }} 
                                    onLoad={(e) => {
                                        e.target.classList.remove(styles.loading);
                                        
                                        // Successful load: store and update the URL
                                        const loadedUrl = e.target.src;
                                        if (loadedUrl && !loadedUrl.startsWith('blob:') && loadedUrl !== '/placeholder-error.svg') {
                                            updateMetadataUrl(loadedUrl);
                                            storeFileUrl(loadedUrl);
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
                log.warn(`Unsupported message type: ${message.type}`, message);
                return <p className={styles.messageContent}>Unsupported message</p>;
        }
    };

    // Add a React hook to ensure image URLs are always available
    React.useEffect(() => {
        // Only process file messages
        if (message.type !== 'file' || !message.metadata) return;
        
        // Try to recover the file URL
        const tryRecoverFileUrl = () => {
            // Preferred lookup order: ID-based, hash-based, filename-based
            let cachedUrl = null;
            
            if (typeof window !== 'undefined') {
                // Initialize the caches if needed
                if (!window.__fileMessages) {
                    window.__fileMessages = {};
                    // Try to load from localStorage
                    try {
                        const stored = localStorage.getItem('mandarin_file_urls');
                        if (stored) {
                            window.__fileMessages = JSON.parse(stored) || {};
                            log.debug(`Loaded ${Object.keys(window.__fileMessages).length} file URLs from localStorage`);
                        }
                    } catch (e) {
                        log.warn("Error loading file URLs from localStorage", e);
                    }
                }
                
                if (!window.__fileMessagesByHash) {
                    window.__fileMessagesByHash = {};
                    // Try to load from localStorage
                    try {
                        const stored = localStorage.getItem('mandarin_file_urls_by_hash');
                        if (stored) {
                            window.__fileMessagesByHash = JSON.parse(stored) || {};
                        }
                    } catch (e) {
                        log.warn("Error loading file URL hashes from localStorage", e);
                    }
                }
                
                // Strategy 1: ID-based lookup
                if (message._id && window.__fileMessages[message._id]) {
                    cachedUrl = window.__fileMessages[message._id].url;
                    log.debug(`Found cached URL for ${message._id} via ID lookup`);
                }
                // Strategy 2: Hash-based lookup
                else if (messageHash && window.__fileMessagesByHash[messageHash]) {
                    cachedUrl = window.__fileMessagesByHash[messageHash].url;
                    log.debug(`Found cached URL for message via hash lookup`);
                    
                    // Also store with ID for future direct lookups
                    if (message._id) {
                        window.__fileMessages[message._id] = {
                            url: cachedUrl,
                            timestamp: Date.now(),
                            hash: messageHash
                        };
                    }
                }
                // Strategy 3: Filename-based lookup
                else if (message.metadata.fileName) {
                    // Search by filename in both caches
                    const fileNameMatches = Object.values(window.__fileMessages)
                        .filter(entry => entry.fileName === message.metadata.fileName);
                        
                    if (fileNameMatches.length > 0) {
                        // Use the most recent match
                        const latestMatch = fileNameMatches.sort((a, b) => b.timestamp - a.timestamp)[0];
                        cachedUrl = latestMatch.url;
                        log.debug(`Found cached URL via filename match: ${message.metadata.fileName}`);
                    }
                }
            }
            
            // If URL found, update the message metadata
            if (cachedUrl && message.metadata) {
                log.debug(`Restoring file URL: ${cachedUrl.substring(0, 50)}...`);
                
                // Update all URL fields for maximum compatibility
                message.metadata.url = cachedUrl;
                message.metadata.fileUrl = cachedUrl;
                message.metadata.serverUrl = cachedUrl;
                
                // Update the caches with this message info
                if (typeof window !== 'undefined') {
                    // Store both message ID and hash references for redundancy
                    if (message._id) {
                        window.__fileMessages[message._id] = {
                            url: cachedUrl,
                            timestamp: Date.now(),
                            hash: messageHash,
                            fileName: message.metadata.fileName
                        };
                    }
                    
                    if (messageHash) {
                        window.__fileMessagesByHash[messageHash] = {
                            url: cachedUrl,
                            timestamp: Date.now(),
                            id: message._id,
                            fileName: message.metadata.fileName
                        };
                    }
                    
                    // Schedule localStorage persistence (debounced)
                    if (!window.__fileUrlPersistTimeout) {
                        window.__fileUrlPersistTimeout = setTimeout(() => {
                            try {
                                localStorage.setItem('mandarin_file_urls', JSON.stringify(window.__fileMessages));
                                localStorage.setItem('mandarin_file_urls_by_hash', JSON.stringify(window.__fileMessagesByHash));
                                log.debug(`Persisted file URLs to localStorage`);
                            } catch (e) {
                                log.warn("Failed to persist file URLs to localStorage", e);
                            }
                            window.__fileUrlPersistTimeout = null;
                        }, 1000);
                    }
                }
                
                return true;
            }
            
            return false;
        };
        
        // Try to recover the URL
        tryRecoverFileUrl();
        
        // If URL recovery fails initially and we have a valid message ID,
        // try again after a delay (helps with race conditions)
        if ((!message.metadata.url || !message.metadata.fileUrl) && message._id) {
            setTimeout(() => {
                if (!message.metadata.url && !message.metadata.fileUrl) {
                    log.debug(`Retrying URL recovery for message ${message._id}`);
                    tryRecoverFileUrl();
                }
            }, 500);
        }
    }, [message, messageHash]); // messageHash dependency is important for cache lookups

    return (
        <div className={styles.messageWrapper}>
            <div
                className={classNames(
                    styles.messageBubble, 
                    isSentByMe ? styles.sent : styles.received,
                    isSystem ? styles.systemMessage : "", 
                    isFailed ? styles.error : "",
                    message.type === "wink" ? styles.winkMessage : "", 
                    isPlaceholder ? styles.placeholderMessage : "",
                    message.pending ? styles.pending : ""
                )}
                data-system-type={message.systemType || ""}
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
