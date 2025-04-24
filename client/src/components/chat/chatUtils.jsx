// src/components/chat/chatUtils.jsx
import React from 'react';
import axios from "axios";
import {
    FaFile, FaImage, FaFileAlt, FaFilePdf,
    FaFileAudio, FaFileVideo
} from "react-icons/fa";

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
 * Creates an authenticated axios instance with token from storage
 * @returns {object} Axios instance with auth headers
 */
export const createAuthAxios = () => {
    const token = typeof window !== 'undefined'
        ? localStorage.getItem("token") || 
          sessionStorage.getItem("token") || 
          localStorage.getItem("authToken") || 
          sessionStorage.getItem("authToken")
        : null;
        
    return axios.create({
        headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
        },
    });
};

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
        console.warn("Error formatting message time:", error);
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
        console.warn("Error formatting message date separator:", error);
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
        console.warn("Error formatting preview time:", error);
        return "";
    }
};

/**
 * Groups messages by date for display
 * @param {Array} messages - Array of message objects
 * @returns {Object} Messages grouped by date string
 */
export const groupMessagesByDate = (messages) => {
    const groups = {};
    if (!Array.isArray(messages)) return groups;

    // Ensure messages are sorted chronologically first
    const sortedMessages = [...messages].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );

    // Group messages by date
    sortedMessages.forEach((message) => {
        if (message && message.createdAt) {
            const dateStr = formatMessageDateSeparator(message.createdAt);
            if (!groups[dateStr]) {
                groups[dateStr] = [];
            }
            groups[dateStr].push(message);
        } else {
            console.warn("Invalid message object encountered during grouping:", message);
        }
    });

    // Custom sort for dates (chronological: oldest to newest)
    const sortedDates = Object.keys(groups).sort((a, b) => {
        // Compare actual dates for entries
        try {
            const dateA = groups[a][0]?.createdAt ? new Date(groups[a][0].createdAt) : 0;
            const dateB = groups[b][0]?.createdAt ? new Date(groups[b][0].createdAt) : 0;
            return dateA - dateB; // Sort ascending by date
        } catch (error) {
            console.warn("Error sorting message dates:", error);
            return 0;
        }
    });

    // Create final sorted object
    const sortedGroups = {};
    sortedDates.forEach(date => {
        sortedGroups[date] = groups[date];
    });

    return sortedGroups;
};

/**
 * Gets appropriate icon for file type
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

/**
 * Creates preview text for message in conversation list
 * @param {Object} message - Message object
 * @param {string} currentUserId - Current user's ID
 * @returns {string} Formatted preview text
 */
export const formatMessagePreview = (message, currentUserId) => {
    if (!message) return "No messages yet";
    
    const prefix = message.sender === currentUserId ? "You: " : "";
    const contentLimit = 35; // Character limit for preview

    switch (message.type) {
        case 'text': {
            const text = message.content || "";
            return `${prefix}${text.substring(0, contentLimit)}${text.length > contentLimit ? '...' : ''}`;
        }
            
        case 'wink':
            return `${prefix}😉 Wink`;
            
        case 'file': {
            const fileName = message.metadata?.fileName || 'file';
            const fileType = message.metadata?.fileType || '';
            let fileIcon = '📄'; // Default icon
            
            if (fileType.startsWith('image/')) fileIcon = '📷';
            else if (fileType.startsWith('video/')) fileIcon = '🎬';
            else if (fileType.startsWith('audio/')) fileIcon = '🎵';
            
            return `${prefix}${fileIcon} ${fileName.substring(0, contentLimit - 5)}${fileName.length > (contentLimit - 5) ? '...' : ''}`;
        }
            
        case 'system': {
            const sysText = message.content || "System message";
            return `ℹ️ ${sysText.substring(0, contentLimit)}${sysText.length > contentLimit ? '...' : ''}`;
        }
            
        case 'video': {
            const callText = message.content || "Video Call related";
            return `${prefix}📞 ${callText.substring(0, contentLimit - 3)}${callText.length > (contentLimit - 3) ? '...' : ''}`;
        }
            
        default:
            return `${prefix}Unsupported message`;
    }
};

/**
 * Utility for concatenating conditional class names
 * @param {...string} classes - Class names to join (falsy values filtered out)
 * @returns {string} Space-separated class string
 */
export const classNames = (...classes) => {
    return classes.filter(Boolean).join(' ');
};
