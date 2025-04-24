// src/components/EmbeddedChat.jsx

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import PropTypes from 'prop-types';
import {
    FaVideo, FaSpinner, FaLock, FaPhoneSlash, FaTimes, FaExclamationCircle
} from "react-icons/fa"; import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

// --- Framework/Context Hooks ---
import { useAuth } from "../context/AuthContext.jsx"; //
import { useChat } from "../hooks/useChat.js"; // Assuming useChat is primarily for single-chat logic

// --- Shared Chat Components & Utils ---
// Assuming these files exist in src/components/chat/
import {
    MAX_FILE_SIZE,
    ALLOWED_FILE_TYPES,
    ACCOUNT_TIER,
    LOADING_TIMEOUT_MS,
    RECONNECT_DELAY_MS,
    INPUT_FOCUS_DELAY_MS,
    TYPING_DEBOUNCE_MS,
    SMOOTH_SCROLL_DEBOUNCE_MS,
    UPLOAD_COMPLETE_DELAY_MS
} from "./chat/chatConstants.js";
import {
    generateLocalUniqueId,
    createAuthAxios,
    formatMessageDateSeparator,
    groupMessagesByDate,
    classNames
} from "./chat/chatUtils.jsx"; // Renamed to .jsx previously
import MessageItem from "./chat/MessageItem.jsx";
import ChatInput from "./chat/ChatInput.jsx";
import AttachmentPreview from "./chat/AttachmentPreview.jsx";
import CallBanners from "./chat/CallBanners.jsx";
import PremiumBanner from "./chat/PremiumBanner.jsx";
import { LoadingIndicator, ErrorMessage, ConnectionIssueMessage, NoMessagesPlaceholder } from "./chat/ChatStatusIndicators.jsx";

// --- Other Imports ---
import { logger } from "../utils/logger.js"; //
import socketService from "../services/socketService.jsx"; // or .js depending on your file
import VideoCall from "./VideoCall.jsx"; // Keep specific components like VideoCall if not shared

// --- Styles ---
import styles from "../styles/embedded-chat.module.css";

// --- Logger ---
const log = logger.create("EmbeddedChat");

// --- Locally Defined Components for EmbeddedChat Specifics ---
// ChatHeader remains local as its actions are specific to this component context
const EmbeddedChatHeader = React.memo(({
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
                    title={`Approve ${pendingPhotoRequests} photo request(s)`}
                    aria-label="Approve photo requests"
                    disabled={isApprovingRequests}
                >
                    {isApprovingRequests ? <FaSpinner className="fa-spin" /> : <FaLock />}
                </button>
            )}
            {userTier !== ACCOUNT_TIER.FREE && (
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
EmbeddedChatHeader.displayName = 'EmbeddedChatHeader';

// --- Main Component ---
const EmbeddedChat = ({ recipient, isOpen = true, onClose = () => {} }) => {
    // --- Hooks ---
    const { user } = useAuth(); //
    const navigate = useNavigate();
    const recipientId = recipient?._id;

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
        sending: sendingMessage, // State indicating if a message is currently being sent via hook
        initialized,
        isConnected,
        refresh: refreshChat,
    } = useChat(recipientId); //

    // --- State ---
    const [localMessages, setLocalMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [attachment, setAttachment] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [pendingPhotoRequests, setPendingPhotoRequests] = useState(0);
    const [isApprovingRequests, setIsApprovingRequests] = useState(false);
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
    const groupedMessages = useMemo(() => groupMessagesByDate(localMessages), [localMessages]);
    const currentUserId = user?._id; // Get current user ID safely

    // --- Event Handlers ---

    // Define addLocalSystemMessage *before* the useEffect that uses it
    const addLocalSystemMessage = useCallback((content, error = false) => {
        const newSysMessage = {
            _id: generateLocalUniqueId('system'),
            sender: "system",
            content,
            createdAt: new Date().toISOString(),
            type: "system",
            error,
        };
        setLocalMessages(prev => {
            if (prev.some(msg => msg._id === newSysMessage._id)) return prev;
            return [...prev, newSysMessage].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });
    }, []); // Empty dependency array is likely correct here as setLocalMessages is stable


    // --- Effects ---

    // Initial Log & Cleanup
    useEffect(() => {
        log.debug("EmbeddedChat mounted for recipient:", recipient?.nickname);
        return () => {
            log.debug("EmbeddedChat unmounted");
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        };
    }, [recipientId, recipient?.nickname]);

    // Merge Hook Messages with Local System Messages
    useEffect(() => {
        // Only proceed if hookMessages changed
        if (!hookMessages) return;
        
        // Get all system messages from localMessages
        const localSystem = localMessages.filter(msg => msg.type === 'system' && msg._id?.startsWith('local-'));
        
        // Combine hookMessages with local system messages
        const combined = [...hookMessages];
        
        // Add only system messages that aren't already in the combined array
        localSystem.forEach(localMsg => {
            if (!combined.some(msg => msg._id === localMsg._id)) {
                combined.push(localMsg);
            }
        });
        
        // Sort combined messages by date
        combined.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        // Deduplicate messages with enhanced detection
        const uniqueMessages = [];
        const seenIds = new Set();
        const seenCombinations = new Set(); // Detect duplicates even with different IDs
        
        combined.forEach(msg => {
            const id = msg._id || msg.tempId;
            
            // Create a compound key to detect duplicates based on sender, time, content & type
            const timeStr = msg.createdAt?.substring(0, 19) || ''; // Ignore milliseconds precision
            const contentKey = (msg.content || '').substring(0, 50); // First 50 chars
            const combinationKey = `${msg.sender}-${timeStr}-${contentKey}-${msg.type}`;
            
            // Only add the message if we haven't seen its ID or a duplicate pattern
            if (id && !seenIds.has(id) && !seenCombinations.has(combinationKey)) {
                // Normalize the message object with all required fields
                const normalizedMsg = {
                    _id: msg._id, 
                    tempId: msg.tempId, 
                    sender: msg.sender || "system",
                    recipient: msg.recipient, 
                    content: msg.content ?? "",
                    createdAt: msg.createdAt || new Date().toISOString(),
                    type: msg.type || "text", 
                    read: msg.read ?? false,
                    pending: msg.pending ?? (!!msg.tempId), 
                    error: msg.error ?? false,
                    metadata: msg.metadata
                };
                uniqueMessages.push(normalizedMsg);
                if (id) seenIds.add(id);
                seenCombinations.add(combinationKey);
            } else if (!id) {
                log.warn("Message without ID or tempId encountered:", msg);
            } else {
                log.debug("Filtered out duplicate message:", id, msg.content);
            }
        });

        // Update localMessages only if the content actually changed
        if (uniqueMessages.length !== localMessages.length || 
            JSON.stringify(uniqueMessages.map(m => m._id)) !== JSON.stringify(localMessages.map(m => m._id))) {
            console.log(`Updating messages: ${uniqueMessages.length} unique of ${combined.length} total`);
            setLocalMessages(uniqueMessages);
        }
    }, [hookMessages, localMessages]); // Include localMessages to detect actual changes

    // Scroll Management
    useEffect(() => {
        const messagesEndEl = messagesEndRef.current;
        const containerEl = messagesContainerRef.current;
        if (!messagesEndEl || !containerEl || !isOpen) {
            isInitialLoadDone.current = !isOpen; return;
        }
        if (initialized && localMessages.length > 0 && !isInitialLoadDone.current) {
            messagesEndEl.scrollIntoView({ behavior: 'instant', block: 'end' });
            isInitialLoadDone.current = true;
        } else if (isInitialLoadDone.current && localMessages.length > 0) {
            const scrollThreshold = 150;
            const isNearBottom = containerEl.scrollHeight - containerEl.scrollTop - containerEl.clientHeight < scrollThreshold;
            if (isNearBottom) {
                const timerId = setTimeout(() => {
                    messagesEndEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }, SMOOTH_SCROLL_DEBOUNCE_MS);
                return () => clearTimeout(timerId);
            }
        } else if (!initialized) {
            isInitialLoadDone.current = false;
        }
    }, [localMessages, initialized, isOpen]);

    // Loading Timeout
    useEffect(() => {
        if (hookLoading) {
            setLoadingTimedOut(false);
            loadingTimeoutRef.current = setTimeout(() => setLoadingTimedOut(true), LOADING_TIMEOUT_MS);
        } else {
            if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
            setLoadingTimedOut(false);
        }
        return () => { if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current); };
    }, [hookLoading]);

    // Check Pending Photo Requests
    const checkPendingPhotoRequests = useCallback(async () => {
        if (!recipientId || !user?._id || !authAxios) return;
        try {
            const response = await authAxios.get(`/api/users/photos/permissions`, {
                params: { requestedBy: recipientId, status: "pending" },
            });
            const requests = response?.data?.data || [];
            setPendingPhotoRequests(requests.length);
        } catch (error) {
            log.error("Error checking photo permissions:", error.response?.data || error.message);
            setPendingPhotoRequests(0);
        }
    }, [authAxios, recipientId, user?._id]);

    // Run photo request check
    useEffect(() => {
        if (isOpen && recipientId && user?._id) {
            checkPendingPhotoRequests();
        }
    }, [isOpen, recipientId, user?._id, checkPendingPhotoRequests]);

    // Focus Input on Open/Active
    useEffect(() => {
        if (isOpen && recipientId && !isCallActive && initialized) {
            const timerId = setTimeout(() => chatInputRef.current?.focus(), INPUT_FOCUS_DELAY_MS);
            return () => clearTimeout(timerId);
        }
    }, [isOpen, recipientId, isCallActive, initialized]);

    // Socket Event Listeners (Video Calls)
    useEffect(() => {
        if (!isOpen || !recipientId || !user?._id || !socketService) return;

        const handleIncoming = (call) => {
            if (call.userId !== recipientId) return;
            log.debug("Incoming call:", call);
            setIncomingCall({ callId: call.callId, callerName: call.caller?.name || recipient?.nickname || "Unknown", callerId: call.userId });
            addLocalSystemMessage(`${recipient?.nickname || 'Someone'} is calling you.`);
        };
        const handleAccepted = (data) => {
             if (data.userId !== recipientId) return;
             log.debug("Call accepted:", data);
            if (!incomingCall) {
                 addLocalSystemMessage(`${recipient?.nickname || 'User'} accepted your call.`);
                 setIsCallActive(true);
                 setIncomingCall(null);
                 toast.success(`${recipient?.nickname} accepted your call`);
            }
        };
        const handleDeclined = (data) => {
            if (data.userId !== recipientId) return;
            log.debug("Call declined:", data);
            if (isCallActive && !incomingCall) {
                 addLocalSystemMessage(`${recipient?.nickname || 'User'} declined your call.`);
                 setIsCallActive(false);
            } else if (incomingCall && incomingCall.callerId === recipientId) {
                 addLocalSystemMessage(`Call from ${recipient?.nickname} was declined/cancelled.`);
                 setIncomingCall(null);
            }
            toast.info(`${recipient?.nickname} declined the call`);
        };
        const handleHangup = (data) => {
            if (data.userId === recipientId || data.userId === user._id) {
                log.debug("Hangup received:", data);
                if (isCallActive) {
                    addLocalSystemMessage(`Video call ended.`);
                    setIsCallActive(false); // Ensure state is updated
                }
                if (incomingCall && incomingCall.callerId === data.userId) {
                     addLocalSystemMessage(`Call attempt from ${recipient?.nickname} ended.`);
                    setIncomingCall(null); // Ensure state is updated
                }
                 if (isCallActive || incomingCall) toast.info("Video call ended"); // Show toast only if relevant
                 // Reset states definitively on hangup involving participants
                 setIsCallActive(false);
                 setIncomingCall(null);
            }
        };

        const listeners = [
            socketService.on("incomingCall", handleIncoming),
            socketService.on("callAccepted", handleAccepted),
            socketService.on("callDeclined", handleDeclined),
            socketService.on("videoHangup", handleHangup),
        ];
        return () => listeners.forEach(unsubscribe => unsubscribe?.());

    }, [isOpen, recipientId, recipient?.nickname, user?._id, isCallActive, incomingCall, addLocalSystemMessage]); // addLocalSystemMessage is now stable


    // --- Component Logic Handlers ---

    // Approve Photo Requests
    const handleApproveAllRequests = useCallback(async (e) => {
        e?.stopPropagation();
        if (pendingPhotoRequests === 0 || !recipientId || isApprovingRequests) return;
        setIsApprovingRequests(true);
        try {
            const response = await authAxios.post(`/api/users/photos/approve-all`, { requesterId: recipientId });
            if (response.data?.success) {
                const count = response.data.approvedCount || pendingPhotoRequests;
                toast.success(`Approved ${count} photo request${count !== 1 ? "s" : ""}.`);
                addLocalSystemMessage(`Photo access approved for ${recipient?.nickname || 'user'}.`);
                setPendingPhotoRequests(0);
                if (hookSendMessage && user?.accountTier !== ACCOUNT_TIER.FREE) {
                   hookSendMessage("I've approved your request to view my private photos.", 'text');
                }
            } else { throw new Error(response.data?.message || "Approval failed"); }
        } catch (error) {
            log.error("Error approving photo requests:", error);
            toast.error(`Error approving requests: ${error.message || "Please try again."}`);
            addLocalSystemMessage("Failed to approve photo requests.", true);
        } finally { setIsApprovingRequests(false); }
    }, [authAxios, recipientId, pendingPhotoRequests, isApprovingRequests, user?.accountTier, hookSendMessage, addLocalSystemMessage, recipient?.nickname]);

    // Input Change
    const handleInputChange = useCallback((e) => {
        const value = e.target.value;
        setNewMessage(value);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (value.trim() && recipientId && sendTyping && isConnected) {
            typingTimeoutRef.current = setTimeout(sendTyping, TYPING_DEBOUNCE_MS);
        }
    }, [recipientId, sendTyping, isConnected]);

    // Send Message Core Logic
    const sendMessageWrapper = useCallback(async (contentOrFile, type = 'text') => {
         if (!initialized || !isConnected || !recipientId || !/^[0-9a-fA-F]{24}$/.test(recipientId)) {
             toast.error("Cannot send message. Chat not ready or recipient invalid.");
             log.warn("sendMessageWrapper pre-condition failed.", { initialized, isConnected, recipientId });
             if (!isConnected) addLocalSystemMessage("Message failed: No connection.", true);
             return false;
         }
         const isFileType = type === 'file' && contentOrFile instanceof File;
         const sendFunction = isFileType ? hookSendFileMessage : hookSendMessage;
         if (!sendFunction) {
             log.error(`Send function not available for type: ${type}`); toast.error(`Cannot send ${type} message.`); return false;
         }

         let tempId = null; // For potential optimistic update tracking
         try {
             // --- Optimistic Update ---
             if (type === 'text' && typeof contentOrFile === 'string') {
                 tempId = generateLocalUniqueId('msg');
                 const optimisticMessage = { /* ... as before ... */ };
                 // setLocalMessages(prev => [...prev, optimisticMessage].sort(...)); // Add optimistic message
             } // Add similar logic for file/wink if desired

             // --- Actual Send ---
             if (isFileType) { await sendFunction(contentOrFile, recipientId); }
             else { await sendFunction(contentOrFile, type); }
             log.debug(`${type} message sent/initiated.`); return true;
         } catch (err) {
             log.error(`Failed to send ${type} message:`, err); toast.error(err.message || `Failed to send ${type}.`);
             addLocalSystemMessage(`Failed to send ${type === 'file' ? 'file' : 'message'}.`, true);
             // --- Revert Optimistic Update ---
             if (tempId) { /* ... logic to remove or mark message as error ... */ }
             return false;
         }
    }, [initialized, isConnected, recipientId, hookSendMessage, hookSendFileMessage, addLocalSystemMessage, user?._id]); // Added user?._id for optimistic sender

    // Combined Submit Handler
    const handleSubmitMessage = useCallback(async () => {
        if (attachment) {
            if (!attachment || isUploading || sendingMessage || user?.accountTier === ACCOUNT_TIER.FREE) {
                 if(user?.accountTier === ACCOUNT_TIER.FREE) toast.error("Upgrade to Premium to send files.");
                 return;
            }
            setIsUploading(true); setUploadProgress(0);
            const uploadInterval = setInterval(() => setUploadProgress(p => Math.min(p + 10, 90)), 200);
            const success = await sendMessageWrapper(attachment, 'file');
            clearInterval(uploadInterval);
            if (success) {
                 setUploadProgress(100);
                 setTimeout(() => { setAttachment(null); setIsUploading(false); setUploadProgress(0); if (fileInputRef.current) fileInputRef.current.value = ""; }, UPLOAD_COMPLETE_DELAY_MS);
            } else { setIsUploading(false); setUploadProgress(0); toast.error("File upload failed."); }
        } else {
            const messageToSend = newMessage.trim();
            if (!messageToSend || sendingMessage || isUploading) return;
            if (user?.accountTier === ACCOUNT_TIER.FREE && messageToSend !== "😉") { toast.error("Free accounts can only send winks 😉."); return; }
            setNewMessage("");
            const success = await sendMessageWrapper(messageToSend, 'text');
            if (success) { chatInputRef.current?.focus(); }
            else { setNewMessage(messageToSend); } // Restore message on failure
        }
    }, [attachment, newMessage, sendingMessage, isUploading, user?.accountTier, sendMessageWrapper]);

    // Send Wink Handler
    const handleSendWink = useCallback(async () => {
        if (sendingMessage || isUploading || !recipientId) return;
        await sendMessageWrapper("😉", 'wink');
    }, [sendingMessage, isUploading, recipientId, sendMessageWrapper]);

    // File Input Trigger
    const handleFileAttachmentClick = useCallback(() => {
        if (user?.accountTier === ACCOUNT_TIER.FREE) { toast.error("Upgrade to Premium to send files."); return; }
        if (!isUploading) { fileInputRef.current?.click(); }
    }, [user?.accountTier, isUploading]);

    // File Selection
    const handleFileChange = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_FILE_SIZE) { toast.error(`File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB.`); e.target.value = null; return; }
        if (!ALLOWED_FILE_TYPES.includes(file.type)) { toast.error(`File type (${file.type || 'unknown'}) not supported.`); e.target.value = null; return; }
        setAttachment(file); setNewMessage(""); setIsUploading(false); setUploadProgress(0);
        toast.info(`Selected: ${file.name}. Click send.`); e.target.value = null;
    }, []);

    // Remove Attachment
    const handleRemoveAttachment = useCallback(() => {
        setAttachment(null); setUploadProgress(0); setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        chatInputRef.current?.focus();
    }, []);

    // Emoji Click
    const handleEmojiClick = useCallback((emoji) => {
        setNewMessage((prev) => prev + emoji);
        setTimeout(() => chatInputRef.current?.focus(), 0);
    }, []);

    // --- Video Call Handlers ---
    const handleVideoCall = useCallback(async (e) => {
        e?.stopPropagation();
        if (!socketService?.isConnected() || !recipient?.isOnline || user?.accountTier === ACCOUNT_TIER.FREE || !recipientId || isCallActive || incomingCall) {
            if(!socketService?.isConnected()) addLocalSystemMessage("Cannot start call: Connection issue.", true);
            else if(!recipient?.isOnline) addLocalSystemMessage(`${recipient.nickname} is offline.`, true);
            else if(user?.accountTier === ACCOUNT_TIER.FREE) addLocalSystemMessage("Upgrade to Premium to make video calls.", true);
            else if(isCallActive || incomingCall) log.warn("Call attempt while call active/incoming.");
            else addLocalSystemMessage("Cannot start call: Invalid state.", true);
            return;
        }
        addLocalSystemMessage(`Initiating call to ${recipient.nickname}...`);
        try {
            await socketService.initiateVideoCall(recipientId);
             addLocalSystemMessage(`Calling ${recipient.nickname}... Waiting...`);
        } catch (error) {
            log.error("Video call initiation error:", error);
            addLocalSystemMessage(error.message || "Could not start video call.", true);
        }
    }, [recipient, recipientId, user?.accountTier, isCallActive, incomingCall, addLocalSystemMessage, isConnected]); // Added isConnected

    const handleEndCall = useCallback((e) => {
        e?.stopPropagation();
        if (isCallActive && recipientId && socketService) {
            log.debug("Ending active call via button.");
            socketService.emit("videoHangup", { recipientId: recipientId });
        }
        addLocalSystemMessage(`Video call ended.`);
        setIsCallActive(false); setIncomingCall(null); // Reset state definitively
    }, [isCallActive, recipientId, addLocalSystemMessage]);

    const handleAcceptCall = useCallback(() => {
        if (!incomingCall || !socketService) return;
         if (user?.accountTier === ACCOUNT_TIER.FREE) {
             toast.error("Upgrade required to receive video calls.");
             socketService.answerVideoCall(incomingCall.callerId, false, incomingCall.callId);
             addLocalSystemMessage(`Declined call from ${incomingCall.callerName} (Upgrade required).`);
             setIncomingCall(null); return;
         }
        log.debug("Accepting call:", incomingCall.callId);
        socketService.answerVideoCall(incomingCall.callerId, true, incomingCall.callId);
        addLocalSystemMessage(`Accepted call from ${incomingCall.callerName}.`);
        setIsCallActive(true); setIncomingCall(null);
    }, [incomingCall, user?.accountTier, addLocalSystemMessage]);

    const handleDeclineCall = useCallback(() => {
        if (!incomingCall || !socketService) return;
        log.debug("Declining call:", incomingCall.callId);
        socketService.answerVideoCall(incomingCall.callerId, false, incomingCall.callId);
        addLocalSystemMessage(`Declined call from ${incomingCall.callerName}.`);
        setIncomingCall(null);
    }, [incomingCall, addLocalSystemMessage]);

    // --- UI Action Handlers ---
    const handleRetryLoad = useCallback(() => { setLoadingTimedOut(false); refreshChat(); }, [refreshChat]);
    const handleReconnect = useCallback(() => { toast.info("Attempting reconnect..."); socketService?.reconnect?.(); setTimeout(refreshChat, RECONNECT_DELAY_MS); }, [refreshChat]);
    const handleForceInit = useCallback(() => { toast.info("Re-initializing chat..."); handleReconnect(); }, [handleReconnect]);

    // --- Render Logic ---
    if (!isOpen) return null;

    if (!recipient) {
        return (
            <div className={classNames(styles.chatContainer, styles.opening)}>
                <LoadingIndicator showTimeoutMessage={false} handleRetry={()=>{}} handleReconnect={()=>{}} />
                <p>Loading recipient...</p>
            </div>
        );
    }

    const isInputAreaDisabled = isCallActive || !!incomingCall || !initialized || !isConnected;
    const isHeaderActionsDisabled = isUploading || sendingMessage || isCallActive || !!incomingCall;

    return (
        <div className={classNames(styles.chatContainer, styles.opening)}>
            <EmbeddedChatHeader
                recipient={recipient}
                userTier={user?.accountTier}
                pendingPhotoRequests={pendingPhotoRequests}
                isApprovingRequests={isApprovingRequests}
                handleApproveAllRequests={handleApproveAllRequests}
                isCallActive={isCallActive}
                handleEndCall={handleEndCall}
                handleVideoCall={handleVideoCall}
                isActionDisabled={isHeaderActionsDisabled}
                onClose={onClose}
                isConnected={isConnected}
            />

            {user?.accountTier === ACCOUNT_TIER.FREE && <PremiumBanner onUpgradeClick={() => navigate("/subscription")} />}

            <CallBanners
                incomingCall={incomingCall}
                isCallActive={isCallActive}
                recipientNickname={recipient.nickname}
                onAcceptCall={handleAcceptCall}
                onDeclineCall={handleDeclineCall}
                onEndCall={handleEndCall}
                useSmallButtons={true} // Embedded chat might use smaller buttons
            />

            <div className={styles.messagesContainer} ref={messagesContainerRef}>
                {/* --- Loading/Error/Empty States --- */}
                {hookLoading && !localMessages.length ? (
                    <LoadingIndicator showTimeoutMessage={loadingTimedOut} handleRetry={handleRetryLoad} handleReconnect={handleReconnect}/>
                ) : hookError ? (
                    <ErrorMessage error={hookError} handleRetry={handleRetryLoad} handleForceInit={handleForceInit} showInitButton={!initialized}/>
                ) : !initialized || (!isConnected && !localMessages.length) ? (
                    <ConnectionIssueMessage handleReconnect={handleReconnect} isInitializing={!initialized}/>
                ) : localMessages.length === 0 && !hookLoading ? (
                    <NoMessagesPlaceholder text="No messages yet. Say hello!" />
                ) : (
                     // --- Message List Rendering ---
                     <>
                         {hasMore && ( <button onClick={loadMoreMessages} className={styles.loadMoreButton} disabled={hookLoading}>{hookLoading ? "Loading..." : "Load More"}</button> )}
                          {Object.entries(groupedMessages).map(([date, msgs]) => (
                            <React.Fragment key={date}>
                                <div className={styles.messageDate}>{date}</div>
                                {msgs.map((message) => ( <MessageItem key={message._id || message.tempId} message={message} currentUserId={currentUserId} isSending={sendingMessage && message.tempId === message._id }/> ))}
                            </React.Fragment>
                        ))}
                         {typingStatus && ( <div className={styles.typingIndicatorBubble}><div className={styles.typingIndicator}><span></span><span></span><span></span></div></div> )}
                     </>
                )}
                <div ref={messagesEndRef} style={{ height: '1px' }} />
            </div>

            {/* Attachment Preview */}
             <AttachmentPreview 
                attachment={attachment} 
                isUploading={isUploading} 
                uploadProgress={uploadProgress} 
                onRemoveAttachment={handleRemoveAttachment} 
                onFileSelected={handleFileChange}
                showFileInput={false}
                disabled={isInputAreaDisabled}
                userTier={user?.accountTier}
             />

            {/* Chat Input Area */}
            <ChatInput
                messageValue={newMessage}
                onInputChange={handleInputChange}
                onSubmit={handleSubmitMessage}
                onWinkSend={handleSendWink}
                onFileAttachClick={handleFileAttachmentClick}
                onEmojiClick={handleEmojiClick}
                userTier={user?.accountTier}
                isSending={sendingMessage}
                isUploading={isUploading}
                attachmentSelected={!!attachment}
                disabled={isInputAreaDisabled} // Use combined disabled state
                inputRef={chatInputRef}
                placeholderText={ recipient ? `Message ${recipient.nickname}...` : "Type a message..."}
            />
            
            {/* Hidden File Input - Kept separate since it's accessed via ChatInput */}
            <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} accept={ALLOWED_FILE_TYPES.join(",")} aria-hidden="true" />

            {/* Video Call Overlay */}
            {isCallActive && recipientId && currentUserId && (
                <div className={classNames(styles.videoCallOverlay, styles.active)}>
                    <VideoCall isActive={isCallActive} userId={currentUserId} recipientId={recipientId} onEndCall={handleEndCall} isIncoming={false} callId={null}/>
                </div>
            )}
        </div>
    );
};

// --- Prop Types ---
EmbeddedChat.propTypes = {
    recipient: PropTypes.shape({
        _id: PropTypes.string.isRequired,
        nickname: PropTypes.string.isRequired,
        isOnline: PropTypes.bool,
        photos: PropTypes.arrayOf(PropTypes.shape({ url: PropTypes.string }))
    }),
    isOpen: PropTypes.bool,
    onClose: PropTypes.func,
};

// --- Default Props ---
EmbeddedChat.defaultProps = {
  isOpen: true,
  onClose: () => {},
  recipient: null,
};

export default EmbeddedChat;
