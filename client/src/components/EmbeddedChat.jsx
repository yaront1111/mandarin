// src/components/EmbeddedChat.jsx
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import PropTypes from 'prop-types';
import {
    FaSmile, FaPaperPlane, FaPaperclip, FaTimes, FaCheckDouble, FaCheck,
    FaVideo, FaHeart, FaSpinner, FaFile, FaImage, FaFileAlt, FaFilePdf,
    FaFileAudio, FaFileVideo, FaCrown, FaLock, FaPhoneSlash,
    FaExclamationCircle
} from "react-icons/fa";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

// Assuming these imports exist and are correctly configured
import { useAuth } from "../context/AuthContext"; // Adjusted path
import { useChat } from "../hooks/useChat";
import { logger } from "../utils/logger"; // Adjusted path
import socketService from "../services/socketService";
import VideoCall from "./VideoCall"; // Assuming VideoCall component exists

// Styles
import styles from "../styles/embedded-chat.module.css"; // Assuming CSS module exists
import "../styles/video-call.css"; // Assuming global styles for video call

// --- Constants ---
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = [
    "image/jpeg", "image/jpg", "image/png", "image/gif", "application/pdf",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain", "audio/mpeg", "audio/wav", "video/mp4", "video/quicktime",
];
const COMMON_EMOJIS = ["😊", "😂", "😍", "❤️", "👍", "🙌", "🔥", "✨", "🎉", "🤔", "😉", "🥰"];
const LOADING_TIMEOUT_MS = 10000; // 10 seconds
const RECONNECT_DELAY_MS = 1500;
const INPUT_FOCUS_DELAY_MS = 300;
const TYPING_DEBOUNCE_MS = 300;
const SMOOTH_SCROLL_DEBOUNCE_MS = 100;

// --- Logger ---
const log = logger.create("EmbeddedChat");

// --- Helper Functions ---

// Counter for guaranteeing uniqueness within the same timestamp for local messages
let localIdCounter = 0;
const generateLocalUniqueId = (prefix = 'local') => {
    localIdCounter++;
    return `${prefix}-${Date.now()}-${localIdCounter}-${Math.random().toString(36).substring(2, 9)}`;
};

// Create an axios instance with auth headers (outside component for stability)
const createAuthAxios = () => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    return axios.create({
        // baseURL: process.env.REACT_APP_API_URL || "", // Use environment variable for base URL
        headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
    });
};

const formatMessageTime = (timestamp) => {
    if (!timestamp) return "";
    try {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return "";
    }
};

const formatMessageDate = (timestamp) => {
    if (!timestamp) return "Unknown date";
    try {
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return "Today";
        if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
        return date.toLocaleDateString();
    } catch {
        return "Unknown date";
    }
};

const getFileIcon = (file) => {
    if (!file) return <FaFile />;
    const fileType = file.type || file.fileType || ""; // Handle both File object and metadata
    if (fileType.startsWith("image/")) return <FaImage />;
    if (fileType.startsWith("video/")) return <FaFileVideo />;
    if (fileType.startsWith("audio/")) return <FaFileAudio />;
    if (fileType === "application/pdf") return <FaFilePdf />;
    return <FaFileAlt />;
};

// --- Internal Components ---

// ChatHeader Component (Displays recipient info and action buttons)
const ChatHeader = React.memo(({
    recipient,
    userTier,
    pendingPhotoRequests,
    isApprovingRequests,
    handleApproveAllRequests,
    isCallActive,
    handleEndCall,
    handleVideoCall,
    isActionDisabled,
    onClose,
    isConnected
}) => (
    <div className={styles.chatHeader}>
        {/* Recipient Avatar and Info */}
        <div className={styles.chatUser}>
            {recipient?.photos?.length ? (
                <img
                    src={recipient.photos[0].url || "/placeholder.svg"}
                    alt={recipient.nickname}
                    className={styles.chatAvatar}
                    onError={(e) => { e.target.onerror = null; e.target.src = "/placeholder.svg"; }}
                />
            ) : (
                <div className={styles.chatAvatarPlaceholder} />
            )}
            <div className={styles.chatUserInfo}>
                <h3>{recipient.nickname}</h3>
                <div className={styles.statusContainer}>
                    {/* Online/Offline Status */}
                    <span className={recipient.isOnline ? styles.statusOnline : styles.statusOffline}>
                        {recipient.isOnline ? "Online" : "Offline"}
                    </span>
                    {/* Disconnected Indicator */}
                    {!isConnected && (
                        <span className={styles.connectionStatus} title="Connection lost">
                            <FaExclamationCircle className={styles.statusIcon} />
                            <span>Disconnected</span>
                        </span>
                    )}
                </div>
            </div>
        </div>
        {/* Header Action Buttons */}
        <div className={styles.chatHeaderActions}>
            {/* Approve Photo Requests Button */}
            {pendingPhotoRequests > 0 && (
                <button
                    className={styles.chatHeaderBtn}
                    onClick={handleApproveAllRequests}
                    title="Approve photo requests"
                    aria-label="Approve photo requests"
                    disabled={isApprovingRequests}
                >
                    {isApprovingRequests ? <FaSpinner className="fa-spin" /> : <FaLock />}
                </button>
            )}
            {/* Video Call / End Call Button (Premium Only) */}
            {userTier !== "FREE" && (
                isCallActive ? (
                    <button
                        className={styles.chatHeaderBtn}
                        onClick={handleEndCall}
                        title="End call"
                        aria-label="End call"
                    >
                        <FaPhoneSlash />
                    </button>
                ) : (
                    <button
                        className={styles.chatHeaderBtn}
                        onClick={handleVideoCall}
                        title={recipient.isOnline ? "Start Video Call" : `${recipient.nickname} is offline`}
                        aria-label="Start video call"
                        disabled={isActionDisabled || !recipient.isOnline}
                    >
                        <FaVideo />
                    </button>
                )
            )}
            {/* Close Chat Button */}
            <button
                className={styles.chatHeaderBtn}
                onClick={onClose}
                aria-label="Close chat"
                title="Close chat"
            >
                <FaTimes />
            </button>
        </div>
    </div>
));
ChatHeader.displayName = 'ChatHeader'; // For React DevTools


// MessageItem Component (Renders a single message)
const MessageItem = React.memo(({ message, currentUserId, isSent }) => {
    // Function to render the specific content based on message type
    const renderContent = () => {
        switch (message.type) {
            case "text":
                return (
                    <>
                        <p className={styles.messageContent}>{message.content}</p>
                        {/* Timestamp and Read Status */}
                        <span className={styles.messageTime}>
                            {formatMessageTime(message.createdAt)}
                            {isSent && (
                                message.pending ? <span className={styles.pendingIndicator} title="Sending...">●</span>
                                : message.error ? <span className={styles.errorIndicator} title="Failed to send">!</span>
                                : message.read ? <FaCheckDouble className={styles.readIndicator} title="Read" />
                                : <FaCheck className={styles.readIndicator} title="Sent" />
                            )}
                        </span>
                    </>
                );
            case "wink":
                return (
                    <div className={styles.winkMessage}>
                        <p className={styles.messageContent}>😉</p>
                        <span className={styles.messageLabel}>Wink</span>
                        <span className={styles.messageTime}>{formatMessageTime(message.createdAt)}</span>
                    </div>
                );
            case "file": {
                const { metadata } = message;
                if (!metadata || !metadata.fileUrl) {
                    return <p className={styles.messageContent}>Attachment unavailable</p>;
                }
                const isImage = metadata.fileType?.startsWith("image/");
                return (
                    <div className={styles.fileMessage}>
                        {/* Render image or file info */}
                        {isImage ? (
                            <img
                                src={metadata.fileUrl}
                                alt={metadata.fileName || "Image"}
                                className={styles.imageAttachment}
                                onError={(e) => { e.target.onerror = null; e.target.src = "/placeholder.svg"; }}
                            />
                        ) : (
                            <div className={styles.fileAttachment}>
                                {getFileIcon(metadata)}
                                <span className={styles.fileName}>{metadata.fileName || "File"}</span>
                                {metadata.fileSize && <span className={styles.fileSize}>{`(${Math.round(metadata.fileSize / 1024)} KB)`}</span>}
                                <a
                                    href={metadata.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.downloadLink}
                                    onClick={(e) => e.stopPropagation()} // Prevent chat click events
                                >
                                    Download
                                </a>
                            </div>
                        )}
                         <span className={styles.messageTime}>{formatMessageTime(message.createdAt)}</span>
                    </div>
                );
            }
            case "system":
                 return (
                    <div className={`${styles.systemMessageContent} ${message.error ? styles.errorContent : ''}`}>
                        <p>{message.content}</p>
                        <span className={styles.messageTime}>{formatMessageTime(message.createdAt)}</span>
                    </div>
                );
            case "video": // Used for call system messages
                return (
                    <div className={styles.videoCallMessage}>
                        <FaVideo className={styles.videoIcon} />
                        <p className={styles.messageContent}>{message.content || "Video Call Event"}</p>
                        <span className={styles.messageTime}>{formatMessageTime(message.createdAt)}</span>
                    </div>
                );
            default:
                log.warn(`Unsupported message type: ${message.type}`, message);
                return <p className={styles.messageContent}>Unsupported message</p>;
        }
    };

    // Main message bubble structure
    return (
        <div
            key={message._id || message.tempId} // Ensure key exists
            className={`${styles.message} ${isSent ? styles.sent : styles.received} ${
                message.type === "system" ? styles.systemMessage : ""
            } ${message.error ? styles.error : ""} ${message.pending ? styles.pending : ""}`}
        >
            {renderContent()}
        </div>
    );
});
MessageItem.displayName = 'MessageItem'; // For React DevTools

// MessageList Component (Groups and renders messages by date)
const MessageList = React.memo(({ messages, currentUserId, typingStatus, hasMore, loadMoreMessages }) => {
    // Memoize message grouping by date
    const groupedMessages = useMemo(() => {
        const groups = {};
        if (!Array.isArray(messages)) return groups;
        messages.forEach((message) => {
            if (message && message.createdAt) {
                const date = formatMessageDate(message.createdAt);
                groups[date] = groups[date] || [];
                groups[date].push(message);
            } else {
                log.warn("Invalid message object encountered during grouping:", message);
            }
        });
        return groups;
    }, [messages]);

    return (
        <>
            {/* Button to load older messages */}
            {hasMore && (
                <button onClick={loadMoreMessages} className={styles.loadMoreButton}>
                    Load More
                </button>
            )}
            {/* Render messages grouped by date */}
            {Object.entries(groupedMessages).map(([date, msgs]) => (
                <React.Fragment key={date}>
                    <div className={styles.messageDate}>{date}</div>
                    {msgs.map((message) => (
                        <MessageItem
                            key={message._id || message.tempId} // Ensure key stability
                            message={message}
                            currentUserId={currentUserId}
                            isSent={message.sender === currentUserId}
                        />
                    ))}
                </React.Fragment>
            ))}
            {/* Typing indicator */}
            {typingStatus && (
                <div className={styles.typingIndicator}>
                    <span></span><span></span><span></span>
                </div>
            )}
        </>
    );
});
MessageList.displayName = 'MessageList'; // For React DevTools

// ChatInput Component (Handles message input, emojis, attachments, sending)
const ChatInput = React.memo(({
    newMessage, handleInputChange, handleKeyPress, chatInputRef, showEmojis,
    setShowEmojis, handleEmojiClick, handleFileAttachment, handleSendWink,
    handleSubmit, isSending, isUploading, userTier, attachment
}) => (
    <form className={styles.messageInput} onSubmit={handleSubmit}>
        {/* Emoji Button and Picker */}
        <button
            type="button"
            className={styles.inputEmoji}
            onClick={() => setShowEmojis(!showEmojis)}
            title="Add Emoji"
            aria-label="Add emoji"
            disabled={isUploading || isSending}
        >
            <FaSmile />
        </button>
        {showEmojis && (
            <div className={styles.emojiPicker}>
                <div className={styles.emojiHeader}>
                    <h4>Emojis</h4>
                    <button onClick={() => setShowEmojis(false)} aria-label="Close emoji picker">
                        <FaTimes />
                    </button>
                </div>
                <div className={styles.emojiList}>
                    {COMMON_EMOJIS.map((emoji) => (
                        <button
                            key={emoji}
                            type="button"
                            onClick={() => handleEmojiClick(emoji)}
                            aria-label={`Emoji ${emoji}`}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* Text Input Field */}
        <input
            type="text"
            placeholder={userTier === "FREE" ? "Free users can only send winks 😉" : "Type a message..."}
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            ref={chatInputRef}
            disabled={isSending || isUploading || (userTier === "FREE" && newMessage !== '😉')} // Allow typing wink even if free
            aria-label="Message input"
            title={userTier === "FREE" ? "Upgrade to send text messages" : "Type a message"}
        />

        {/* Attachment Button */}
        <button
            type="button"
            className={styles.inputAttachment}
            onClick={handleFileAttachment}
            disabled={isSending || isUploading || userTier === "FREE"}
            title={userTier === "FREE" ? "Upgrade to send files" : "Attach File"}
            aria-label="Attach file"
        >
            <FaPaperclip />
        </button>

        {/* Wink Button */}
        <button
            type="button"
            className={styles.inputWink}
            onClick={handleSendWink}
            disabled={isSending || isUploading}
            title="Send Wink"
            aria-label="Send wink"
        >
            <FaHeart />
        </button>

        {/* Send Button */}
        <button
            type="submit"
            className={styles.inputSend}
            disabled={(!newMessage.trim() && !attachment) || isSending || isUploading}
            title="Send Message"
            aria-label="Send message"
        >
            {isSending || isUploading ? <FaSpinner className="fa-spin" /> : <FaPaperPlane />}
        </button>
    </form>
));
ChatInput.displayName = 'ChatInput'; // For React DevTools

// AttachmentPreview Component (Displays selected file before sending)
const AttachmentPreview = React.memo(({ attachment, isUploading, uploadProgress, handleRemoveAttachment }) => (
    <div className={styles.attachmentPreview}>
        <div className={styles.attachmentInfo}>
            {getFileIcon(attachment)}
            <span className={styles.attachmentName}>{attachment.name}</span>
            <span className={styles.attachmentSize}>({Math.round(attachment.size / 1024)} KB)</span>
        </div>
        {/* Show progress or remove button */}
        {isUploading ? (
            <div className={styles.uploadProgressContainer}>
                <div
                    className={styles.uploadProgressBar}
                    style={{ width: `${uploadProgress}%` }}
                />
                <span className={styles.uploadProgressText}>{uploadProgress}%</span>
            </div>
        ) : (
            <button
                type="button"
                className={styles.removeAttachment}
                onClick={handleRemoveAttachment}
                disabled={isUploading} // Should always be false here, but good practice
                aria-label="Remove attachment"
            >
                <FaTimes />
            </button>
        )}
    </div>
));
AttachmentPreview.displayName = 'AttachmentPreview'; // For React DevTools

// CallBanners Component (Displays incoming and active call banners)
const CallBanners = React.memo(({ incomingCall, isCallActive, recipientNickname, handleAcceptCall, handleDeclineCall, handleEndCall }) => (
    <>
        {/* Incoming Call Banner */}
        {incomingCall && !isCallActive && (
            <div className={styles.incomingCallBanner}>
                <div className={styles.incomingCallInfo}>
                    <FaVideo className={`${styles.callIcon} pulse`} />
                    <span>{recipientNickname} is calling you</span>
                </div>
                <div className={styles.incomingCallActions}>
                    <button
                        className={styles.declineCallBtnSmall}
                        onClick={handleDeclineCall}
                        aria-label="Decline call"
                    >
                        <FaTimes />
                    </button>
                    <button
                        className={styles.acceptCallBtnSmall}
                        onClick={handleAcceptCall}
                        aria-label="Accept call"
                    >
                        <FaVideo />
                    </button>
                </div>
            </div>
        )}
        {/* Active Call Banner */}
        {isCallActive && (
            <div className={styles.activeCallBanner}>
                <div>
                    <FaVideo className={styles.callIcon} />
                    <span>Call with {recipientNickname}</span>
                </div>
                <button
                    className={styles.endCallBtn}
                    onClick={handleEndCall}
                    aria-label="End call"
                >
                    <FaPhoneSlash /> End
                </button>
            </div>
        )}
    </>
));
CallBanners.displayName = 'CallBanners'; // For React DevTools

// PremiumBanner Component (Shown for FREE users)
const PremiumBanner = React.memo(({ navigate }) => (
     <div className={styles.premiumBanner}>
        <div>
            <FaCrown className={styles.premiumIcon} />
            <span>Upgrade to send messages and make calls</span>
        </div>
        <button
            className={styles.upgradeBtn}
            onClick={() => navigate("/subscription")}
            aria-label="Upgrade to premium"
        >
            Upgrade
        </button>
    </div>
));
PremiumBanner.displayName = 'PremiumBanner'; // For React DevTools

// LoadingIndicator Component (Shown while messages are loading)
const LoadingIndicator = React.memo(({ showTimeoutMessage, handleRetry, handleReconnect }) => (
    <div className={styles.loadingMessages}>
        <div className={styles.spinner}></div>
        <p>
            {showTimeoutMessage
                ? "This is taking longer than expected. Please wait or retry..."
                : "Loading messages..."}
        </p>
        {showTimeoutMessage && (
            <div className={styles.loadingActions}>
                <button className={styles.refreshButton} onClick={handleRetry} aria-label="Retry loading messages">
                    Retry
                </button>
                <button className={styles.resetButton} onClick={handleReconnect} aria-label="Force reconnect">
                    Reconnect
                </button>
            </div>
        )}
    </div>
));
LoadingIndicator.displayName = 'LoadingIndicator'; // For React DevTools

// ErrorMessage Component (Shown when loading messages fails)
const ErrorMessage = React.memo(({ error, handleRetry, handleForceInit, showInitButton }) => (
    <div className={styles.messageError}>
        <FaExclamationCircle />
        <p>{error || "An unknown error occurred."}</p>
        <div className={styles.errorActions}>
            <button onClick={handleRetry} className={styles.retryButton} aria-label="Retry loading messages">
                Retry Loading
            </button>
            {showInitButton && (
                 <button onClick={handleForceInit} className={styles.initButton} aria-label="Force initialization">
                     Force Init
                 </button>
            )}
        </div>
    </div>
));
ErrorMessage.displayName = 'ErrorMessage'; // For React DevTools

// ConnectionIssueMessage Component (Shown during initialization or reconnection attempts)
const ConnectionIssueMessage = React.memo(({ handleReconnect, isInitializing }) => (
     <div className={styles.loadingMessages}> {/* Re-use loading style */}
        <div className={styles.spinner}></div>
        <p>{isInitializing ? "Initializing chat..." : "Trying to reconnect..."}</p>
        <div className={styles.errorActions}>
            <button onClick={handleReconnect} className={styles.retryButton} aria-label="Force reconnection">
                Reconnect
            </button>
        </div>
    </div>
));
ConnectionIssueMessage.displayName = 'ConnectionIssueMessage'; // For React DevTools

// --- Main EmbeddedChat Component ---

/**
 * EmbeddedChat component
 * A fully functional chat interface.
 */
const EmbeddedChat = ({ recipient, isOpen = true, onClose = () => {} }) => {
    // --- Hooks ---
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const recipientId = recipient?._id;

    // Use the custom chat hook for core logic
    const {
        messages: hookMessages,
        loading: hookLoading,
        error: hookError,
        sendMessage: hookSendMessage,
        sendFileMessage: hookSendFileMessage, // Assuming hook provides this
        typingStatus,
        sendTyping,
        loadMoreMessages,
        hasMore,
        sending: sendingMessage, // Use sending state from hook
        initialized,
        isConnected,
        refresh: refreshChat,
    } = useChat(recipientId); // Pass recipientId directly

    // --- State ---
    const [localMessages, setLocalMessages] = useState([]); // Combines hook messages + local system messages
    const [newMessage, setNewMessage] = useState(""); // Current message input value
    const [showEmojis, setShowEmojis] = useState(false); // Emoji picker visibility
    const [attachment, setAttachment] = useState(null); // Selected file attachment
    const [isUploading, setIsUploading] = useState(false); // Local state for upload UI feedback
    const [uploadProgress, setUploadProgress] = useState(0); // Upload progress percentage
    const [pendingPhotoRequests, setPendingPhotoRequests] = useState(0); // Count of pending photo requests from recipient
    const [isApprovingRequests, setIsApprovingRequests] = useState(false); // Loading state for approving requests
    const [requestsData, setRequestsData] = useState([]); // Store request IDs (future use for individual approval)
    const [incomingCall, setIncomingCall] = useState(null); // Details of an incoming call
    const [isCallActive, setIsCallActive] = useState(false); // Whether a video call is currently active
    const [loadingTimedOut, setLoadingTimedOut] = useState(false); // Flag if loading takes too long

    // --- Refs ---
    const messagesEndRef = useRef(null); // Ref for the element at the end of messages list (for scrolling)
    const chatInputRef = useRef(null); // Ref for the message text input field
    const fileInputRef = useRef(null); // Ref for the hidden file input element
    const typingTimeoutRef = useRef(null); // Ref for debouncing typing indicator sending
    const loadingTimeoutRef = useRef(null); // Ref for the loading timeout timer
    const messagesContainerRef = useRef(null); // Ref for the scrollable message container div
    const isInitialLoadDone = useRef(false); // Ref to track if initial scroll-to-bottom has happened

    // --- Memoized Values ---
    const authAxios = useMemo(() => createAuthAxios(), []); // Create authorized axios instance once

    // --- Effects ---

    // Initial Log & Cleanup Setup
    useEffect(() => {
        log.debug("EmbeddedChat mounted for recipient:", recipient?.nickname);
        console.log("Chat initial state:", { recipientId, initialized, isConnected, userId: user?._id, isAuthenticated });

        // Cleanup function runs on unmount
        return () => {
            log.debug("EmbeddedChat unmounted");
            // Clear any active timeouts
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        };
    }, [recipientId, recipient?.nickname, initialized, isConnected, user?._id, isAuthenticated]);

    // Update Local Messages (Merge hook messages and local system messages)
    useEffect(() => {
        // Combine messages from the hook with locally generated system messages
        const combined = [...(hookMessages || [])];
        const localSystemMessages = localMessages.filter(msg => msg.type === 'system' && msg._id?.startsWith('local-'));

        // Add local messages if they aren't already present (by ID)
        localSystemMessages.forEach(localMsg => {
            if (!combined.some(msg => msg._id === localMsg._id)) {
                combined.push(localMsg);
            }
        });

        // Sort all messages by date to ensure correct chronological order
        combined.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        // Filter out duplicates based on ID, preferring non-local if IDs clash (unlikely)
        const uniqueMessages = [];
        const seenIds = new Set();
        for (let i = combined.length - 1; i >= 0; i--) { // Iterate backwards for efficiency
            const msg = combined[i];
            const id = msg._id || msg.tempId;
            if (id && !seenIds.has(id)) {
                 // Basic validation and normalization
                const normalizedMsg = {
                    ...msg,
                    _id: id,
                    sender: msg.sender || "unknown",
                    content: msg.content ?? "", // Ensure content is not null/undefined
                    createdAt: msg.createdAt || new Date().toISOString(),
                    type: msg.type || "text"
                };
                uniqueMessages.unshift(normalizedMsg); // Add to beginning to maintain order
                seenIds.add(id);
            } else if (!id) {
                 log.warn("Message without ID found:", msg);
            }
        }

        // Only update state if messages actually changed (simple JSON compare)
        // Avoids infinite loops if hookMessages reference changes without content change
        if (JSON.stringify(uniqueMessages) !== JSON.stringify(localMessages)) {
             setLocalMessages(uniqueMessages);
             log.debug(`Updated localMessages with ${uniqueMessages.length} unique messages.`);
        }

    }, [hookMessages, localMessages]); // Rerun when hookMessages changes


    // Scroll Management Effect (Handles initial scroll and subsequent updates)
    useEffect(() => {
        const messagesEndEl = messagesEndRef.current;
        const containerEl = messagesContainerRef.current;

        // Exit if refs aren't ready or chat isn't open
        if (!messagesEndEl || !containerEl || !isOpen) {
            // Reset the flag if the chat is closed, so it scrolls on next open
            if (!isOpen) {
                isInitialLoadDone.current = false;
            }
            return;
        }

        // Perform initial instant scroll after initialization and first message load
        if (initialized && localMessages.length > 0 && !isInitialLoadDone.current) {
            log.debug("Performing initial instant scroll to bottom.");
            messagesEndEl.scrollIntoView({ behavior: 'instant', block: 'end' }); // Use 'instant' and 'block: end'
            isInitialLoadDone.current = true; // Mark initial scroll completed for this session
        }
        // Handle smooth scrolling for subsequent messages ONLY if user is near the bottom
        else if (isInitialLoadDone.current && localMessages.length > 0) {
            // Calculate if user is near the bottom (within ~150px tolerance)
            const scrollThreshold = 150;
            const isNearBottom = containerEl.scrollHeight - containerEl.scrollTop - containerEl.clientHeight < scrollThreshold;

            if (isNearBottom) {
                // log.debug("Near bottom, performing smooth scroll for new message.");
                // Debounce smooth scroll slightly to prevent jumpiness if multiple messages arrive fast
                const timerId = setTimeout(() => {
                    messagesEndEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }, SMOOTH_SCROLL_DEBOUNCE_MS); // Debounce time

                // Cleanup the timer if the effect re-runs before timeout
                return () => clearTimeout(timerId);
            } else {
                // log.debug("User scrolled up, not auto-scrolling.");
            }
        }
        // Reset if chat becomes uninitialized (e.g., error state)
        else if (!initialized) {
            isInitialLoadDone.current = false;
        }

    }, [localMessages, initialized, isOpen, recipientId]); // Dependencies trigger re-evaluation

    // Loading Timeout Management
    useEffect(() => {
        if (hookLoading) {
            setLoadingTimedOut(false); // Reset timeout flag when loading starts
            // Set a timeout to show the "taking longer" message
            loadingTimeoutRef.current = setTimeout(() => {
                log.warn("Loading timeout triggered.");
                setLoadingTimedOut(true);
            }, LOADING_TIMEOUT_MS);
        } else {
            // Clear timeout if loading finishes before timeout occurs
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
            }
            setLoadingTimedOut(false); // Reset timeout flag
        }

        // Cleanup timeout on effect change or unmount
        return () => {
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
            }
        };
    }, [hookLoading]);

    // Check Pending Photo Requests from this recipient
    const checkPendingPhotoRequests = useCallback(async () => {
        if (!recipientId || !user?._id) return; // Need recipient and user IDs
        try {
            const response = await authAxios.get(`/api/users/photos/permissions`, {
                params: { requestedBy: recipientId, status: "pending" }, // Query specific requests
            });
            if (response.data?.success) {
                const requests = response.data.data || [];
                setPendingPhotoRequests(requests.length);
                setRequestsData(requests); // Store request details (e.g., IDs) if needed later
            } else {
                setPendingPhotoRequests(0);
                setRequestsData([]);
            }
        } catch (error) {
            log.error("Error checking photo permissions:", error);
            setPendingPhotoRequests(0);
            setRequestsData([]);
        }
    }, [authAxios, recipientId, user?._id]); // Dependencies for the check

    // Run photo request check when chat opens or recipient changes
    useEffect(() => {
        if (isOpen && recipientId && user?._id) {
            checkPendingPhotoRequests();
        }
    }, [isOpen, recipientId, user?._id, checkPendingPhotoRequests]);

    // Focus Input on Open (but not if call is active)
    useEffect(() => {
        if (isOpen && recipientId && !isCallActive) {
            // Delay slightly to ensure input is rendered and visible
            setTimeout(() => {
                chatInputRef.current?.focus();
            }, INPUT_FOCUS_DELAY_MS);
        }
    }, [isOpen, recipientId, isCallActive]);

    // Socket Event Listeners (Video Calls)
    useEffect(() => {
        // Only listen if chat is open, recipient exists, user exists, and socket is available
        if (!isOpen || !recipientId || !user?._id || !socketService) return;

        // Helper to add system messages to the local state
        const addSystemMessage = (content, error = false) => {
            const newMessage = {
                _id: generateLocalUniqueId('system'),
                sender: "system",
                content,
                createdAt: new Date().toISOString(),
                type: "system",
                error: error,
            };
             setLocalMessages((prev) => {
                // Avoid adding duplicate system messages by ID
                if (prev.some(msg => msg._id === newMessage._id)) return prev;
                // Add new message and re-sort immediately to maintain order
                const updated = [...prev, newMessage];
                updated.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                return updated;
             });
        };

        // Handler for incoming call events
        const handleIncomingCall = (call) => {
            // Ignore calls not from the current chat recipient
            if (call.userId !== recipientId) return;
            log.debug(`Received incoming call from ${call.userId}`, call);
            setIncomingCall({
                callId: call.callId,
                callerName: call.caller?.name || recipient?.nickname || "Unknown Caller",
                callerId: call.userId,
                timestamp: call.timestamp,
            });
            addSystemMessage(`${recipient?.nickname || 'Someone'} is calling you.`);
        };

        // Handler for when the other user accepts our call
        const handleCallAccepted = (data) => {
            if (data.userId !== recipientId) return;
            log.debug(`Call accepted by ${recipient?.nickname}`);
            addSystemMessage(`${recipient?.nickname || 'User'} accepted your call.`);
            setIsCallActive(true); // Ensure call UI activates if we initiated
            setIncomingCall(null); // Clear incoming call banner if we accepted
            toast.success(`${recipient?.nickname} accepted your call`);
        };

        // Handler for when the other user declines our call or we decline theirs
        const handleCallDeclined = (data) => {
            if (data.userId !== recipientId) return;
            log.debug(`Call declined by ${recipient?.nickname}`);
            addSystemMessage(`${recipient?.nickname || 'User'} declined your call.`);
            if (isCallActive) setIsCallActive(false); // End call if we initiated and they declined
            setIncomingCall(null); // Clear incoming call banner
            toast.info(`${recipient?.nickname} declined your call`);
        };

        // Handler for when either user hangs up
        const handleCallHangup = (data) => {
             // Check if hangup involves current user or recipient
             if (data.userId === recipientId || data.userId === user._id) {
                log.debug(`Call hung up involving ${data.userId}`);
                // If a call was active, end it
                if (isCallActive) {
                    addSystemMessage(`Video call with ${recipient?.nickname} ended.`);
                    setIsCallActive(false);
                    setIncomingCall(null); // Clear any lingering incoming state
                    toast.info("Video call ended");
                }
                // If it was an incoming call that they hung up before we answered
                else if (incomingCall && incomingCall.callerId === recipientId) {
                    addSystemMessage(`${recipient?.nickname} ended the call attempt.`);
                    setIncomingCall(null); // Clear incoming banner
                }
            }
        };

        // Register listeners
        const listeners = [
            socketService.on("incomingCall", handleIncomingCall),
            socketService.on("callAccepted", handleCallAccepted),
            socketService.on("callDeclined", handleCallDeclined),
            socketService.on("videoHangup", handleCallHangup),
        ];

        // Cleanup: Unregister listeners on unmount or when dependencies change
        return () => {
            listeners.forEach(unsubscribe => unsubscribe && unsubscribe());
        };
    }, [isOpen, recipientId, recipient?.nickname, user?._id, isCallActive, incomingCall]); // Dependencies ensure listeners are updated correctly

    // --- Event Handlers ---

    // Adds a system message locally (e.g., for call status, errors)
    const addLocalSystemMessage = useCallback((content, error = false) => {
        const newMessage = {
            _id: generateLocalUniqueId('system'), // Generate unique local ID
            sender: "system",
            content,
            createdAt: new Date().toISOString(),
            type: "system",
            error: error,
        };
        // Use functional update to get latest state and ensure order
        setLocalMessages(prev => {
             // Prevent adding exact duplicate system message ID
            if (prev.some(msg => msg._id === newMessage._id)) return prev;
             const updated = [...prev, newMessage];
             // Re-sort after adding to maintain chronological order
             updated.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
             return updated;
        });
    }, []); // No dependencies needed as it uses generateLocalUniqueId and setLocalMessages

    // Handler to approve all pending photo requests from the recipient
    const handleApproveAllRequests = useCallback(async (e) => {
        if (e) e.stopPropagation(); // Prevent event bubbling if called from button click
        if (pendingPhotoRequests === 0 || !recipientId) return; // Exit if no requests or recipient

        setIsApprovingRequests(true); // Set loading state
        try {
            // API call to approve all requests from this specific requester
            const response = await authAxios.post(`/api/users/photos/approve-all`, {
                requesterId: recipientId,
            });

            if (response.data?.success) {
                const approvedCount = response.data.approvedCount || pendingPhotoRequests; // Use count from response or fallback
                toast.success(`Approved ${approvedCount} photo request${approvedCount !== 1 ? "s" : ""}`);
                addLocalSystemMessage(`Photo access approved.`); // Add system message

                // Optionally send a notification message to the recipient
                 if (hookSendMessage && user?.accountTier !== 'FREE') {
                    await hookSendMessage("I've approved your request to view my private photos.", 'text');
                 }

                // Reset pending request state
                setPendingPhotoRequests(0);
                setRequestsData([]);
            } else {
                 // Throw error if API indicates failure
                 throw new Error(response.data?.message || "Approval failed");
            }
        } catch (error) {
            log.error("Error approving photo requests:", error);
            toast.error(`Error approving requests: ${error.message}. Please try again.`);
            addLocalSystemMessage("Failed to approve photo requests.", true); // Add error system message
        } finally {
            setIsApprovingRequests(false); // Reset loading state
        }
    }, [authAxios, recipientId, pendingPhotoRequests, hookSendMessage, user?.accountTier, addLocalSystemMessage]);

    // Handler for changes in the message input field
    const handleInputChange = useCallback((e) => {
        const value = e.target.value;
        setNewMessage(value); // Update input state

        // Clear existing typing timeout if user continues typing
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Send typing indicator if input has content and chat is connected
        if (value.trim() && recipientId && sendTyping && isConnected) {
            // Debounce sending typing indicator
            typingTimeoutRef.current = setTimeout(() => {
                sendTyping(); // Call the hook's function to send typing event
            }, TYPING_DEBOUNCE_MS);
        }
    }, [recipientId, sendTyping, isConnected]); // Dependencies for input change handler

    // Internal helper function to handle sending logic (text, wink, file metadata)
    const sendMessageInternal = useCallback(async (content, type = 'text', metadata = null) => {
        // Pre-send checks
        if (!initialized) {
            toast.error("Chat not ready. Please wait.");
            return false; // Indicate failure
        }
        if (!isConnected) {
            toast.error("No connection. Cannot send message.");
             addLocalSystemMessage("Message failed: No connection.", true);
            return false; // Indicate failure
        }
        if (!recipientId) {
            toast.error("Recipient not defined.");
            return false; // Indicate failure
        }

        log.debug(`Attempting to send ${type} message to ${recipientId}`);
        try {
            // Use dedicated file sending function from hook if available and type is file
            if (type === 'file' && hookSendFileMessage && metadata?.file) {
                await hookSendFileMessage(metadata.file, recipientId); // Pass the actual File object
            }
            // Otherwise, use the generic sendMessage function from the hook
            else if (hookSendMessage) {
                await hookSendMessage(content, type, metadata);
            } else {
                // This should not happen if useChat hook is implemented correctly
                throw new Error("Send message function is not available.");
            }
            log.debug(`${type} message sent successfully.`);
            return true; // Indicate success
        } catch (err) {
            log.error(`Failed to send ${type} message:`, err);
            toast.error(err.message || `Failed to send ${type}.`);
            addLocalSystemMessage(`Failed to send ${type === 'file' ? 'file' : 'message'}.`, true);
            return false; // Indicate failure
        }
    }, [initialized, isConnected, recipientId, hookSendMessage, hookSendFileMessage, addLocalSystemMessage]); // Dependencies for internal send logic


    // --- Define handleSendAttachment BEFORE handleSendMessage ---
    // Handler for sending the selected file attachment
    const handleSendAttachment = useCallback(async () => {
        // Checks before sending
        if (!attachment || !recipientId || isUploading || sendingMessage) return;

        // Free tier check
        if (user?.accountTier === 'FREE') {
            toast.error("Upgrade to send files.");
            return;
        }

        setIsUploading(true); // Set uploading state for UI feedback
        setUploadProgress(0); // Reset progress

        // Simulate progress for UI feedback (replace with actual progress if hook provides it)
        const progressInterval = setInterval(() => {
            setUploadProgress(prev => Math.min(prev + 10, 95)); // Cap at 95% until success/fail
        }, 200);


         try {
             // Prepare metadata to send along with the message
            const fileMetadata = {
                fileName: attachment.name,
                fileSize: attachment.size,
                fileType: attachment.type,
                // The actual file URL will be determined by the backend/hook response
                file: attachment // Pass the actual File object to the send function
            };

             // Call the internal send helper with type 'file'
            const success = await sendMessageInternal(
                `File: ${attachment.name}`, // Fallback content if needed
                'file',
                fileMetadata
             );

             if (success) {
                 toast.success("File sent successfully!");
                 setAttachment(null); // Clear selected attachment on success
                 if (fileInputRef.current) fileInputRef.current.value = ""; // Reset the hidden file input
            } else {
                 toast.error("File upload failed. Please try again.");
                 // Clear attachment even on failure to avoid resending the same failed file easily
                 setAttachment(null);
                 if (fileInputRef.current) fileInputRef.current.value = "";
            }
         } catch (error) {
             // Error should have been logged and toasted by sendMessageInternal
            setAttachment(null); // Clear attachment on error
            if (fileInputRef.current) fileInputRef.current.value = "";
         } finally {
            clearInterval(progressInterval); // Stop simulated progress
            setUploadProgress(100); // Show 100% briefly
            // Short delay before resetting progress bar visual and uploading state
            setTimeout(() => {
                 setIsUploading(false);
                 setUploadProgress(0);
             }, 500);
         }

    }, [attachment, recipientId, isUploading, sendingMessage, user?.accountTier, sendMessageInternal]); // Dependencies for file sending


    // --- Define handleSendMessage AFTER handleSendAttachment ---
    // Handler for sending text messages (or triggering attachment send)
    const handleSendMessage = useCallback(async (e) => {
        if (e) e.preventDefault(); // Prevent default form submission if applicable

        // If an attachment is selected, prioritize sending that
        if (attachment) {
            await handleSendAttachment(); // Call the attachment handler
            return;
        }

        // Prepare text message content
        const messageToSend = newMessage.trim();
        // Exit if message is empty, already sending, or recipient is missing
        if (!messageToSend || sendingMessage || !recipientId) {
            return;
        }

        // Free account restriction check
        if (user?.accountTier === "FREE" && messageToSend !== "😉") {
            toast.error("Free accounts can only send winks 😉. Upgrade to send messages.");
            return;
        }

        setNewMessage(""); // Optimistically clear the input field

        // Call the internal send helper with type 'text'
        const success = await sendMessageInternal(messageToSend, 'text');

        if (success) {
            // Message sent successfully (hook likely handles optimistic UI update)
            chatInputRef.current?.focus(); // Refocus input field
        } else {
             // If sending failed, restore the message to the input for retry
             setNewMessage(messageToSend);
        }

    }, [newMessage, attachment, sendingMessage, recipientId, user?.accountTier, sendMessageInternal, handleSendAttachment]); // Dependencies for text sending


    // Handler for sending a wink
    const handleSendWink = useCallback(async () => {
        // Exit if already sending or no recipient
        if (sendingMessage || !recipientId) return;
        // Call internal send helper with type 'wink'
        await sendMessageInternal("😉", 'wink');
    }, [sendingMessage, recipientId, sendMessageInternal]); // Dependencies for wink sending

    // Handler for clicking the attachment icon (opens file input)
    const handleFileAttachmentClick = useCallback(() => {
        // Free tier check
        if (user?.accountTier === "FREE") {
            toast.error("Free accounts cannot send files. Upgrade to enable.");
            return;
        }
        // Programmatically click the hidden file input
        fileInputRef.current?.click();
    }, [user?.accountTier]); // Dependency on user tier

    // Handler for when a file is selected via the file input
    const handleFileChange = useCallback((e) => {
        const file = e.target.files?.[0]; // Get the selected file
        if (!file) return; // Exit if no file selected

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            toast.error(`File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
            e.target.value = null; // Reset input
            return;
        }

        // Validate file type
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            toast.error("File type not supported.");
            log.warn(`Unsupported file type attempted: ${file.type}`);
            e.target.value = null; // Reset input
            return;
        }

        // File is valid, set it in state
        setAttachment(file);
        setNewMessage(""); // Clear any text message when attaching file
        toast.info(`Selected file: ${file.name}. Click send.`);
        e.target.value = null; // Reset input value to allow selecting the same file again later
    }, []); // No dependencies needed here

    // Handler for removing the selected attachment before sending
    const handleRemoveAttachment = useCallback(() => {
        setAttachment(null); // Clear attachment state
        setUploadProgress(0); // Reset progress
        setIsUploading(false); // Ensure upload state is reset
        // Reset the hidden file input's value
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        chatInputRef.current?.focus(); // Focus back on text input
    }, []); // No dependencies needed

    // Handler for clicking an emoji in the picker
    const handleEmojiClick = useCallback((emoji) => {
        // Append emoji to the current message input value
        setNewMessage((prev) => prev + emoji);
        setShowEmojis(false); // Close the emoji picker
        chatInputRef.current?.focus(); // Focus back on text input
    }, []); // No dependencies needed

    // Handler for Enter key press in the input field
    const handleKeyPress = useCallback((e) => {
        // Check if Enter key was pressed without the Shift key
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent default newline behavior
            handleSendMessage(); // Trigger message send action
        }
    }, [handleSendMessage]); // Depends on handleSendMessage


    // --- Video Call Handlers ---

    // Handler to initiate an outgoing video call
    const handleVideoCall = useCallback(async (e) => {
        if (e) e.stopPropagation(); // Prevent event bubbling

        // Pre-call checks
        if (!socketService || !socketService.isConnected()) {
            addLocalSystemMessage("Cannot start call: Connection issue.", true);
            log.error("Cannot initiate call - socket not connected");
            return;
        }
        if (!recipient?.isOnline) {
            addLocalSystemMessage(`${recipient.nickname} is offline. Cannot call.`, true);
            return;
        }
        if (user?.accountTier === "FREE") {
            addLocalSystemMessage("Upgrade to Premium to make video calls.", true);
            return;
        }
        if (!recipientId) {
             addLocalSystemMessage("Cannot start call: Recipient not defined.", true);
             return;
        }

        addLocalSystemMessage(`Initiating call to ${recipient.nickname}...`);
        log.debug(`Initiating video call to ${recipientId}`);
        try {
            // Attempt to initiate call via socket service (async operation)
            await socketService.initiateVideoCall(recipientId);
            // If successful, optimistically open the call UI
            setIsCallActive(true);
            addLocalSystemMessage(`Calling ${recipient.nickname}... Waiting for response.`);
            // Actual call connection/acceptance is handled by socket events

        } catch (error) {
            log.error("Video call initiation error:", error);
            addLocalSystemMessage(error.message || "Could not start video call.", true);
            setIsCallActive(false); // Ensure call UI is closed if initiation fails immediately
        }
    }, [recipient, recipientId, user?.accountTier, isConnected, addLocalSystemMessage]); // Dependencies for initiating call

    // Handler to end the current video call (either outgoing or incoming)
    const handleEndCall = useCallback((e) => {
        if (e) e.stopPropagation(); // Prevent event bubbling
        log.debug("handleEndCall triggered");
        // If a call is active, notify the other user via socket
        if (isCallActive && recipientId && socketService) {
             log.debug(`Emitting videoHangup for recipient ${recipientId}`);
            socketService.emit("videoHangup", { recipientId: recipientId }); // Notify other user
        }
        // Reset local call state regardless of socket success
        setIsCallActive(false);
        setIncomingCall(null); // Clear incoming call state as well
        addLocalSystemMessage(`Video call ended.`); // Add system message
    }, [isCallActive, recipientId, addLocalSystemMessage]); // Dependencies for ending call

    // Handler to accept an incoming video call
    const handleAcceptCall = useCallback(() => {
        if (!incomingCall || !socketService) return; // Exit if no incoming call or socket
        log.debug(`Accepting call ${incomingCall.callId} from ${incomingCall.callerId}`);
        // Notify server/peer that call is accepted
        socketService.answerVideoCall(incomingCall.callerId, true, incomingCall.callId);
        addLocalSystemMessage(`Accepted call from ${incomingCall.callerName}.`);
        setIsCallActive(true); // Show active call UI
        setIncomingCall(null); // Hide incoming call banner
    }, [incomingCall, addLocalSystemMessage]); // Dependencies for accepting call

    // Handler to decline an incoming video call
    const handleDeclineCall = useCallback(() => {
        if (!incomingCall || !socketService) return; // Exit if no incoming call or socket
         log.debug(`Declining call ${incomingCall.callId} from ${incomingCall.callerId}`);
        // Notify server/peer that call is declined
        socketService.answerVideoCall(incomingCall.callerId, false, incomingCall.callId);
        addLocalSystemMessage(`Declined call from ${incomingCall.callerName}.`);
        setIncomingCall(null); // Hide incoming call banner
    }, [incomingCall, addLocalSystemMessage]); // Dependencies for declining call


    // --- Retry/Reconnect Handlers ---

    // Handler to retry loading messages via the hook's refresh function
    const handleRetryLoad = useCallback(() => {
        log.debug("Retrying chat refresh...");
        setLoadingTimedOut(false); // Reset loading timeout flag
         refreshChat(); // Call the hook's refresh function
    }, [refreshChat]); // Depends on refreshChat from useChat hook

    // Handler to attempt manual socket reconnection and refresh
    const handleReconnect = useCallback(() => {
        log.debug("Attempting manual reconnect...");
        toast.info("Attempting to reconnect...");
        // Try reconnecting socket if service provides the method
        if (socketService && socketService.reconnect) {
            socketService.reconnect();
        }
        // Give socket time to potentially reconnect, then refresh chat data
        setTimeout(() => {
            refreshChat();
        }, RECONNECT_DELAY_MS);
    }, [refreshChat]); // Depends on refreshChat from useChat hook

    // --- Define handleForceInit AFTER handleReconnect ---
    // Handler for a more drastic re-initialization attempt (currently just calls reconnect)
    const handleForceInit = useCallback(() => {
         // This might involve more complex state reset or service re-initialization
         // depending on the application's architecture.
         log.warn("Forcing chat service re-initialization attempt...");
         toast.info("Attempting to re-initialize chat...");
        // As a basic implementation, just trigger the reconnect logic.
        handleReconnect();
    }, [handleReconnect]); // Depends on handleReconnect


    // --- Render Logic ---

    // Don't render anything if the chat is not supposed to be open
    if (!isOpen) {
        return null;
    }

    // Show a minimal loading state if recipient data is not yet available
    if (!recipient) {
        return (
            <div className={`${styles.chatContainer} ${styles.opening}`}>
                <div className={styles.loadingMessages}>
                    <div className={styles.spinner}></div>
                    <p>Loading recipient...</p>
                </div>
            </div>
        );
    }

    // Determine if primary actions (sending, calling) should be disabled
    const isActionDisabled = isUploading || sendingMessage;

    // Main component structure
    return (
        <div className={`${styles.chatContainer} ${styles.opening}`}>
            {/* Chat Header */}
            <ChatHeader
                recipient={recipient}
                userTier={user?.accountTier}
                pendingPhotoRequests={pendingPhotoRequests}
                isApprovingRequests={isApprovingRequests}
                handleApproveAllRequests={handleApproveAllRequests}
                isCallActive={isCallActive}
                handleEndCall={handleEndCall}
                handleVideoCall={handleVideoCall}
                isActionDisabled={isActionDisabled}
                onClose={onClose}
                isConnected={isConnected}
            />

            {/* Premium Upsell Banner for FREE users */}
            {user?.accountTier === "FREE" && <PremiumBanner navigate={navigate} />}

            {/* Incoming/Active Call Banners */}
            <CallBanners
                 incomingCall={incomingCall}
                 isCallActive={isCallActive}
                 recipientNickname={recipient.nickname}
                 handleAcceptCall={handleAcceptCall}
                 handleDeclineCall={handleDeclineCall}
                 handleEndCall={handleEndCall} // Pass end call handler for active banner
             />

            {/* Message Display Area (Scrollable) */}
            <div className={styles.messagesContainer} ref={messagesContainerRef}>
                {/* Conditional rendering based on loading/error/data state */}
                {hookLoading && !localMessages.length ? (
                     // Show loading indicator only if no messages are displayed yet
                     <LoadingIndicator
                         showTimeoutMessage={loadingTimedOut}
                         handleRetry={handleRetryLoad}
                         handleReconnect={handleReconnect}
                     />
                ) : hookError ? (
                    // Show error message if loading failed
                    <ErrorMessage
                        error={hookError}
                        handleRetry={handleRetryLoad}
                        handleForceInit={handleForceInit}
                        showInitButton={!initialized} // Show init button if initialization failed
                    />
                 ) : !initialized || (!isConnected && !localMessages.length) ? (
                     // Show initializing/reconnecting message
                     <ConnectionIssueMessage
                         handleReconnect={handleReconnect}
                         isInitializing={!initialized}
                    />
                ) : localMessages.length === 0 && !hookLoading ? (
                    // Show "No messages" if loaded but empty
                    <div className={styles.noMessages}>
                        <p>No messages yet. Say hello!</p>
                    </div>
                ) : (
                    // Render the list of messages
                    <MessageList
                        messages={localMessages}
                        currentUserId={user?._id}
                        typingStatus={typingStatus}
                        hasMore={hasMore}
                        loadMoreMessages={loadMoreMessages}
                    />
                )}
                 {/* Empty div at the very end acts as a target for scrolling */}
                 <div ref={messagesEndRef} />
            </div>

            {/* Attachment Preview (shown below messages, above input) */}
            {attachment && !isUploading && ( // Show preview only if not currently uploading
                <AttachmentPreview
                    attachment={attachment}
                    isUploading={isUploading} // Will be false here
                    uploadProgress={uploadProgress}
                    handleRemoveAttachment={handleRemoveAttachment}
                />
            )}
             {/* Upload Progress Bar (shown during upload) */}
             {isUploading && (
                <div className={styles.uploadProgressContainer} style={{ margin: '5px 10px' }}>
                     <div className={styles.uploadProgressBar} style={{ width: `${uploadProgress}%` }} />
                     <span className={styles.uploadProgressText}>{`Uploading ${uploadProgress}%`}</span>
                </div>
             )}

            {/* Message Input Area */}
             <ChatInput
                 newMessage={newMessage}
                 handleInputChange={handleInputChange}
                 handleKeyPress={handleKeyPress}
                 chatInputRef={chatInputRef}
                 showEmojis={showEmojis}
                 setShowEmojis={setShowEmojis}
                 handleEmojiClick={handleEmojiClick}
                 handleFileAttachment={handleFileAttachmentClick} // Use specific handler
                 handleSendWink={handleSendWink}
                 handleSubmit={handleSendMessage} // Use specific handler
                 isSending={sendingMessage} // Use hook's sending state
                 isUploading={isUploading}
                 userTier={user?.accountTier}
                 attachment={attachment} // Pass attachment to disable send button correctly
             />

             {/* Hidden file input element */}
             <input
                 type="file"
                 ref={fileInputRef}
                 style={{ display: "none" }} // Keep it hidden
                 onChange={handleFileChange}
                 aria-hidden="true"
                 accept={ALLOWED_FILE_TYPES.join(",")} // Use constant for allowed types
             />

             {/* Video Call UI Overlay (shown when call is active) */}
             {isCallActive && recipientId && user?._id && (
                 <div className={`${styles.videoCallOverlay} ${styles.active}`}>
                    {/* Render the separate VideoCall component */}
                    <VideoCall
                        isActive={isCallActive} // Pass active state
                        userId={user._id}
                        recipientId={recipientId}
                        onEndCall={handleEndCall} // Pass end call handler
                        // Determine if call was originally incoming (might need refinement based on VideoCall needs)
                        isIncoming={!!incomingCall && !isCallActive}
                        callId={incomingCall?.callId} // Pass callId if available
                    />
                </div>
            )}
        </div>
    );
};

// --- Prop Types ---
// Define expected props and their types for component documentation and validation
EmbeddedChat.propTypes = {
    /** The recipient user object */
    recipient: PropTypes.shape({
        _id: PropTypes.string.isRequired, // Recipient must have an ID
        nickname: PropTypes.string.isRequired, // Recipient must have a nickname
        isOnline: PropTypes.bool, // Online status is optional
        photos: PropTypes.arrayOf(PropTypes.shape({ url: PropTypes.string })) // Photos array is optional
    }), // Recipient itself is optional at top level, handled in render logic
    /** Whether the chat window is currently open */
    isOpen: PropTypes.bool,
    /** Function to call when the chat window should be closed */
    onClose: PropTypes.func,
};

// --- Default Props ---
// Set default values for props that might not be provided
EmbeddedChat.defaultProps = {
  isOpen: true, // Default to open if not specified
  onClose: () => {}, // Default to an empty function if no close handler provided
  recipient: null, // Default recipient to null, handled in render logic
};

export default EmbeddedChat;
