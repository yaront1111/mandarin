// src/components/chat/chatUtils.jsx
import React from 'react';
import {
    FaFile, FaImage, FaFileAlt, FaFilePdf,
    FaFileAudio, FaFileVideo
} from "react-icons/fa";
import logger from "../../utils/logger";

// Create a named logger for this module
const log = logger.create('chatUtils');

// Re-export utilities from main utils for proper dependency tracking
export { 
  groupMessagesByDate,
  formatMessagePreview,
  classNames,
  // Add utils that were previously duplicated
  validateFileUpload,
  normalizeMessage,
  getFileIconType,
  // Re-export date/time formatting utilities
  formatMessageTime,
  formatMessageDateSeparator,
  formatPreviewTime
} from '../../utils/chatUtils';

/**
 * Generates a unique local ID for optimistic updates and temporary items
 * @param {string} prefix - Prefix for the generated ID
 * @returns {string} A unique identifier
 */
let localIdCounter = 0;
export const generateLocalUniqueId = (prefix = 'local') => {
    localIdCounter++;
    const randomPart = Math.random().toString(36).substring(2, 9);
    return `${prefix}-${Date.now()}-${localIdCounter}-${randomPart}`;
};

/**
 * Gets appropriate icon component for file type
 * This extends getFileIconType by returning actual React icon components
 * @param {Object} file - File object or metadata
 * @returns {JSX.Element} React icon component
 */
export const getFileIcon = (file) => {
    // Handle both file objects (from input) and metadata objects (from messages)
    const fileType = file?.type || file?.fileType || file?.mimeType || "";
    
    if (!fileType) return <FaFile />;
    if (fileType.startsWith("image/")) return <FaImage />;
    if (fileType.startsWith("video/")) return <FaFileVideo />;
    if (fileType.startsWith("audio/")) return <FaFileAudio />;
    if (fileType === "application/pdf") return <FaFilePdf />;
    if (fileType.includes("word")) return <FaFileAlt />;
    
    return <FaFileAlt />; // Default document icon
};
