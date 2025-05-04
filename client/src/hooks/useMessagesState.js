"use client"

import { useReducer, useCallback, useEffect, useRef } from "react"
import { useParams } from "react-router-dom"
import { toast } from "react-toastify"
import chatService from "../services/ChatService"
import socketService from "../services/socketService"
import apiService from "../services/apiService"
import { logger } from "../utils/logger"
import { generateLocalUniqueId } from "../components/chat/chatUtils"
import { 
  messagesReducer, 
  initialState,
  ACTIONS
} from "../reducers/messagesReducer"
import { useAuth } from "../context"

const log = logger.create("useMessagesState")

/**
 * Custom hook for messages state management
 * 
 * @param {string} targetUserId - Optional user ID to initialize a conversation with
 * @returns {Object} Messages state and methods
 */
export function useMessagesState(targetUserId = null) {
  // Get params from router if available
  const params = useParams()
  const routeUserId = params?.userId

  // Use the targetUserId prop or fall back to the route param
  const initialUserId = targetUserId || routeUserId

  // Get auth context
  const { user: currentUser, isAuthenticated } = useAuth()

  // Initialize the state using the reducer
  const [state, dispatch] = useReducer(messagesReducer, initialState)
  
  // Destructure state for easier use throughout the hook
  const { 
    chat: { 
      conversations, 
      activeConversation, 
      messages, 
      messageInput, 
      typingUser 
    },
    ui: { 
      showSidebar, 
      showEmojis, 
      isRefreshing, 
      showInstallBanner, 
      pullDistance, 
      swipeDirection 
    },
    media: { 
      attachment, 
      isUploading, 
      uploadProgress 
    },
    call: { 
      isCallActive, 
      incomingCall 
    },
    status: { 
      componentLoading, 
      messagesLoading, 
      isSending, 
      error 
    }
  } = state

  // Refs
  const socketInitializedRef = useRef(false)
  const lastLoadedConversationRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  /**
   * Load conversations from the server
   */
  const loadConversations = useCallback(async () => {
    if (!isAuthenticated) {
      log.warn("loadConversations: Not authenticated, skipping");
      return;
    }
    
    log.info("Loading conversations from server");
    dispatch({ type: ACTIONS.SET_COMPONENT_LOADING, payload: true });
    
    try {
      const result = await chatService.getConversations();
      log.debug("Conversations loaded:", result?.length, result);
      
      if (!result || !Array.isArray(result)) {
        log.warn("Invalid conversations data received:", result);
        dispatch({ type: ACTIONS.SET_CONVERSATIONS, payload: [] });
        return [];
      }
      
      dispatch({ type: ACTIONS.SET_CONVERSATIONS, payload: result });
      log.info(`Loaded ${result.length} conversations`);
      
      // Find conversation with target user if provided
      if (initialUserId && result && result.length > 0) {
        const targetConversation = result.find(c => 
          c.participants.some(p => p._id === initialUserId)
        );
        
        if (targetConversation) {
          log.info(`Setting active conversation with target user: ${initialUserId}`);
          dispatch({ type: ACTIONS.SET_ACTIVE_CONVERSATION, payload: targetConversation });
        } else {
          log.warn(`No conversation found with target user: ${initialUserId}`);
        }
      }
      
      return result;
    } catch (error) {
      log.error("Error loading conversations:", error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      return [];
    } finally {
      dispatch({ type: ACTIONS.SET_COMPONENT_LOADING, payload: false });
    }
  }, [isAuthenticated, initialUserId])

  /**
   * Load messages for the active conversation
   */
  const loadMessages = useCallback(async (conversationId) => {
    // Add check for valid conversationId
    if (!conversationId) {
      log.warn("loadMessages: Invalid conversationId", conversationId);
      return;
    }
    
    // Don't reload messages if we already loaded them and have messages
    if (lastLoadedConversationRef.current === conversationId && state.chat.messages.length > 0) {
      log.debug(`loadMessages: Already loaded for ${conversationId}, skipping.`);
      return;
    }
    
    log.info(`loadMessages triggered for conversation: ${conversationId}`);
    dispatch({ type: ACTIONS.SET_MESSAGES_LOADING, payload: true });
    dispatch({ type: ACTIONS.SET_ERROR, payload: null }); // Clear previous errors
    
    try {
      const result = await chatService.getMessages(conversationId);
      // Add logging for received messages
      log.debug(`Messages received from chatService for ${conversationId}:`, result);
      
      if (result && Array.isArray(result)) {
        dispatch({ type: ACTIONS.SET_MESSAGES, payload: result });
        lastLoadedConversationRef.current = conversationId; // Update ref *after* successful load
        log.info(`Successfully loaded ${result.length} messages for ${conversationId}`);
      } else {
        log.warn(`No messages or invalid data received for ${conversationId}`);
        dispatch({ type: ACTIONS.SET_MESSAGES, payload: [] }); // Set empty array if no data
        lastLoadedConversationRef.current = conversationId; // Still mark as loaded
      }
      return result;
    } catch (error) {
      log.error(`Error loading messages for ${conversationId}:`, error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message || "Failed to load messages" });
      dispatch({ type: ACTIONS.SET_MESSAGES, payload: [] }); // Clear messages on error
      return [];
    } finally {
      dispatch({ type: ACTIONS.SET_MESSAGES_LOADING, payload: false });
    }
  }, [])

  /**
   * Set the active conversation and load its messages
   */
  const setActiveConversation = useCallback((conversation) => {
    if (!conversation) {
      log.warn("setActiveConversation: No conversation provided");
      return;
    }
    
    if (!conversation._id) {
      log.warn("setActiveConversation: Invalid conversation object (missing _id)", conversation);
      return;
    }
    
    log.info(`Setting active conversation: ${conversation._id}`);
    log.debug("Active conversation details:", conversation);
    
    dispatch({ type: ACTIONS.SET_ACTIVE_CONVERSATION, payload: conversation });
    loadMessages(conversation._id);
  }, [loadMessages])

  /**
   * Start a new conversation with a user
   */
  const startConversation = useCallback(async (userId) => {
    if (!userId || !isAuthenticated) return null
    
    try {
      // Check if we already have a conversation with this user
      const existingConversation = conversations.find(c => 
        c.participants.some(p => p._id === userId)
      )
      
      if (existingConversation) {
        setActiveConversation(existingConversation)
        return existingConversation
      }
      
      // Start a new conversation
      const newConversation = await chatService.startConversation(userId)
      
      if (!newConversation) {
        throw new Error("Failed to start conversation")
      }
      
      // Add the new conversation to state
      dispatch({ type: ACTIONS.SET_CONVERSATIONS, payload: [
        newConversation,
        ...conversations
      ]})
      
      // Set it as active
      dispatch({ type: ACTIONS.SET_ACTIVE_CONVERSATION, payload: newConversation })
      
      return newConversation
    } catch (error) {
      log.error("Error starting conversation:", error)
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message })
      return null
    }
  }, [isAuthenticated, conversations, setActiveConversation])

  /**
   * Handle input change for the message field
   */
  const handleInputChange = useCallback((e) => {
    const value = e.target.value
    dispatch({ type: ACTIONS.SET_MESSAGE_INPUT, payload: value })
    
    // Send typing indicator if connected and in a conversation
    if (socketService.isConnected() && activeConversation) {
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      
      // Emit typing event
      socketService.emit("typing", {
        conversationId: activeConversation._id,
        isTyping: true
      })
      
      // Set timeout to clear typing status
      typingTimeoutRef.current = setTimeout(() => {
        socketService.emit("typing", {
          conversationId: activeConversation._id,
          isTyping: false
        })
      }, 3000)
    }
  }, [activeConversation])

  /**
   * Handle file selection for attachments
   */
  const handleAttachment = useCallback((file) => {
    if (!file) return
    
    dispatch({ type: ACTIONS.SET_ATTACHMENT, payload: file })
  }, [])

  /**
   * Remove the current attachment
   */
  const removeAttachment = useCallback(() => {
    dispatch({ type: ACTIONS.SET_ATTACHMENT, payload: null })
  }, [])

  /**
   * Send a message to the active conversation
   */
  const sendMessage = useCallback(async () => {
    if (!activeConversation) {
      toast.error("No active conversation")
      return
    }
    
    if (!messageInput.trim() && !attachment) {
      return
    }
    
    dispatch({ type: ACTIONS.SET_SENDING, payload: true })
    
    try {
      let attachmentUrl = null
      
      // Upload attachment if present
      if (attachment) {
        dispatch({ type: ACTIONS.SET_UPLOADING, payload: true })
        
        const formData = new FormData()
        formData.append("file", attachment)
        
        try {
          const uploadResult = await apiService.upload(
            "/messages/attachments",
            formData,
            (progressEvent) => {
              if (progressEvent.total) {
                const percentComplete = Math.round(
                  (progressEvent.loaded / progressEvent.total) * 100
                )
                dispatch({ 
                  type: ACTIONS.SET_UPLOAD_PROGRESS, 
                  payload: percentComplete 
                })
              }
            }
          )
          
          if (uploadResult && uploadResult.url) {
            attachmentUrl = uploadResult.url
          }
        } catch (error) {
          log.error("Error uploading attachment:", error)
          toast.error("Error uploading attachment")
          dispatch({ type: ACTIONS.SET_UPLOADING, payload: false })
          dispatch({ type: ACTIONS.SET_SENDING, payload: false })
          return
        }
        
        dispatch({ type: ACTIONS.SET_UPLOADING, payload: false })
      }
      
      // Generate a temporary ID for the message
      const tempId = generateLocalUniqueId("msg")
      
      // Create message object
      const messageData = {
        text: messageInput.trim(),
        conversationId: activeConversation._id,
        attachment: attachmentUrl,
        tempId
      }
      
      // Add temporary message to UI
      const tempMessage = {
        _id: tempId,
        sender: { _id: currentUser._id },
        content: messageInput.trim(),
        attachment: attachmentUrl,
        createdAt: new Date().toISOString(),
        status: "sending",
        isTemp: true
      }
      
      dispatch({ type: ACTIONS.ADD_MESSAGE, payload: tempMessage })
      dispatch({ type: ACTIONS.RESET_INPUT })
      
      // Send message to server
      const result = await chatService.sendMessage(messageData)
      
      if (result) {
        // Update the temporary message with the real one
        dispatch({ 
          type: ACTIONS.UPDATE_MESSAGE, 
          payload: { 
            ...result,
            tempId,
            status: "sent" 
          }
        })
      }
      
      return result
    } catch (error) {
      log.error("Error sending message:", error)
      toast.error("Error sending message")
      return null
    } finally {
      dispatch({ type: ACTIONS.SET_SENDING, payload: false })
    }
  }, [activeConversation, messageInput, attachment, currentUser])

  /**
   * Toggle sidebar visibility
   */
  const toggleSidebar = useCallback((show) => {
    dispatch({ 
      type: ACTIONS.TOGGLE_SIDEBAR, 
      payload: show !== undefined ? show : undefined 
    })
  }, [])

  /**
   * Toggle emoji picker visibility
   */
  const toggleEmojis = useCallback((show) => {
    dispatch({ 
      type: ACTIONS.TOGGLE_EMOJIS, 
      payload: show !== undefined ? show : undefined 
    })
  }, [])

  /**
   * Handle selecting an emoji
   */
  const handleEmojiSelect = useCallback((emoji) => {
    dispatch({ 
      type: ACTIONS.SET_MESSAGE_INPUT, 
      payload: messageInput + emoji 
    })
    dispatch({ type: ACTIONS.TOGGLE_EMOJIS, payload: false })
  }, [messageInput])

  /**
   * Set up socket event listeners for real-time updates
   */
  const setupSocketListeners = useCallback(() => {
    // Add guard clause for better initialization checking
    if (!socketService.isConnected() || socketInitializedRef.current || !activeConversation?._id) {
      log.debug("Skipping socket listener setup:", { 
        connected: socketService.isConnected(), 
        initialized: socketInitializedRef.current, 
        activeConvo: !!activeConversation?._id 
      });
      return () => {}; // Return an empty cleanup function
    }
    
    log.info(`Setting up socket listeners for conversation: ${activeConversation._id}`);
    socketInitializedRef.current = true;
    
    // New message handler
    const handleNewMessage = (newMessage) => {
      log.debug("Received newMessage event:", newMessage);
      // Add robust check for conversation ID match
      if (newMessage.conversationId === activeConversation?._id) {
        log.info(`Adding message ${newMessage._id} to active conversation`);
        dispatch({ type: ACTIONS.ADD_MESSAGE, payload: newMessage });
        
        // Mark conversation read immediately
        if (newMessage.sender !== currentUser?._id) {
          chatService.markConversationRead(newMessage.conversationId).catch(err => 
            log.warn("Failed to mark read:", err)
          );
        }
      } else {
        log.debug(`Ignoring message for different conversation: ${newMessage.conversationId}`);
        // Optionally update the conversation list preview
        const conversation = conversations.find(c => c._id === newMessage.conversationId);
        if (conversation) {
          const updatedConversation = { 
            ...conversation, 
            lastMessage: newMessage, 
            unreadCount: (conversation.unreadCount || 0) + 1 
          };
          dispatch({ type: ACTIONS.UPDATE_CONVERSATION, payload: updatedConversation });
        }
      }
    };
    
    // Typing indicator handler
    const handleTypingIndicator = (data) => {
      log.debug("Received typing event:", data);
      if (activeConversation?._id && data.conversationId === activeConversation._id) {
        if (data.isTyping) {
          dispatch({ type: ACTIONS.SET_TYPING_USER, payload: data.user });
        } else {
          dispatch({ type: ACTIONS.SET_TYPING_USER, payload: null });
        }
      }
    };
    
    // Incoming call handler
    const handleIncomingCall = (callData) => {
      log.debug("Received incomingCall event:", callData);
      dispatch({ type: ACTIONS.SET_INCOMING_CALL, payload: callData });
    };
    
    // Call ended handler
    const handleCallEnded = () => {
      log.debug("Received callEnded event");
      dispatch({ type: ACTIONS.SET_CALL_ACTIVE, payload: false });
      dispatch({ type: ACTIONS.SET_INCOMING_CALL, payload: null });
    };
    
    // Add listener for message updates (e.g., status change)
    const handleMessageUpdate = (updatedMessage) => {
      log.debug("Received messageUpdate event:", updatedMessage);
      if (updatedMessage.conversationId === activeConversation?._id) {
        dispatch({ type: ACTIONS.UPDATE_MESSAGE, payload: updatedMessage });
      }
    };
    
    // Register socket event handlers
    socketService.on("newMessage", handleNewMessage);
    socketService.on("typing", handleTypingIndicator);
    socketService.on("incomingCall", handleIncomingCall);
    socketService.on("callEnded", handleCallEnded);
    socketService.on("messageUpdated", handleMessageUpdate);
    
    // Return cleanup function
    return () => {
      log.info(`Cleaning up socket listeners for conversation: ${activeConversation?._id}`);
      socketService.off("newMessage", handleNewMessage);
      socketService.off("typing", handleTypingIndicator);
      socketService.off("incomingCall", handleIncomingCall);
      socketService.off("callEnded", handleCallEnded);
      socketService.off("messageUpdated", handleMessageUpdate);
      socketInitializedRef.current = false;
    };
  }, [activeConversation?._id, currentUser?._id, conversations])

  // Load conversations when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadConversations()
    }
  }, [isAuthenticated, loadConversations])

  // Set up socket listeners when connected or active conversation changes
  useEffect(() => {
    if (socketService.isConnected()) {
      log.debug("Setting up socket listeners due to connection or conversation change");
      const cleanup = setupSocketListeners();
      return cleanup;
    }
  }, [setupSocketListeners, socketService.isConnected()])

  // Load messages when active conversation changes
  useEffect(() => {
    if (activeConversation?._id) {
      log.info(`Active conversation changed to: ${activeConversation._id}. Loading messages.`);
      // Reset last loaded ref when conversation changes to force reload
      if (lastLoadedConversationRef.current !== activeConversation._id) {
        lastLoadedConversationRef.current = null;
      }
      loadMessages(activeConversation._id);
    } else {
      // Clear messages if no active conversation
      dispatch({ type: ACTIONS.SET_MESSAGES, payload: [] });
      lastLoadedConversationRef.current = null;
      log.debug("No active conversation, messages cleared.");
    }
  }, [activeConversation?._id, loadMessages])

  // Handle mobile app installation
  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleBeforeInstallPrompt = (e) => {
        e.preventDefault()
        window.deferredPrompt = e
        dispatch({ type: ACTIONS.SET_SHOW_INSTALL_BANNER, payload: true })
      }
      
      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      
      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      }
    }
  }, [])

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  // Handle install app click
  const handleInstallClick = useCallback(async () => {
    if (typeof window === "undefined" || !window.deferredPrompt) return
    
    const promptEvent = window.deferredPrompt
    
    try {
      await promptEvent.prompt()
      const { outcome } = await promptEvent.userChoice
      log.info(`User ${outcome === "accepted" ? "accepted" : "declined"} the install prompt`)
    } catch (error) {
      log.error("Error prompting PWA install:", error)
    }
    
    window.deferredPrompt = null
    dispatch({ type: ACTIONS.SET_SHOW_INSTALL_BANNER, payload: false })
  }, [])

  // Return state and methods
  return {
    // State
    conversations,
    activeConversation,
    messages,
    messageInput,
    typingUser,
    showSidebar,
    showEmojis,
    attachment,
    isUploading,
    uploadProgress,
    isCallActive,
    incomingCall,
    componentLoading,
    messagesLoading,
    isSending,
    error,
    showInstallBanner,
    
    // UI state
    pullDistance: state.ui.pullDistance,
    isRefreshing: state.ui.isRefreshing,
    swipeDirection: state.ui.swipeDirection,
    
    // Methods
    loadConversations,
    loadMessages,
    setActiveConversation,
    startConversation,
    handleInputChange,
    handleAttachment,
    removeAttachment,
    sendMessage,
    toggleSidebar,
    toggleEmojis,
    handleEmojiSelect,
    handleInstallClick,
    
    // Dispatch for direct actions
    dispatch
  }
}

export default useMessagesState