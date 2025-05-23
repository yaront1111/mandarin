/**
 * Chat utility functions for consistent behavior across components
 */
import { logger } from "./logger"

const log = logger.create("chatUtils")

/**
 * Format message preview text based on message type and content
 * Used in both conversation list and message display
 *
 * @param {Object} message - The message object to format
 * @param {string} userId - Current user ID to detect "You:" prefix
 * @returns {string} Formatted message preview
 */
export const formatMessagePreview = (message, userId) => {
  if (!message) return "No messages yet"
  const prefix = message.sender === userId ? "You: " : ""

  switch (message.type) {
    case "text":
      const content = message.content || ""
      return prefix + (content.length > 25 ? `${content.substring(0, 25)}...` : content)
    case "wink":
      return prefix + "Sent a wink 😉"
    case "file":
      if (message.metadata?.fileType?.startsWith("image/")) {
        return prefix + "Sent an image"
      } else if (message.metadata?.fileType?.startsWith("video/")) {
        return prefix + "Sent a video"
      } else if (message.metadata?.fileType?.startsWith("audio/")) {
        return prefix + "Sent an audio file"
      } else if (message.metadata?.fileType === "application/pdf") {
        return prefix + "Sent a PDF document"
      } else {
        return prefix + "Sent a file"
      }
    case "video":
      return prefix + "Video Call"
    default:
      return prefix + "New message"
  }
}

/**
 * Group messages by date for display in chat
 *
 * @param {Array} messages - Array of message objects
 * @returns {Object} Object with dates as keys and arrays of messages as values
 */
export const groupMessagesByDate = (messages) => {
  const groups = {}
  if (!Array.isArray(messages)) return groups
  
  // Create a Set to track seen message IDs
  const seenMessageIds = new Set()

  messages.forEach((message) => {
    if (message && message.createdAt) {
      // Skip duplicates by checking unique ID
      const messageId = message._id || message.tempId
      
      // Skip if we've already seen this ID
      if (messageId && seenMessageIds.has(messageId)) {
        return
      }
      
      // Add to seen IDs if it has a valid ID
      if (messageId) {
        seenMessageIds.add(messageId)
      }
      
      // Group by date
      const date = new Date(message.createdAt).toDateString()
      groups[date] = groups[date] || []
      groups[date].push(message)
    }
  })

  return groups
}

/**
 * Get appropriate file icon for file attachments
 *
 * @param {string} fileType - MIME type of the file
 * @returns {string} Icon identifier (used with icon components)
 */
export const getFileIconType = (fileType) => {
  if (!fileType) return "file"

  if (fileType.startsWith("image/")) return "image"
  if (fileType.startsWith("video/")) return "video"
  if (fileType.startsWith("audio/")) return "audio"
  if (fileType === "application/pdf") return "pdf"

  return "file"
}

/**
 * Normalize chat message data
 * Ensures consistent message format across the app
 *
 * @param {Object} message - Raw message data from API or socket
 * @param {Object} options - Options for normalization
 * @returns {Object} Normalized message
 */
export const normalizeMessage = (message, options = {}) => {
  if (!message) return null

  const { currentUserId } = options

  // Ensure required properties
  return {
    ...message,
    _id: message._id || `temp-${Date.now()}`,
    content: message.content || "",
    createdAt: message.createdAt || new Date().toISOString(),
    type: message.type || "text",
    metadata: message.metadata || {},
    // Determine if message is from current user
    isFromMe: currentUserId
      ? message.sender === currentUserId || (typeof message.sender === "object" && message.sender._id === currentUserId)
      : false,
  }
}

/**
 * Validate file for upload
 *
 * @param {File} file - File to validate
 * @returns {Object} { valid: boolean, error: string }
 */
export const validateFileUpload = (file) => {
  if (!file) {
    return { valid: false, error: "No file provided" }
  }

  // Validate file size
  if (file.size > 5 * 1024 * 1024) {
    return { valid: false, error: "File is too large. Maximum size is 5MB." }
  }

  // Validate file type
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "audio/mpeg",
    "audio/wav",
    "video/mp4",
    "video/quicktime",
  ]

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: "File type not supported." }
  }

  return { valid: true, error: null }
}

/**
 * Common emoji list for chat features
 */
export const commonEmojis = ["😊", "😂", "😍", "❤️", "👍", "🙌", "🔥", "✨", "🎉", "🤔", "😉", "🥰"]

/**
 * Helper to safely concatenate classNames
 *
 * @param  {...string} classes - Class names to join
 * @returns {string} Combined class string
 */
export const classNames = (...classes) => {
  return classes.filter(Boolean).join(" ")
}

/**
 * Formats message timestamp to display time
 * @param {string} timestamp - ISO date string
 * @returns {string} Formatted time (HH:MM)
 */
export const formatMessageTime = (timestamp) => {
  if (!timestamp) return "";
  try {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    });
  } catch (error) {
    log.warn("Error formatting message time:", error);
    return "";
  }
};

/**
 * Formats date for message group separators
 * @param {string} timestamp - ISO date string
 * @returns {string} Formatted date (Today, Yesterday, or date)
 */
export const formatMessageDateSeparator = (timestamp) => {
  if (!timestamp) return "Unknown date";
  try {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    
    return date.toLocaleDateString([], { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch (error) {
    log.warn("Error formatting message date separator:", error);
    return "Unknown date";
  }
};

/**
 * Formats timestamp for conversation previews
 * @param {string} timestamp - ISO date string
 * @returns {string} Relative time (e.g., "2h ago", "Yesterday")
 */
export const formatPreviewTime = (timestamp) => {
  if (!timestamp) return "";
  try {
    const messageDate = new Date(timestamp);
    const now = new Date();
    const diffSeconds = Math.round((now - messageDate) / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);
    const diffDays = Math.round(diffHours / 24);

    if (diffSeconds < 60) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return messageDate.toLocaleDateString([], { weekday: 'short' });
    return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch (error) {
    log.warn("Error formatting preview time:", error);
    return "";
  }
};
