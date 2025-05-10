// client/src/hooks/useChat.js
/**
 * Hook for chat functionality - now using the centralized ChatContext
 * This is a wrapper around the useChat hook from ChatContext for backwards compatibility
 */
import { useEffect, useCallback } from 'react';
import { useChat as useChatContext } from '../context';
import { logger } from '../utils';

// Create a logger for this hook
const log = logger.create('useChat');

/**
 * Main chat hook for conversation management - backward compatibility wrapper
 * @param {string} recipientId - ID of the conversation partner
 * @returns {Object} - Chat state and methods
 */
export const useChat = (recipientId = null) => {
  // Ensure recipientId is treated as a string if it exists
  const normalizedRecipientId = recipientId ? String(recipientId) : null;
  
  // Use the centralized context
  const chatContext = useChatContext();
  
  // When this hook is called with a specific recipientId, set it as the active conversation
  useEffect(() => {
    if (normalizedRecipientId) {
      chatContext.setActiveConversation(normalizedRecipientId);
    }
  }, [normalizedRecipientId, chatContext.setActiveConversation]);
  
  // Create a sendMessage wrapper that's tied to the current recipientId
  const sendMessage = useCallback(async (content, type = 'text', metadata = null) => {
    if (!normalizedRecipientId) {
      const errMsg = 'Cannot send message: Missing recipient ID';
      log.error(errMsg);
      throw new Error(errMsg);
    }
    
    // Make sure this recipient is the active conversation
    if (chatContext.activeConversation !== normalizedRecipientId) {
      await chatContext.setActiveConversation(normalizedRecipientId);
    }
    
    return chatContext.sendMessage(content, type, metadata);
  }, [normalizedRecipientId, chatContext]);
  
  // Create a loadMessages wrapper that's tied to the current recipientId
  const loadMessages = useCallback(async (forceRefresh = false) => {
    if (!normalizedRecipientId) {
      return [];
    }
    
    return chatContext.loadMessages(normalizedRecipientId, forceRefresh);
  }, [normalizedRecipientId, chatContext.loadMessages]);
  
  // Create a refresh wrapper
  const refresh = useCallback(() => {
    if (!normalizedRecipientId) {
      return Promise.resolve([]);
    }
    
    // Make sure this recipient is the active conversation
    if (chatContext.activeConversation !== normalizedRecipientId) {
      chatContext.setActiveConversation(normalizedRecipientId);
    }
    
    return chatContext.refresh();
  }, [normalizedRecipientId, chatContext]);
  
  // Create a sendTyping wrapper
  const sendTyping = useCallback(() => {
    if (!normalizedRecipientId) {
      return;
    }
    
    // Make sure this recipient is the active conversation
    if (chatContext.activeConversation !== normalizedRecipientId) {
      chatContext.setActiveConversation(normalizedRecipientId);
    }
    
    chatContext.sendTyping();
  }, [normalizedRecipientId, chatContext]);
  
  // Filter messages by the current recipient
  const filteredMessages = normalizedRecipientId
    ? chatContext.messages.filter(m => 
        (m.sender === normalizedRecipientId && m.recipient === chatContext.user?._id) || 
        (m.sender === chatContext.user?._id && m.recipient === normalizedRecipientId)
      )
    : [];
  
  // Return an API that matches the original hook
  return {
    // Pass through the relevant state
    messages: filteredMessages,
    loading: chatContext.loading,
    sending: chatContext.sending,
    error: chatContext.error,
    hasMore: chatContext.hasMore,
    typingStatus: chatContext.typingStatus,
    isConnected: chatContext.isConnected,
    initialized: chatContext.initialized,
    
    // Wrapped methods tied to the current recipientId
    loadMessages,
    loadMoreMessages: chatContext.loadMoreMessages,
    sendMessage,
    sendTyping,
    refresh
  };
};

// Export the hook as default
export default useChat;