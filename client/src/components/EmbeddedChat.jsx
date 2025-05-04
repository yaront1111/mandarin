// src/components/EmbeddedChat.jsx

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import PropTypes from 'prop-types';
import {
    FaVideo, FaSpinner, FaLock, FaPhoneSlash, FaTimes, FaExclamationCircle,
    FaExclamationTriangle, FaEllipsisH, FaUser, FaBan, FaFlag
} from "react-icons/fa"; 
import { toast } from "react-toastify";
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
    formatMessageDateSeparator,
    groupMessagesByDate,
    classNames
} from "./chat/chatUtils.jsx"; // Renamed to .jsx previously
import apiService from "../services/apiService.jsx";
import MessageItem from "./chat/MessageItem.jsx";
import ChatInput from "./chat/ChatInput.jsx";
import AttachmentPreview from "./chat/AttachmentPreview.jsx";
import CallBanners from "./chat/CallBanners.jsx";
import PremiumBanner from "./chat/PremiumBanner.jsx";
import ChatArea from "./chat/ChatArea.jsx";
import ChatHeader from "./chat/ChatHeader.jsx";
import { LoadingIndicator, ErrorMessage, ConnectionIssueMessage, NoMessagesPlaceholder } from "./chat/ChatStatusIndicators.jsx";

// --- Other Imports ---
import { logger } from "../utils/logger.js"; //
import socketService from "../services/socketService.jsx"; // or .js depending on your file
import VideoCall from "./VideoCall.jsx"; // Keep specific components like VideoCall if not shared
import UserProfileModal from "./UserProfileModal.jsx"; // For viewing user profiles

// --- Styles ---
import styles from "../styles/embedded-chat.module.css";

// --- Logger ---
const log = logger.create("EmbeddedChat");

// --- Using shared components instead of local ones now ---

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
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [profileUserId, setProfileUserId] = useState(null);
    const [blockedUsers, setBlockedUsers] = useState(new Set());

    // --- Refs ---
    const messagesEndRef = useRef(null);
    const chatInputRef = useRef(null);
    const fileInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const loadingTimeoutRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const isInitialLoadDone = useRef(false);

    // --- Memoized Values ---
    // Using apiService directly instead of deprecated createAuthAxios
    const groupedMessages = useMemo(() => groupMessagesByDate(localMessages), [localMessages]);
    const currentUserId = user?._id; // Get current user ID safely
    
    // Check if a user is blocked
    const isUserBlocked = useCallback((userId) => {
        // Safety checks to handle potential errors or edge cases
        if (!userId) return false;
        
        // Check both client-side state and server-side state
        const isClientBlocked = blockedUsers.has(userId);
        const isServerBlocked = recipient?.isBlocked || false;
        
        return isClientBlocked || isServerBlocked;
    }, [blockedUsers, recipient?.isBlocked]);

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
    
    // Load blocked users from localStorage and server when component mounts
    useEffect(() => {
        const loadBlockedUsers = async () => {
            // First load from localStorage for immediate UI feedback
            try {
                const blockedList = JSON.parse(localStorage.getItem('mandarin_blocked_users') || '[]');
                
                if (blockedList.length > 0) {
                    log.debug(`Loading ${blockedList.length} blocked users from localStorage`);
                    
                    // Convert array to Set for faster lookups
                    setBlockedUsers(new Set(blockedList));
                    
                    // If the current recipient is in the blocked list, update their status
                    if (recipient?._id && blockedList.includes(recipient._id) && !recipient.isBlocked) {
                        log.debug('Marking current recipient as blocked from localStorage data');
                        recipient.isBlocked = true;
                    }
                }
            } catch (e) {
                log.error('Error loading blocked users from localStorage:', e);
                // Continue even if localStorage fails - the server API will provide the authoritative list
            }
            
            // Then fetch from server for authoritative data
            if (user?._id) {
                try {
                    log.debug('Fetching blocked users from server');
                    // First check if user is blocked directly instead of getting the whole list
                    if (recipient?._id) {
                        try {
                            // Check if this specific user is blocked
                            log.debug(`Checking if user ${recipient._id} is blocked (as workaround for 400 error)`);
                            
                            // Use an alternative approach - check user object directly
                            if (user.blockedUsers && Array.isArray(user.blockedUsers) && user.blockedUsers.includes(recipient._id)) {
                                log.debug(`User ${recipient._id} is marked as blocked in user object`);
                                recipient.isBlocked = true;
                            }
                            
                        } catch (specificErr) {
                            log.debug(`Could not check specific user blocked status: ${specificErr.message}`);
                        }
                    }
                    
                    // Try to fallback to localStorage data (since API endpoint isn't working)
                    const lsBlockedUsers = JSON.parse(localStorage.getItem('mandarin_blocked_users') || '[]');
                    if (lsBlockedUsers.length > 0) {
                        log.debug(`Using ${lsBlockedUsers.length} blocked users from localStorage due to API error`);
                        setBlockedUsers(new Set(lsBlockedUsers));
                    }
                    
                } catch (e) {
                    log.error('Error with blocked users handling:', e);
                    // We already loaded from localStorage, so UI is still responsive
                }
            }
        };
        
        loadBlockedUsers();
    }, [recipient?._id, user?._id]);

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
            log.debug(`Updating messages: ${uniqueMessages.length} unique of ${combined.length} total`);
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
        if (!recipientId || !user?._id) return;
        try {
            const response = await apiService.get(`/users/photos/permissions`, {
                params: { requestedBy: recipientId, status: "pending" },
            });
            const requests = response?.data?.data || [];
            setPendingPhotoRequests(requests.length);
        } catch (error) {
            log.error("Error checking photo permissions:", error.response?.data || error.message);
            setPendingPhotoRequests(0);
        }
    }, [recipientId, user?._id]);

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
            const response = await apiService.post(`/users/photos/approve-all`, { requesterId: recipientId });
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
    }, [recipientId, pendingPhotoRequests, isApprovingRequests, user?.accountTier, hookSendMessage, addLocalSystemMessage, recipient?.nickname]);

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
        // Check if user is blocked before attempting to send
        if (isUserBlocked(recipient?._id)) {
            toast.error("Cannot send messages to blocked users");
            return;
        }
        
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
    }, [attachment, newMessage, sendingMessage, isUploading, user?.accountTier, sendMessageWrapper, recipient, isUserBlocked]);

    // Send Wink Handler
    const handleSendWink = useCallback(async () => {
        if (sendingMessage || isUploading || !recipientId || isUserBlocked(recipient?._id)) {
            if (isUserBlocked(recipient?._id)) {
                toast.error("Cannot send winks to blocked users");
            }
            return;
        }
        await sendMessageWrapper("😉", 'wink');
    }, [sendingMessage, isUploading, recipientId, sendMessageWrapper, isUserBlocked, recipient]);

    // File Input Trigger
    const handleFileAttachmentClick = useCallback(() => {
        if (user?.accountTier === ACCOUNT_TIER.FREE) { 
            toast.error("Upgrade to Premium to send files.");
            return; 
        }
        if (isUserBlocked(recipient?._id)) {
            toast.error("Cannot send files to blocked users");
            return;
        }
        if (!isUploading) { 
            fileInputRef.current?.click(); 
        }
    }, [user?.accountTier, isUploading, isUserBlocked, recipient]);

    // File Selection
    const handleFileChange = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (isUserBlocked(recipient?._id)) {
            toast.error("Cannot send files to blocked users");
            e.target.value = null;
            return;
        }
        if (file.size > MAX_FILE_SIZE) { toast.error(`File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB.`); e.target.value = null; return; }
        if (!ALLOWED_FILE_TYPES.includes(file.type)) { toast.error(`File type (${file.type || 'unknown'}) not supported.`); e.target.value = null; return; }
        setAttachment(file); setNewMessage(""); setIsUploading(false); setUploadProgress(0);
        toast.info(`Selected: ${file.name}. Click send.`); e.target.value = null;
    }, [isUserBlocked, recipient]);

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

    // --- User Block/Report Handlers ---
    
    // Handle blocking/unblocking a user
    const handleBlockUser = useCallback(async (userId) => {
        if (!userId || !user?._id) {
            log.warn('Block/unblock attempted with invalid parameters:', { userId, currentUser: user?._id });
            toast.error('Unable to process block/unblock request. Please try again.');
            return;
        }
        
        try {
            const isCurrentlyBlocked = isUserBlocked(userId);
            const action = isCurrentlyBlocked ? 'unblock' : 'block';
            
            log.debug(`Attempting to ${action} user:`, userId);
            // Try to make the API call
            let apiSucceeded = false;
            try {
                const response = await apiService.post(`/users/${action}/${userId}`);
                apiSucceeded = response.data?.success || false;
            } catch (apiError) {
                log.error(`API error for ${action} user:`, apiError);
                // Gracefully continue even if API fails
            }
            
            // Update local state regardless of API success (for better user experience)
            setBlockedUsers(prev => {
                try {
                    const newSet = new Set(prev);
                    if (action === 'block') {
                        newSet.add(userId);
                    } else {
                        newSet.delete(userId);
                    }
                    return newSet;
                } catch (e) {
                    log.error('Error updating blockedUsers state:', e);
                    return prev; // Return previous state on error
                }
            });
            
            // Update recipient object if it's the current conversation
            try {
                if (recipient?._id === userId) {
                    recipient.isBlocked = !isCurrentlyBlocked;
                }
            } catch (e) {
                log.error('Error updating recipient.isBlocked:', e);
                // If updating the recipient object fails, fallback to local state
            }
            
            // Store blocked state in localStorage for persistence
            try {
                const blockedList = JSON.parse(localStorage.getItem('mandarin_blocked_users') || '[]');
                if (action === 'block' && !blockedList.includes(userId)) {
                    blockedList.push(userId);
                } else if (action === 'unblock') {
                    const index = blockedList.indexOf(userId);
                    if (index > -1) blockedList.splice(index, 1);
                }
                localStorage.setItem('mandarin_blocked_users', JSON.stringify(blockedList));
                log.debug(`Updated blocked users in localStorage: ${blockedList.length} users`);
            } catch (e) {
                log.error('Error updating localStorage blocked users:', e);
                // Continue even if localStorage fails
            }
            
            toast.success(`User ${action === 'block' ? 'blocked' : 'unblocked'} successfully`);
            addLocalSystemMessage(`User ${action === 'block' ? 'blocked' : 'unblocked'}.`);
        } catch (error) {
            log.error(`Error ${isUserBlocked(userId) ? 'unblocking' : 'blocking'} user:`, error);
            toast.error(`Failed to ${isUserBlocked(userId) ? 'unblock' : 'block'} user. Please try again.`);
            
            // If server communication failed but the intent was to block,
            // we can still update the local UI to show the user as blocked as a fallback
            if (!isUserBlocked(userId)) {
                log.debug('Applying fallback local blocking for better UX despite error');
                setBlockedUsers(prev => {
                    const newSet = new Set(prev);
                    newSet.add(userId);
                    return newSet;
                });
                
                if (recipient?._id === userId) {
                    try {
                        recipient.isBlocked = true;
                    } catch (e) {
                        log.error('Error updating recipient.isBlocked in error handler:', e);
                    }
                }
                
                // Store blocked state in localStorage even on error
                try {
                    const blockedList = JSON.parse(localStorage.getItem('mandarin_blocked_users') || '[]');
                    if (!blockedList.includes(userId)) {
                        blockedList.push(userId);
                        localStorage.setItem('mandarin_blocked_users', JSON.stringify(blockedList));
                    }
                } catch (e) {
                    log.error('Error updating localStorage in fallback:', e);
                }
            }
        }
    }, [user?._id, isUserBlocked, recipient, addLocalSystemMessage]);
    
    // Handle reporting a user
    const handleReportUser = useCallback(async (userId) => {
        if (!userId || !user?._id) {
            log.warn('Report user attempted with invalid parameters:', { userId, currentUser: user?._id });
            toast.error('Unable to process report request. Please try again.');
            return;
        }
        
        try {
            log.debug('Attempting to report user:', userId);
            const response = await apiService.post(`/users/report/${userId}`);
            
            if (response.data?.success) {
                toast.success('User reported successfully');
                addLocalSystemMessage('User reported to moderators.');
                
                // Optionally suggest blocking the user as well
                if (!isUserBlocked(userId)) {
                    setTimeout(() => {
                        toast.info('Consider blocking this user if they are bothering you.', {
                            autoClose: 8000,
                            onClick: () => handleBlockUser(userId)
                        });
                    }, 1500);
                }
            } else {
                // Handle unsuccessful API response
                log.warn('API reported failure for report:', response.data);
                toast.error('Failed to report user. Server reported an issue.');
            }
        } catch (error) {
            log.error('Error reporting user:', error);
            toast.error('Failed to report user. Please try again.');
            
            // Still add a system message for better UX feedback even if API failed
            addLocalSystemMessage('Attempted to report user to moderators, but there was a network issue.', true);
        }
    }, [user?._id, addLocalSystemMessage, isUserBlocked, handleBlockUser]);
    
    // Handle opening the profile modal
    const handleProfileClick = useCallback(() => {
        if (recipient?._id) {
            setIsProfileModalOpen(true);
            setProfileUserId(recipient._id);
        }
    }, [recipient]);

    // --- UI Action Handlers ---
    const handleRetryLoad = useCallback(() => { setLoadingTimedOut(false); refreshChat(); }, [refreshChat]);
    const handleReconnect = useCallback(() => { toast.info("Attempting reconnect..."); socketService?.reconnect?.(); setTimeout(refreshChat, RECONNECT_DELAY_MS); }, [refreshChat]);
    const handleForceInit = useCallback(() => { toast.info("Re-initializing chat..."); handleReconnect(); }, [handleReconnect]);

    // --- Render Logic ---
    if (!isOpen) return null;

    // Debug current component state
    if (process.env.NODE_ENV === 'development') {
        log.debug('EmbeddedChat render state:', {
            recipientId,
            isRecipientBlocked: recipient?.isBlocked,
            blockedUsersCount: blockedUsers.size,
            isProfileModalOpen,
            isCallActive,
            incomingCall: !!incomingCall,
            connectionState: isConnected ? 'connected' : 'disconnected'
        });
    }

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
    const isRecipientBlocked = isUserBlocked(recipient._id);
    
    // Create a conversation object structure expected by ChatHeader
    const conversationObject = {
        user: {
            ...recipient,
            username: recipient.username || recipient.nickname || recipient._id, // Ensure username is always available
            isBlocked: isRecipientBlocked
        },
        pendingPhotoRequests: pendingPhotoRequests
    };
    
    // Special action handlers for embedded chat
    const chatHeaderActions = {
        onApprovePhotoRequests: pendingPhotoRequests > 0 ? handleApproveAllRequests : undefined,
        isApprovingPhotoRequests: isApprovingRequests,
        isVideoCallDisabled: isHeaderActionsDisabled || !recipient.isOnline || isRecipientBlocked,
        isConnected: isConnected
    };

    return (
        <div className={classNames(styles.chatContainer, styles.opening)}>
            <ChatHeader
                conversation={conversationObject}
                isMobile={false}
                onBackClick={onClose}
                onStartVideoCall={handleVideoCall}
                onProfileClick={handleProfileClick}
                onBlockUser={handleBlockUser}
                onReportUser={handleReportUser}
                userTier={user?.accountTier}
                pendingPhotoRequests={pendingPhotoRequests}
                isApprovingRequests={isApprovingRequests}
                onApprovePhotoRequests={handleApproveAllRequests}
                isActionDisabled={isHeaderActionsDisabled}
                isConnected={isConnected}
                customStyles={styles}
            />

            {user?.accountTier === ACCOUNT_TIER.FREE && <PremiumBanner onUpgradeClick={() => navigate("/subscription")} customStyles={styles} />}

            <CallBanners
                incomingCall={incomingCall}
                isCallActive={isCallActive}
                recipientNickname={recipient.nickname}
                onAcceptCall={handleAcceptCall}
                onDeclineCall={handleDeclineCall}
                onEndCall={handleEndCall}
                useSmallButtons={true} // Embedded chat might use smaller buttons
                customStyles={styles}
            />

            <ChatArea 
                className={styles.chatArea}
                isUserBlocked={isRecipientBlocked}
            >
                <div className={styles.messagesContainer} ref={messagesContainerRef}>
                {/* --- Loading/Error/Empty States --- */}
                {hookLoading && !localMessages.length ? (
                    <LoadingIndicator showTimeoutMessage={loadingTimedOut} handleRetry={handleRetryLoad} handleReconnect={handleReconnect} customStyles={styles}/>
                ) : hookError ? (
                    <ErrorMessage error={hookError} handleRetry={handleRetryLoad} handleForceInit={handleForceInit} showInitButton={!initialized} customStyles={styles}/>
                ) : !initialized || (!isConnected && !localMessages.length) ? (
                    <ConnectionIssueMessage handleReconnect={handleReconnect} isInitializing={!initialized} customStyles={styles}/>
                ) : localMessages.length === 0 && !hookLoading ? (
                    <NoMessagesPlaceholder text="No messages yet. Say hello!" customStyles={styles}/>
                ) : (
                     // --- Message List Rendering ---
                     <>
                         {hasMore && ( <button onClick={loadMoreMessages} className={styles.loadMoreButton} disabled={hookLoading}>{hookLoading ? "Loading..." : "Load More"}</button> )}
                          {Object.entries(groupedMessages).map(([date, msgs]) => (
                            <React.Fragment key={date}>
                                <div className={styles.messageDate}>{date}</div>
                                {msgs.map((message) => ( <MessageItem key={message._id || message.tempId} message={message} currentUserId={currentUserId} isSending={sendingMessage && message.tempId === message._id} customStyles={styles} /> ))}
                            </React.Fragment>
                        ))}
                         {typingStatus && ( <div className={styles.typingIndicatorBubble}><div className={styles.typingIndicator}><span></span><span></span><span></span></div></div> )}
                     </>
                )}
                <div ref={messagesEndRef} style={{ height: '1px' }} />
                </div>
            </ChatArea>

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
                customStyles={styles}
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
                isUserBlocked={isRecipientBlocked}
                inputRef={chatInputRef}
                placeholderText={isRecipientBlocked
                    ? "Cannot send messages to blocked users"
                    : (recipient ? `Message ${recipient.nickname}...` : "Type a message...")}
                customStyles={styles}
            />
            
            {/* Hidden File Input - Kept separate since it's accessed via ChatInput */}
            <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} accept={ALLOWED_FILE_TYPES.join(",")} aria-hidden="true" />

            {/* Video Call Overlay */}
            {isCallActive && recipientId && currentUserId && (
                <div className={classNames(styles.videoCallOverlay, styles.active)}>
                    <VideoCall isActive={isCallActive} userId={currentUserId} recipientId={recipientId} onEndCall={handleEndCall} isIncoming={false} callId={null}/>
                </div>
            )}
            
            {/* User Profile Modal */}
            {profileUserId && (
                <UserProfileModal 
                    userId={profileUserId}
                    isOpen={isProfileModalOpen}
                    onClose={() => setIsProfileModalOpen(false)}
                />
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

// --- We've migrated from defaultProps to default parameters in the component function
// so this is no longer needed, but keeping a comment for documentation purposes

export default EmbeddedChat;
