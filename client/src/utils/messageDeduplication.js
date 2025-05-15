// utils/messageDeduplication.js
import { logger } from './logger';

const log = logger.create('MessageDeduplication');

/**
 * Optimized message deduplication utility
 * Uses Map for O(1) lookups instead of nested loops
 */
export class MessageDeduplicator {
  constructor() {
    this.messageIndex = new Map();
    this.winkIndex = new Map();
    this.contentIndex = new Map();
  }

  /**
   * Clear all indices - call this periodically to prevent memory leaks
   */
  clear() {
    this.messageIndex.clear();
    this.winkIndex.clear();
    this.contentIndex.clear();
  }

  /**
   * Deduplicate messages with optimized O(n) complexity
   * @param {Array} messages - Array of messages to deduplicate
   * @returns {Array} Deduplicated messages
   */
  deduplicateMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
      return [];
    }

    // Clear indices for fresh deduplication
    this.clear();

    const result = [];
    let duplicatesRemoved = 0;

    for (const message of messages) {
      if (!message || (!message.type && !message.content)) continue;

      const messageId = message._id || message.tempId;
      
      // Check for ID duplicates
      if (messageId && this.messageIndex.has(messageId)) {
        duplicatesRemoved++;
        continue;
      }

      // Special handling for winks
      if (message.type === 'wink' && message.content === '😉') {
        const winkKey = this.getWinkKey(message);
        
        if (this.winkIndex.has(winkKey)) {
          const existing = this.winkIndex.get(winkKey);
          
          // Keep the message with a valid ID
          if (existing._id && !messageId) {
            duplicatesRemoved++;
            continue;
          } else if (!existing._id && messageId) {
            // Replace with the one that has an ID
            const existingIndex = result.findIndex(m => m === existing);
            if (existingIndex !== -1) {
              result[existingIndex] = message;
              this.winkIndex.set(winkKey, message);
            }
            continue;
          } else {
            duplicatesRemoved++;
            continue;
          }
        }
        
        this.winkIndex.set(winkKey, message);
      } else {
        // General content deduplication
        const contentKey = this.getContentKey(message);
        
        if (this.contentIndex.has(contentKey)) {
          const existing = this.contentIndex.get(contentKey);
          
          // Keep the message with a valid ID
          if (existing._id && !messageId) {
            duplicatesRemoved++;
            continue;
          } else if (!existing._id && messageId) {
            // Replace with the one that has an ID
            const existingIndex = result.findIndex(m => m === existing);
            if (existingIndex !== -1) {
              result[existingIndex] = message;
              this.contentIndex.set(contentKey, message);
            }
            continue;
          } else {
            duplicatesRemoved++;
            continue;
          }
        }
        
        this.contentIndex.set(contentKey, message);
      }

      // Add to result and index
      if (messageId) {
        this.messageIndex.set(messageId, message);
      }
      result.push(message);
    }

    if (duplicatesRemoved > 0) {
      log.info(`Removed ${duplicatesRemoved} duplicate messages from ${messages.length} total`);
    }

    return result;
  }

  /**
   * Generate a key for wink deduplication
   * @private
   */
  getWinkKey(message) {
    const sender = message.sender || '';
    const timestamp = new Date(message.createdAt).getTime();
    const timeBucket = Math.floor(timestamp / 300000); // 5-minute buckets
    return `wink:${sender}:${timeBucket}`;
  }

  /**
   * Generate a key for content deduplication
   * @private
   */
  getContentKey(message) {
    const sender = message.sender || '';
    const recipient = message.recipient || '';
    const content = message.content || '';
    const type = message.type || '';
    const timestamp = new Date(message.createdAt).getTime();
    
    // Different time windows for different message types
    const timeWindow = type === 'text' ? 1000 : 5000;
    const timeBucket = Math.floor(timestamp / timeWindow);
    
    return `${sender}:${recipient}:${type}:${content.substring(0, 30)}:${timeBucket}`;
  }
}

// Singleton instance
export const messageDeduplicator = new MessageDeduplicator();