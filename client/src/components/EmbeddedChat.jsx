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

import { useAuth } from "../context/AuthContext";
import { useChat } from "../hooks/useChat";
import { logger } from "../utils/logger";
import socketService from "../services/socketService";
import VideoCall from "./VideoCall";

import styles from "../styles/embedded-chat.module.css";

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
let localIdCounter = 0;
const generateLocalUniqueId = (prefix = 'local') => {
    localIdCounter++;
    return `${prefix}-${Date.now()}-${localIdCounter}-${Math.random().toString(36).substring(2, 9)}`;
};

const createAuthAxios = () => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    return axios.create({
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
    const fileType = file.type || file.fileType || "";
    if (fileType.startsWith("image/")) return <FaImage />;
    if (fileType.startsWith("video/")) return <FaFileVideo />;
    if (fileType.startsWith("audio/")) return <FaFileAudio />;
    if (fileType === "application/pdf") return <FaFilePdf />;
    return <FaFileAlt />;
};

// --- Internal Components ---
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
                    <span className={recipient.isOnline ? styles.statusOnline : styles.statusOffline}>
                        {recipient.isOnline ? "Online" : "Offline"}
                    </span>
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
ChatHeader.displayName = 'ChatHeader';

const MessageItem = React.memo(({ message, currentUserId, isSent }) => {
    const renderContent = () => {
        switch (message.type) {
            case "text":
                return (
                    <>
                        <p className={styles.messageContent}>{message.content}</p>
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
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    Download</a>
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
            case "video":
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

    return (
        <div
            className={`${styles.message} ${isSent ? styles.sent : styles.received} ${
                message.type === "system" ? styles.systemMessage : ""
            } ${message.error ? styles.error : ""} ${message.pending ? styles.pending : ""}`}
        >
            {renderContent()}
        </div>
    );
});
MessageItem.displayName = 'MessageItem';

const MessageList = React.memo(({ messages, currentUserId, typingStatus, hasMore, loadMoreMessages }) => {
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
            {hasMore && (
                <button onClick={loadMoreMessages} className={styles.loadMoreButton}>
                    Load More
                </button>
            )}
            {Object.entries(groupedMessages).map(([date, msgs]) => (
                <React.Fragment key={date}>
                    <div className={styles.messageDate}>{date}</div>
                    {msgs.map((message) => (
                        <MessageItem
                            key={message.id || message.tempId}
                            message={message}
                            currentUserId={currentUserId}
                            isSent={message.sender === currentUserId}
                        />
                    ))}
                </React.Fragment>
            ))}
            {typingStatus && (
                <div className={styles.typingIndicator}>
                    <span></span><span></span><span></span>
                </div>
            )}
        </>
    );
});
MessageList.displayName = 'MessageList';

const ChatInput = React.memo(({
    newMessage, handleInputChange, handleKeyPress, chatInputRef, showEmojis,
    setShowEmojis, handleEmojiClick, handleFileAttachment, handleSendWink,
    handleSubmit, isSending, isUploading, userTier, attachment
}) => (
    <form className={styles.messageInput} onSubmit={handleSubmit}>
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

        <input
            type="text"
            placeholder={userTier === "FREE" ? "Free users can only send winks 😉" : "Type a message..."}
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            ref={chatInputRef}
            disabled={isSending || isUploading || (userTier === "FREE" && newMessage !== '😉')}
            aria-label="Message input"
            title={userTier === "FREE" ? "Upgrade to send text messages" : "Type a message"}
        />

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
ChatInput.displayName = 'ChatInput';

const AttachmentPreview = React.memo(({ attachment, isUploading, uploadProgress, handleRemoveAttachment }) => (
    <div className={styles.attachmentPreview}>
        <div className={styles.attachmentInfo}>
            {getFileIcon(attachment)}
            <span className={styles.attachmentName}>{attachment.name}</span>
            <span className={styles.attachmentSize}>({Math.round(attachment.size / 1024)} KB)</span>
        </div>
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
                disabled={isUploading}
                aria-label="Remove attachment"
            >
                <FaTimes />
            </button>
        )}
    </div>
));
AttachmentPreview.displayName = 'AttachmentPreview';

const CallBanners = React.memo(({ incomingCall, isCallActive, recipientNickname, handleAcceptCall, handleDeclineCall, handleEndCall }) => (
    <>
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
CallBanners.displayName = 'CallBanners';

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
PremiumBanner.displayName = 'PremiumBanner';

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
LoadingIndicator.displayName = 'LoadingIndicator';

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
ErrorMessage.displayName = 'ErrorMessage';

const ConnectionIssueMessage = React.memo(({ handleReconnect, isInitializing }) => (
     <div className={styles.loadingMessages}>
        <div className={styles.spinner}></div>
        <p>{isInitializing ? "Initializing chat..." : "Trying to reconnect..."}</p>
        <div className={styles.errorActions}>
            <button onClick={handleReconnect} className={styles.retryButton} aria-label="Force reconnection">
                Reconnect
            </button>
        </div>
    </div>
));
ConnectionIssueMessage.displayName = 'ConnectionIssueMessage';

/**
 * EmbeddedChat component
 * A fully functional chat interface.
 */
const EmbeddedChat = ({ recipient, isOpen = true, onClose = () => {} }) => {
    // --- Hooks ---
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const recipientId = recipient?.id;

    // Use the custom chat hook for core logic
    const {
        messages: hookMessages,
        loading: hookLoading,
        error: hookError,
        sendMessage: hookSendMessage,
        sendFileMessage: hookSendFileMessage,
        typingStatus,
        sendTyping,
        loadMoreMessages,
        hasMore,
        sending: sendingMessage,
        initialized,
        isConnected,
        refresh: refreshChat,
    } = useChat(recipientId);

    // --- State ---
    const [localMessages, setLocalMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [showEmojis, setShowEmojis] = useState(false);
    const [attachment, setAttachment] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [pendingPhotoRequests, setPendingPhotoRequests] = useState(0);
    const [isApprovingRequests, setIsApprovingRequests] = useState(false);
    const [requestsData, setRequestsData] = useState([]);
    const [incomingCall, setIncomingCall] = useState(null);
    const [isCallActive, setIsCallActive] = useState(false);
    const [loadingTimedOut, setLoadingTimedOut] = useState(false);

    // --- Refs ---
    const messagesEndRef = useRef(null);
    const chatInputRef = useRef(null);
    const fileInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const loadingTimeoutRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const isInitialLoadDone = useRef(false);

    // --- Memoized Values ---
    const authAxios = useMemo(() => createAuthAxios(), []);

    // --- Effects ---

    // Initial Log & Cleanup Setup
    useEffect(() => {
        log.debug("EmbeddedChat mounted for recipient:", recipient?.nickname);

        // Cleanup function runs on unmount
        return () => {
            log.debug("EmbeddedChat unmounted");
            // Clear all timeouts
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        };
    }, [recipientId, recipient?.nickname]);

    // Update Local Messages (Merge hook messages and local system messages)
    useEffect(() => {
        // Combine messages from the hook with locally generated system messages
        const combined = [...(hookMessages || [])];
        const localSystemMessages = localMessages.filter(msg => msg.type === 'system' && msg.id?.startsWith('local-'));

        // Add local messages if they aren't already present (by ID)
        localSystemMessages.forEach(localMsg => {
            if (!combined.some(msg => msg.id === localMsg.id)) {
                combined.push(localMsg);
            }
        });

        // Sort all messages by date to ensure correct chronological order
        combined.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        // Filter out duplicates based on ID, preferring non-local if IDs clash
        const uniqueMessages = [];
        const seenIds = new Set();
        for (let i = combined.length - 1; i >= 0; i--) {
            const msg = combined[i];
            const id = msg.id || msg.tempId;
            if (id && !seenIds.has(id)) {
                 // Basic validation and normalization
                const normalizedMsg = {
                    ...msg,
                    id: id,
                    sender: msg.sender || "unknown",
                    content: msg.content ?? "", // Ensure content is not null/undefined
                    createdAt: msg.createdAt || new Date().toISOString(),
                    type: msg.type || "text"
                };
                uniqueMessages.unshift(normalizedMsg); // Add to beginning to maintain order
                seenIds.add(id);
            }
        }

        // Only update state if messages actually changed
        if (JSON.stringify(uniqueMessages) !== JSON.stringify(localMessages)) {
             setLocalMessages(uniqueMessages);
        }
    }, [hookMessages, localMessages]);

    // Scroll Management Effect
    useEffect(() => {
        const messagesEndEl = messagesEndRef.current;
        const containerEl = messagesContainerRef.current;

        // Exit if refs aren't ready or chat isn't open
        if (!messagesEndEl || !containerEl || !isOpen) {
            if (!isOpen) {
                isInitialLoadDone.current = false;
            }
            return;
        }

        // Perform initial instant scroll
        if (initialized && localMessages.length > 0 && !isInitialLoadDone.current) {
            messagesEndEl.scrollIntoView({ behavior: 'instant', block: 'end' });
            isInitialLoadDone.current = true;
        }
        // Handle smooth scrolling for subsequent messages ONLY if user is near the bottom
        else if (isInitialLoadDone.current && localMessages.length > 0) {
            const scrollThreshold = 150;
            const isNearBottom = containerEl.scrollHeight - containerEl.scrollTop - containerEl.clientHeight < scrollThreshold;

            if (isNearBottom) {
                const timerId = setTimeout(() => {
                    messagesEndEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }, SMOOTH_SCROLL_DEBOUNCE_MS);

                return () => clearTimeout(timerId);
            }
        }
        // Reset if chat becomes uninitialized
        else if (!initialized) {
            isInitialLoadDone.current = false;
        }
    }, [localMessages, initialized, isOpen]);

    // Loading Timeout Management
    useEffect(() => {
        if (hookLoading) {
            setLoadingTimedOut(false);
            // Set a timeout to show the "taking longer" message
            loadingTimeoutRef.current = setTimeout(() => {
                setLoadingTimedOut(true);
            }, LOADING_TIMEOUT_MS);
        } else {
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
            }
            setLoadingTimedOut(false);
        }

        return () => {
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
            }
        };
    }, [hookLoading]);

    // Check Pending Photo Requests from this recipient
    const checkPendingPhotoRequests = useCallback(async () => {
        if (!recipientId || !user?.id) return;
        try {
            const response = await authAxios.get(`/api/users/photos/permissions`, {
                params: { requestedBy: recipientId, status: "pending" },
            });
            if (response.data?.success) {
                const requests = response.data.data || [];
                setPendingPhotoRequests(requests.length);
                setRequestsData(requests);
            } else {
                setPendingPhotoRequests(0);
                setRequestsData([]);
            }
        } catch (error) {
            log.error("Error checking photo permissions:", error);
            setPendingPhotoRequests(0);
            setRequestsData([]);
        }
    }, [authAxios, recipientId, user?.id]);

    // Run photo request check when chat opens or recipient changes
    useEffect(() => {
        if (isOpen && recipientId && user?.id) {
            checkPendingPhotoRequests();
        }
    }, [isOpen, recipientId, user?.id, checkPendingPhotoRequests]);

    // Focus Input on Open
    useEffect(() => {
        if (isOpen && recipientId && !isCallActive) {
            setTimeout(() => {
                chatInputRef.current?.focus();
            }, INPUT_FOCUS_DELAY_MS);
        }
    }, [isOpen, recipientId, isCallActive]);

    // Socket Event Listeners (Video Calls)
    useEffect(() => {
        if (!isOpen || !recipientId || !user?.id || !socketService) return;

        // Helper to add system messages to the local state
        const addSystemMessage = (content, error = false) => {
            const newMessage = {
                id: generateLocalUniqueId('system'),
                sender: "system",
                content,
                createdAt: new Date().toISOString(),
                type: "system",
                error: error,
            };
             setLocalMessages((prev) => {
                if (prev.some(msg => msg.id === newMessage.id)) return prev;
                const updated = [...prev, newMessage];
                updated.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                return updated;
             });
        };

        // Handler for incoming call events
        const handleIncomingCall = (call) => {
            if (call.userId !== recipientId) return;
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
            addSystemMessage(`${recipient?.nickname || 'User'} accepted your call.`);
            setIsCallActive(true);
            setIncomingCall(null);
            toast.success(`${recipient?.nickname} accepted your call`);
        };

        // Handler for when the other user declines our call or we decline theirs
        const handleCallDeclined = (data) => {
            if (data.userId !== recipientId) return;
            addSystemMessage(`${recipient?.nickname || 'User'} declined your call.`);
            if (isCallActive) setIsCallActive(false);
            setIncomingCall(null);
            toast.info(`${recipient?.nickname} declined your call`);
        };

        // Handler for when either user hangs up
        const handleCallHangup = (data) => {
             if (data.userId === recipientId || data.userId === user.id) {
                if (isCallActive) {
                    addSystemMessage(`Video call with ${recipient?.nickname} ended.`);
                    setIsCallActive(false);
                    setIncomingCall(null);
                    toast.info("Video call ended");
                }
                else if (incomingCall && incomingCall.callerId === recipientId) {
                    addSystemMessage(`${recipient?.nickname} ended the call attempt.`);
                    setIncomingCall(null);
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

        // Cleanup: Unregister listeners
        return () => {
            listeners.forEach(unsubscribe => unsubscribe && unsubscribe());
        };
    }, [isOpen, recipientId, recipient?.nickname, user?.id, isCallActive, incomingCall]);

    // --- Event Handlers ---

    // Adds a system message locally
    const addLocalSystemMessage = useCallback((content, error = false) => {
        const newMessage = {
            id: generateLocalUniqueId('system'),
            sender: "system",
            content,
            createdAt: new Date().toISOString(),
            type: "system",
            error: error,
        };
        setLocalMessages(prev => {
            if (prev.some(msg => msg.id === newMessage.id)) return prev;
             const updated = [...prev, newMessage];
             updated.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
             return updated;
        });
    }, []);

    // Handler to approve all pending photo requests from the recipient
    const handleApproveAllRequests = useCallback(async (e) => {
        if (e) e.stopPropagation();
        if (pendingPhotoRequests === 0 || !recipientId) return;

        setIsApprovingRequests(true);
        try {
            const response = await authAxios.post(`/api/users/photos/approve-all`, {
                requesterId: recipientId,
            });

            if (response.data?.success) {
                const approvedCount = response.data.approvedCount || pendingPhotoRequests;
                toast.success(`Approved ${approvedCount} photo request${approvedCount !== 1 ? "s" : ""}`);
                addLocalSystemMessage(`Photo access approved.`);

                if (hookSendMessage && user?.accountTier !== 'FREE') {
                    await hookSendMessage("I've approved your request to view my private photos.", 'text');
                }

                setPendingPhotoRequests(0);
                setRequestsData([]);
            } else {
                 throw new Error(response.data?.message || "Approval failed");
            }
        } catch (error) {
            log.error("Error approving photo requests:", error);
            toast.error(`Error approving requests: ${error.message}. Please try again.`);
            addLocalSystemMessage("Failed to approve photo requests.", true);
        } finally {
            setIsApprovingRequests(false);
        }
    }, [authAxios, recipientId, pendingPhotoRequests, hookSendMessage, user?.accountTier, addLocalSystemMessage]);

    // Handler for changes in the message input field
    const handleInputChange = useCallback((e) => {
        const value = e.target.value;
        setNewMessage(value);

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        if (value.trim() && recipientId && sendTyping && isConnected) {
            typingTimeoutRef.current = setTimeout(() => {
                sendTyping();
            }, TYPING_DEBOUNCE_MS);
        }
    }, [recipientId, sendTyping, isConnected]);

    // Internal helper function to handle sending logic
    const sendMessageInternal = useCallback(async (content, type = 'text', metadata = null) => {
        if (!initialized) {
            toast.error("Chat not ready. Please wait.");
            return false;
        }
        if (!isConnected) {
            toast.error("No connection. Cannot send message.");
             addLocalSystemMessage("Message failed: No connection.", true);
            return false;
        }
        if (!recipientId) {
            toast.error("Recipient not defined.");
            return false;
        }

        try {
            if (type === 'file' && hookSendFileMessage && metadata?.file) {
                await hookSendFileMessage(metadata.file, recipientId);
            }
            else if (hookSendMessage) {
                await hookSendMessage(content, type, metadata);
            } else {
                throw new Error("Send message function is not available.");
            }
            return true;
        } catch (err) {
            log.error(`Failed to send ${type} message:`, err);
            toast.error(err.message || `Failed to send ${type}.`);
            addLocalSystemMessage(`Failed to send ${type === 'file' ? 'file' : 'message'}.`, true);
            return false;
        }
    }, [initialized, isConnected, recipientId, hookSendMessage, hookSendFileMessage, addLocalSystemMessage]);

    // Handler for sending the selected file attachment
    const handleSendAttachment = useCallback(async () => {
        if (!attachment || !recipientId || isUploading || sendingMessage) return;

        if (user?.accountTier === 'FREE') {
            toast.error("Upgrade to send files.");
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        const progressInterval = setInterval(() => {
            setUploadProgress(prev => Math.min(prev + 10, 95));
        }, 200);

        try {
            const fileMetadata = {
                fileName: attachment.name,
                fileSize: attachment.size,
                fileType: attachment.type,
                file: attachment
            };

            const success = await sendMessageInternal(
                `File: ${attachment.name}`,
                'file',
                fileMetadata
             );

             if (success) {
                 toast.success("File sent successfully!");
                 setAttachment(null);
                 if (fileInputRef.current) fileInputRef.current.value = "";
            } else {
                 toast.error("File upload failed. Please try again.");
                 setAttachment(null);
                 if (fileInputRef.current) fileInputRef.current.value = "";
            }
         } catch (error) {
            setAttachment(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
         } finally {
            clearInterval(progressInterval);
            setUploadProgress(100);
            setTimeout(() => {
                 setIsUploading(false);
                 setUploadProgress(0);
             }, 500);
         }
    }, [attachment, recipientId, isUploading, sendingMessage, user?.accountTier, sendMessageInternal]);

    // Handler for sending text messages
    const handleSendMessage = useCallback(async (e) => {
        if (e) e.preventDefault();

        if (attachment) {
            await handleSendAttachment();
            return;
        }

        const messageToSend = newMessage.trim();
        if (!messageToSend || sendingMessage || !recipientId) {
            return;
        }

        if (user?.accountTier === "FREE" && messageToSend !== "😉") {
            toast.error("Free accounts can only send winks 😉. Upgrade to send messages.");
            return;
        }

        setNewMessage("");

        const success = await sendMessageInternal(messageToSend, 'text');

        if (success) {
            chatInputRef.current?.focus();
        } else {
            setNewMessage(messageToSend);
        }
    }, [newMessage, attachment, sendingMessage, recipientId, user?.accountTier, sendMessageInternal, handleSendAttachment]);

    // Handler for sending a wink
    const handleSendWink = useCallback(async () => {
        if (sendingMessage || !recipientId) return;
        await sendMessageInternal("😉", 'wink');
    }, [sendingMessage, recipientId, sendMessageInternal]);

    // Handler for clicking the attachment icon
    const handleFileAttachmentClick = useCallback(() => {
        if (user?.accountTier === "FREE") {
            toast.error("Free accounts cannot send files. Upgrade to enable.");
            return;
        }
        fileInputRef.current?.click();
    }, [user?.accountTier]);

    // Handler for when a file is selected
    const handleFileChange = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_FILE_SIZE) {
            toast.error(`File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
            e.target.value = null;
            return;
        }

        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            toast.error("File type not supported.");
            e.target.value = null;
            return;
        }

        setAttachment(file);
        setNewMessage("");
        toast.info(`Selected file: ${file.name}. Click send.`);
        e.target.value = null;
    }, []);

    // Handler for removing attachment
    const handleRemoveAttachment = useCallback(() => {
        setAttachment(null);
        setUploadProgress(0);
        setIsUploading(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        chatInputRef.current?.focus();
    }, []);

    // Handler for clicking an emoji
    const handleEmojiClick = useCallback((emoji) => {
        setNewMessage((prev) => prev + emoji);
        setShowEmojis(false);
        chatInputRef.current?.focus();
    }, []);

    // Handler for Enter key press
    const handleKeyPress = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }, [handleSendMessage]);

    // Handler to initiate a video call
    const handleVideoCall = useCallback(async (e) => {
        if (e) e.stopPropagation();

        if (!socketService || !socketService.isConnected()) {
            addLocalSystemMessage("Cannot start call: Connection issue.", true);
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
        try {
            await socketService.initiateVideoCall(recipientId);
            setIsCallActive(true);
            addLocalSystemMessage(`Calling ${recipient.nickname}... Waiting for response.`);
        } catch (error) {
            log.error("Video call initiation error:", error);
            addLocalSystemMessage(error.message || "Could not start video call.", true);
            setIsCallActive(false);
        }
    }, [recipient, recipientId, user?.accountTier, addLocalSystemMessage]);

    // Handler to end the current video call
    const handleEndCall = useCallback((e) => {
        if (e) e.stopPropagation();
        if (isCallActive && recipientId && socketService) {
            socketService.emit("videoHangup", { recipientId: recipientId });
        }
        setIsCallActive(false);
        setIncomingCall(null);
        addLocalSystemMessage(`Video call ended.`);
    }, [isCallActive, recipientId, addLocalSystemMessage]);

    // Handler to accept an incoming call
    const handleAcceptCall = useCallback(() => {
        if (!incomingCall || !socketService) return;
        socketService.answerVideoCall(incomingCall.callerId, true, incomingCall.callId);
        addLocalSystemMessage(`Accepted call from ${incomingCall.callerName}.`);
        setIsCallActive(true);
        setIncomingCall(null);
    }, [incomingCall, addLocalSystemMessage]);

    // Handler to decline an incoming call
    const handleDeclineCall = useCallback(() => {
        if (!incomingCall || !socketService) return;
        socketService.answerVideoCall(incomingCall.callerId, false, incomingCall.callId);
        addLocalSystemMessage(`Declined call from ${incomingCall.callerName}.`);
        setIncomingCall(null);
    }, [incomingCall, addLocalSystemMessage]);

    // Handler to retry loading messages
    const handleRetryLoad = useCallback(() => {
        setLoadingTimedOut(false);
        refreshChat();
    }, [refreshChat]);

    // Handler to attempt reconnection
    const handleReconnect = useCallback(() => {
        toast.info("Attempting to reconnect...");
        if (socketService && socketService.reconnect) {
            socketService.reconnect();
        }
        setTimeout(() => {
            refreshChat();
        }, RECONNECT_DELAY_MS);
    }, [refreshChat]);

    // Handler for re-initialization
    const handleForceInit = useCallback(() => {
        toast.info("Attempting to re-initialize chat...");
        handleReconnect();
    }, [handleReconnect]);

    // --- Render Logic ---

    if (!isOpen) {
        return null;
    }

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

    const isActionDisabled = isUploading || sendingMessage;

    return (
        <div className={`${styles.chatContainer} ${styles.opening}`}>
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

            {user?.accountTier === "FREE" && <PremiumBanner navigate={navigate} />}

            <CallBanners
                incomingCall={incomingCall}
                isCallActive={isCallActive}
                recipientNickname={recipient.nickname}
                handleAcceptCall={handleAcceptCall}
                handleDeclineCall={handleDeclineCall}
                handleEndCall={handleEndCall}
            />

            <div className={styles.messagesContainer} ref={messagesContainerRef}>
                {hookLoading && !localMessages.length ? (
                    <LoadingIndicator
                        showTimeoutMessage={loadingTimedOut}
                        handleRetry={handleRetryLoad}
                        handleReconnect={handleReconnect}
                    />
                ) : hookError ? (
                    <ErrorMessage
                        error={hookError}
                        handleRetry={handleRetryLoad}
                        handleForceInit={handleForceInit}
                        showInitButton={!initialized}
                    />
                ) : !initialized || (!isConnected && !localMessages.length) ? (
                    <ConnectionIssueMessage
                        handleReconnect={handleReconnect}
                        isInitializing={!initialized}
                    />
                ) : localMessages.length === 0 && !hookLoading ? (
                    <div className={styles.noMessages}>
                        <p>No messages yet. Say hello!</p>
                    </div>
                ) : (
                    <MessageList
                        messages={localMessages}
                        currentUserId={user?.id}
                        typingStatus={typingStatus}
                        hasMore={hasMore}
                        loadMoreMessages={loadMoreMessages}
                    />
                )}
                <div ref={messagesEndRef} />
            </div>

            {attachment && !isUploading && (
                <AttachmentPreview
                    attachment={attachment}
                    isUploading={false}
                    uploadProgress={uploadProgress}
                    handleRemoveAttachment={handleRemoveAttachment}
                />
            )}

            {isUploading && (
                <div className={styles.uploadProgressContainer} style={{ margin: '5px 10px' }}>
                    <div className={styles.uploadProgressBar} style={{ width: `${uploadProgress}%` }} />
                    <span className={styles.uploadProgressText}>{`Uploading ${uploadProgress}%`}</span>
                </div>
            )}

            <ChatInput
                newMessage={newMessage}
                handleInputChange={handleInputChange}
                handleKeyPress={handleKeyPress}
                chatInputRef={chatInputRef}
                showEmojis={showEmojis}
                setShowEmojis={setShowEmojis}
                handleEmojiClick={handleEmojiClick}
                handleFileAttachment={handleFileAttachmentClick}
                handleSendWink={handleSendWink}
                handleSubmit={handleSendMessage}
                isSending={sendingMessage}
                isUploading={isUploading}
                userTier={user?.accountTier}
                attachment={attachment}
            />

            <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleFileChange}
                aria-hidden="true"
                accept={ALLOWED_FILE_TYPES.join(",")}
            />

            {isCallActive && recipientId && user?.id && (
                <div className={`${styles.videoCallOverlay} ${styles.active}`}>
                    <VideoCall
                        isActive={isCallActive}
                        userId={user.id}
                        recipientId={recipientId}
                        onEndCall={handleEndCall}
                        isIncoming={!!incomingCall && !isCallActive}
                        callId={incomingCall?.callId}
                    />
                </div>
            )}
        </div>
    );
};

// Prop Types
EmbeddedChat.propTypes = {
    recipient: PropTypes.shape({
        id: PropTypes.string.isRequired,
        nickname: PropTypes.string.isRequired,
        isOnline: PropTypes.bool,
        photos: PropTypes.arrayOf(PropTypes.shape({ url: PropTypes.string }))
    }),
    isOpen: PropTypes.bool,
    onClose: PropTypes.func,
};

// Default Props
EmbeddedChat.defaultProps = {
  isOpen: true,
  onClose: () => {},
  recipient: null,
};

export default EmbeddedChat;
