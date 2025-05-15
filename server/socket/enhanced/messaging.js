// server/socket/enhanced/messaging.js
// Enhanced messaging system with improved reliability and message queuing

import { Message, User, Notification } from "../../models/index.js";
import logger from "../../logger.js";
import { setTimeout as sleep } from "timers/promises";
import mongoose from "mongoose";
import MemoryManager from "./memory-manager.js";

// Create a logger instance for the messaging module
const log = {
  info: (...args) => console.log("[socket:enhanced:messaging]", ...args),
  error: (...args) => console.error("[socket:enhanced:messaging]", ...args),
  warn: (...args) => console.warn("[socket:enhanced:messaging]", ...args),
  debug: (...args) => console.debug("[socket:enhanced:messaging]", ...args)
};

// Socket event names
const EVENTS = {
  SEND_MESSAGE:     "sendMessage",
  MESSAGE_SENT:     "messageSent",
  MESSAGE_RECEIVED: "messageReceived",
  MESSAGE_ERROR:    "messageError",
  TYPING:           "typing",
  USER_TYPING:      "userTyping",
  MESSAGE_READ:     "messageRead",
  MESSAGES_READ:    "messagesRead",
  BULK_MESSAGES:    "bulkMessages",      // New: deliver multiple messages at once
  MESSAGE_QUEUED:   "messageQueued",     // New: acknowledge message has been queued
  MESSAGE_STATUS:   "messageStatus",     // New: periodic status update on pending messages
};

// Message priority definitions for queue
const MESSAGE_PRIORITY = {
  HIGH:   1,  // Important system messages, payment notifications, etc.
  NORMAL: 2,  // Regular messages
  LOW:    3   // Typing indicators, read receipts, etc.
};

// Maximum queue size per recipient
const MAX_QUEUE_SIZE = 100;

// Default message processing delay when delivering queued messages
const QUEUE_PROCESSING_DELAY = 50; // ms

/**
 * Message queue for reliable delivery
 */
class MessageQueue {
  constructor() {
    // Use memory manager for message queues
    this.queueManager = new MemoryManager({
      maxAge: 60 * 60 * 1000,     // 1 hour for queued messages
      maxSize: 5000,              // 5k queues max
      cleanupInterval: 5 * 60 * 1000, // 5 minute cleanup
      useWeakRefs: false
    });
    
    // Use memory manager for delivery status
    this.statusManager = new MemoryManager({
      maxAge: 30 * 60 * 1000,     // 30 minutes for status
      maxSize: 10000,             // 10k status entries
      cleanupInterval: 5 * 60 * 1000,
      useWeakRefs: false
    });
    
    // Map of user IDs to active queue processor promise
    this.activeProcessors = new Map();
    
    // Wrapper for backward compatibility
    this.queues = {
      has: (key) => this.queueManager.get(key) !== undefined,
      get: (key) => this.queueManager.get(key),
      set: (key, value) => this.queueManager.set(key, value),
      delete: (key) => this.queueManager.delete(key),
      values: () => this.queueManager.data.values()
    };
    
    this.deliveryStatus = {
      has: (key) => this.statusManager.get(key) !== undefined,
      get: (key) => this.statusManager.get(key),
      set: (key, value) => this.statusManager.set(key, value),
      delete: (key) => this.statusManager.delete(key)
    };
    
    log.info("MessageQueue initialized");
  }
  
  /**
   * Add a message to the queue for a recipient
   * @param {string} recipientId Recipient user ID
   * @param {Object} message Message object
   * @param {number} priority Message priority (1=high, 3=low)
   * @param {Object} metadata Additional metadata
   * @returns {string} Message tracking ID
   */
  enqueue(recipientId, message, priority = MESSAGE_PRIORITY.NORMAL, metadata = {}) {
    if (!recipientId || !message) {
      log.warn("Attempted to enqueue message with invalid parameters");
      return null;
    }
    
    // Generate tracking ID if not provided
    const trackingId = metadata.trackingId || 
                       message._id?.toString() || 
                       `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Create queue for recipient if it doesn't exist
    if (!this.queues.has(recipientId)) {
      this.queueManager.set(recipientId, [], {
        references: [recipientId],
        ttl: 60 * 60 * 1000 // 1 hour TTL
      });
    }
    
    // Get the queue
    const queue = this.queues.get(recipientId);
    
    // Check queue size limits
    if (queue.length >= MAX_QUEUE_SIZE) {
      // For overflow, drop lowest priority messages first
      if (priority === MESSAGE_PRIORITY.LOW) {
        log.warn(`Queue full for recipient ${recipientId}, dropping low priority message`);
        return null;
      }
      
      // Remove low priority messages to make room
      const lowPriorityIndex = queue.findIndex(m => m.priority === MESSAGE_PRIORITY.LOW);
      if (lowPriorityIndex >= 0) {
        const removed = queue.splice(lowPriorityIndex, 1)[0];
        this.deliveryStatus.delete(removed.trackingId);
        log.debug(`Removed low priority message ${removed.trackingId} to make room`);
      } else if (priority === MESSAGE_PRIORITY.NORMAL) {
        // If no low priority messages and new message is normal, drop oldest normal
        const normalPriorityIndex = queue.findIndex(m => m.priority === MESSAGE_PRIORITY.NORMAL);
        if (normalPriorityIndex >= 0) {
          const removed = queue.splice(normalPriorityIndex, 1)[0];
          this.deliveryStatus.delete(removed.trackingId);
          log.debug(`Removed normal priority message ${removed.trackingId} to make room`);
        } else {
          log.warn(`Queue full for recipient ${recipientId}, cannot enqueue normal priority message`);
          return null;
        }
      }
    }
    
    // Add message to queue with metadata
    const queuedAt = Date.now();
    const queueItem = {
      message,
      priority,
      trackingId,
      queuedAt,
      attempts: 0,
      lastAttempt: null,
      ...metadata
    };
    
    queue.push(queueItem);
    
    // Sort queue by priority (higher priority first) and then by queue time
    queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.queuedAt - b.queuedAt;
    });
    
    // Record delivery status with memory management
    this.statusManager.set(trackingId, {
      recipientId,
      status: "queued",
      queuedAt,
      priority,
      message: {
        _id: message._id,
        type: message.type
      }
    }, {
      references: [recipientId, trackingId],
      ttl: 30 * 60 * 1000 // 30 minute TTL
    });
    
    log.debug(`Enqueued message ${trackingId} for recipient ${recipientId} with priority ${priority}`);
    
    // Start queue processor if not already running
    this.processQueue(recipientId);
    
    return trackingId;
  }
  
  /**
   * Process message queue for a specific recipient
   * @param {string} recipientId Recipient user ID
   */
  async processQueue(recipientId) {
    // Check if processor is already running
    if (this.activeProcessors.has(recipientId)) {
      return;
    }
    
    // Get the queue
    const queue = this.queues.get(recipientId);
    if (!queue || queue.length === 0) {
      return;
    }
    
    // Mark processor as active
    const processorPromise = this._runQueueProcessor(recipientId);
    this.activeProcessors.set(recipientId, processorPromise);
    
    // Wait for processor to complete
    try {
      await processorPromise;
    } catch (err) {
      log.error(`Queue processor error for ${recipientId}: ${err.message}`);
    } finally {
      // Remove processor reference
      this.activeProcessors.delete(recipientId);
      
      // Check if more messages arrived during processing
      const updatedQueue = this.queues.get(recipientId);
      if (updatedQueue && updatedQueue.length > 0) {
        // Start processor again
        this.processQueue(recipientId);
      }
    }
  }
  
  /**
   * Run the actual queue processor for a recipient
   * @param {string} recipientId Recipient user ID
   * @private
   */
  async _runQueueProcessor(recipientId) {
    log.debug(`Starting queue processor for recipient ${recipientId}`);
    
    // Get the recipient's queue
    let queue = this.queues.get(recipientId);
    if (!queue || queue.length === 0) {
      return;
    }
    
    // Process up to 10 messages at a time
    const processBatch = async () => {
      // Re-get the queue in case it changed
      queue = this.queues.get(recipientId);
      if (!queue || queue.length === 0) {
        return false;
      }
      
      // Process up to 10 messages
      const batch = queue.slice(0, 10);
      
      // Update delivery status
      for (const item of batch) {
        const status = this.deliveryStatus.get(item.trackingId);
        if (status) {
          status.status = "processing";
          status.processingStartedAt = Date.now();
          this.deliveryStatus.set(item.trackingId, status);
        }
      }
      
      // Deliver messages in the batch
      const results = await Promise.all(
        batch.map(item => this._deliverMessage(recipientId, item))
      );
      
      // Update queue based on results
      let processed = 0;
      for (let i = 0; i < results.length; i++) {
        const { delivered, item } = results[i];
        
        if (delivered) {
          // Remove from queue
          const index = queue.findIndex(m => m.trackingId === item.trackingId);
          if (index >= 0) {
            queue.splice(index, 1);
            processed++;
          }
          
          // Update delivery status
          const status = this.deliveryStatus.get(item.trackingId);
          if (status) {
            status.status = "delivered";
            status.deliveredAt = Date.now();
            
            // Keep delivered status for a short while then clean up
            setTimeout(() => {
              this.deliveryStatus.delete(item.trackingId);
            }, 60000); // Keep for 1 minute
          }
        } else {
          // Update attempt count
          item.attempts++;
          item.lastAttempt = Date.now();
          
          // Update delivery status
          const status = this.deliveryStatus.get(item.trackingId);
          if (status) {
            status.status = "failed";
            status.attempts = item.attempts;
            status.lastAttempt = item.lastAttempt;
          }
          
          // If too many attempts, remove from queue
          if (item.attempts >= 3) {
            const index = queue.findIndex(m => m.trackingId === item.trackingId);
            if (index >= 0) {
              queue.splice(index, 1);
              processed++;
              
              log.warn(`Removed message ${item.trackingId} after ${item.attempts} failed delivery attempts`);
            }
          }
        }
      }
      
      if (processed > 0) {
        log.debug(`Processed ${processed} messages for recipient ${recipientId}, ${queue.length} remaining`);
      }
      
      // Return true if there are more messages to process
      return queue.length > 0;
    };
    
    // Process batches until queue is empty
    let hasMore = true;
    while (hasMore) {
      hasMore = await processBatch();
      
      // Add a small delay between batches
      if (hasMore) {
        await sleep(QUEUE_PROCESSING_DELAY);
      }
    }
    
    log.debug(`Queue processor completed for recipient ${recipientId}`);
  }
  
  /**
   * Deliver a single message to a recipient
   * @param {string} recipientId Recipient user ID
   * @param {Object} item Queued message item
   * @returns {Object} Result with delivered status
   * @private
   */
  async _deliverMessage(recipientId, item) {
    // This is a placeholder - actual implementation would use
    // the appropriate delivery mechanism (emit to socket, store in db, etc.)
    // Will be implemented by the MessageService class
    
    return {
      delivered: false,
      item
    };
  }
  
  /**
   * Register a message delivery handler
   * @param {Function} deliveryHandler Function that handles actual message delivery
   */
  registerDeliveryHandler(deliveryHandler) {
    if (typeof deliveryHandler === 'function') {
      this._deliverMessage = deliveryHandler;
      log.info("Registered message delivery handler");
    }
  }
  
  /**
   * Get the status of a queued message
   * @param {string} trackingId Message tracking ID
   * @returns {Object} Message status
   */
  getStatus(trackingId) {
    return this.deliveryStatus.get(trackingId) || null;
  }
  
  /**
   * Get all queued messages for a recipient
   * @param {string} recipientId Recipient user ID
   * @returns {Array} Queued messages
   */
  getQueuedMessages(recipientId) {
    return this.queues.get(recipientId) || [];
  }
  
  /**
   * Get queue statistics
   * @returns {Object} Queue statistics
   */
  getStats() {
    let totalQueued = 0;
    let highPriority = 0;
    let normalPriority = 0;
    let lowPriority = 0;
    
    for (const queue of this.queues.values()) {
      totalQueued += queue.length;
      highPriority += queue.filter(m => m.priority === MESSAGE_PRIORITY.HIGH).length;
      normalPriority += queue.filter(m => m.priority === MESSAGE_PRIORITY.NORMAL).length;
      lowPriority += queue.filter(m => m.priority === MESSAGE_PRIORITY.LOW).length;
    }
    
    return {
      totalQueued,
      highPriority,
      normalPriority,
      lowPriority,
      queueCount: this.queues.size,
      activeProcessors: this.activeProcessors.size
    };
  }
  
  /**
   * Clear all queues
   */
  clearAll() {
    this.queueManager.clear();
    this.statusManager.clear();
    this.activeProcessors.clear();
    
    log.info("Cleared all message queues");
  }
  
  /**
   * Destroy the message queue
   */
  destroy() {
    this.queueManager.destroy();
    this.statusManager.destroy();
    this.activeProcessors.clear();
    
    log.info("MessageQueue destroyed");
  }
}

/**
 * Wrapper for objectId validation
 * @param {string} id ID to validate
 * @returns {mongoose.Types.ObjectId|null} Validated ObjectId or null
 */
function safeObjectId(id) {
  try {
    return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
  } catch {
    return null;
  }
}

/**
 * Enhanced messaging service with reliability and queuing
 */
class EnhancedMessagingService {
  /**
   * Create a new enhanced messaging service
   * @param {Object} io Socket.IO server instance
   * @param {Map} userConnections Map of user connections
   * @param {Object} options Configuration options
   */
  constructor(io, userConnections, options = {}) {
    this.io = io;
    this.userConnections = userConnections;
    
    // Configuration
    this.config = {
      // Whether to use the message queue for reliability
      useMessageQueue: options.useMessageQueue !== undefined ? options.useMessageQueue : true,
      
      // Whether to enable message batching for efficiency
      enableBatching: options.enableBatching !== undefined ? options.enableBatching : true,
      
      // Batch size for bulk message delivery
      batchSize: options.batchSize || 10,
      
      // How often to send status updates for queued messages (ms)
      statusUpdateInterval: options.statusUpdateInterval || 5000,
      
      // Whether to store read/typing events in DB
      persistReadReceipts: options.persistReadReceipts !== undefined ? options.persistReadReceipts : true,
      
      // Whether to deduplicate messages
      deduplicateMessages: options.deduplicateMessages !== undefined ? options.deduplicateMessages : true
    };
    
    // Initialize message queue
    this.messageQueue = new MessageQueue();
    
    // Register delivery handler if queue is enabled
    if (this.config.useMessageQueue) {
      this.messageQueue.registerDeliveryHandler(this._deliverMessage.bind(this));
    }
    
    // Set up deduplication tracking with memory manager
    this.deduplicationManager = new MemoryManager({
      maxAge: 15 * 60 * 1000,     // 15 minutes for deduplication
      maxSize: 50000,             // 50k messages
      cleanupInterval: 5 * 60 * 1000,
      useWeakRefs: false
    });
    
    // Wrapper for backward compatibility
    this.processedMessages = {
      has: (key) => this.deduplicationManager.get(key) !== undefined,
      add: (key) => this.deduplicationManager.set(key, true, { ttl: 15 * 60 * 1000 })
    };
    
    // Status update interval
    if (this.config.statusUpdateInterval > 0) {
      this._statusInterval = setInterval(() => {
        this._sendQueuedMessageStatus();
      }, this.config.statusUpdateInterval).unref();
    }
    
    log.info(`EnhancedMessagingService initialized with queue=${this.config.useMessageQueue}, batching=${this.config.enableBatching}`);
  }
  
  /**
   * Register all messaging handlers on a socket
   * @param {Object} socket Socket.IO socket
   * @param {Object} rateLimiters Rate limiters
   */
  registerHandlers(socket, rateLimiters) {
    const { typingLimiter, messageLimiter } = rateLimiters;
    
    // Register enhanced message handler
    socket.on(EVENTS.SEND_MESSAGE, async (data) => {
      try {
        // Basic validation
        if (!socket.user?._id) {
          return socket.emit(EVENTS.MESSAGE_ERROR, { 
            error: "Not authenticated", 
            tempMessageId: data.tempMessageId || null 
          });
        }
        
        // Apply rate limiting
        try {
          await messageLimiter.consume(socket.user._id.toString());
        } catch (err) {
          return socket.emit(EVENTS.MESSAGE_ERROR, {
            error: "Rate limit exceeded",
            tempMessageId: data.tempMessageId || null
          });
        }
        
        // Process the message
        await this.handleSendMessage(socket, data);
      } catch (err) {
        log.error(`Error in sendMessage handler: ${err.message}`);
        socket.emit(EVENTS.MESSAGE_ERROR, { 
          error: "Internal server error", 
          tempMessageId: data.tempMessageId || null 
        });
      }
    });
    
    // Register typing handler
    socket.on(EVENTS.TYPING, async (data) => {
      try {
        const { recipientId } = data;
        if (!socket.user?._id || !recipientId) return;
        
        // Apply rate limiting for typing
        try {
          await typingLimiter.consume(socket.user._id.toString());
        } catch {
          return; // Silently drop if rate limited
        }
        
        this.handleTypingIndicator(socket, data);
      } catch (err) {
        log.error(`Error in typing handler: ${err.message}`);
      }
    });
    
    // Register read receipt handler
    socket.on(EVENTS.MESSAGE_READ, async (data) => {
      try {
        if (!socket.user?._id) return;
        
        this.handleMessageRead(socket, data);
      } catch (err) {
        log.error(`Error in messageRead handler: ${err.message}`);
      }
    });
    
    // Register bulk message handler
    if (this.config.enableBatching) {
      socket.on(EVENTS.BULK_MESSAGES, async (data) => {
        try {
          if (!socket.user?._id) return;
          
          this.handleBulkMessages(socket, data);
        } catch (err) {
          log.error(`Error in bulkMessages handler: ${err.message}`);
        }
      });
    }
  }
  
  /**
   * Handle send message request
   * @param {Object} socket Socket.IO socket
   * @param {Object} data Message data
   */
  async handleSendMessage(socket, data) {
    const { recipientId, type, content, metadata, tempMessageId } = data;
    const senderId = socket.user._id.toString();
    
    log.debug(`Processing sendMessage from ${senderId} to ${recipientId} (type: ${type})`);
    
    // Validate recipient
    const recOid = safeObjectId(recipientId);
    if (!recOid) {
      socket.emit(EVENTS.MESSAGE_ERROR, { error: "Invalid recipient", tempMessageId });
      return;
    }
    
    // Load recipient and sender
    const [recipientDoc, senderDoc] = await Promise.all([
      User.findById(recOid),
      User.findById(senderId)
    ]);
    
    if (!recipientDoc) {
      socket.emit(EVENTS.MESSAGE_ERROR, { error: "Recipient not found", tempMessageId });
      return;
    }
    
    // Check blocking
    const isBlockedByRecipient = typeof recipientDoc.hasBlocked === "function" && 
                                 await recipientDoc.hasBlocked(senderId);
    
    const isBlockingSender = typeof senderDoc.hasBlocked === "function" && 
                             await senderDoc.hasBlocked(recipientId);
    
    if (isBlockedByRecipient) {
      socket.emit(EVENTS.MESSAGE_ERROR, { error: "You are blocked", tempMessageId });
      return;
    }
    
    if (isBlockingSender) {
      socket.emit(EVENTS.MESSAGE_ERROR, { error: "You have blocked this user", tempMessageId });
      return;
    }
    
    // Check permissions
    if (
      type !== "wink" &&
      (senderDoc.accountTier === "FREE" || (typeof senderDoc.canSendMessages === "function" && !senderDoc.canSendMessages()))
    ) {
      socket.emit(EVENTS.MESSAGE_ERROR, {
        error: "Upgrade to send messages",
        tempMessageId
      });
      return;
    }
    
    // Save message to database
    const msg = await new Message({
      sender: senderId,
      recipient: recOid,
      type,
      content,
      metadata: {
        ...metadata,
        clientMsgId: tempMessageId
      },
      read: false,
      createdAt: new Date()
    }).save();
    
    // Prepare response object
    const response = {
      _id: msg._id.toString(),
      sender: senderId,
      recipient: recOid.toString(),
      type,
      content,
      metadata: {
        ...metadata,
        clientMsgId: tempMessageId
      },
      createdAt: msg.createdAt,
      read: false,
      tempMessageId
    };
    
    // Send confirmation to sender
    socket.emit(EVENTS.MESSAGE_SENT, response);
    
    // Deliver to recipient
    await this.deliverMessageToRecipient(recipientDoc._id.toString(), response, socket.user);
    
    log.info(`Message ${msg._id} sent from ${senderId} to ${recipientId} (type: ${type})`);
  }
  
  /**
   * Deliver a message to a recipient
   * @param {string} recipientId Recipient user ID
   * @param {Object} message Message object
   * @param {Object} sender Sender user object
   */
  async deliverMessageToRecipient(recipientId, message, sender) {
    // Check if user is online
    const isOnline = this.userConnections.has(recipientId) && 
                     this.userConnections.get(recipientId).size > 0;
    
    if (isOnline) {
      // Direct delivery to all recipient sockets
      const recipientSockets = this.userConnections.get(recipientId);
      for (const socketId of recipientSockets) {
        try {
          this.io.to(socketId).emit(EVENTS.MESSAGE_RECEIVED, message);
        } catch (err) {
          log.error(`Error sending to socket ${socketId}: ${err.message}`);
        }
      }
      
      log.debug(`Delivered message ${message._id} directly to ${recipientSockets.size} sockets`);
    } else if (this.config.useMessageQueue) {
      // Queue for later delivery
      const trackingId = this.messageQueue.enqueue(
        recipientId,
        message,
        MESSAGE_PRIORITY.NORMAL,
        { sender }
      );
      
      log.debug(`Queued message ${message._id} for offline recipient ${recipientId} with tracking ID ${trackingId}`);
    }
    
    // Create notification
    try {
      await this.createMessageNotification(sender, { _id: recipientId }, message);
    } catch (err) {
      log.error(`Error creating notification: ${err.message}`);
    }
  }
  
  /**
   * Handle typing indicator
   * @param {Object} socket Socket.IO socket
   * @param {Object} data Typing data
   */
  async handleTypingIndicator(socket, data) {
    const senderId = socket.user._id.toString();
    const { recipientId } = data;
    
    if (!recipientId) return;
    
    // Check if recipient is online
    const recipientSockets = this.userConnections.get(recipientId);
    if (!recipientSockets || recipientSockets.size === 0) {
      // No need to send typing to offline users
      return;
    }
    
    // Send typing indicator to all recipient sockets
    for (const socketId of recipientSockets) {
      this.io.to(socketId).emit(EVENTS.USER_TYPING, {
        userId: senderId,
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Handle message read status
   * @param {Object} socket Socket.IO socket
   * @param {Object} data Read receipt data
   */
  async handleMessageRead(socket, data) {
    const { messageIds = [], sender } = data;
    if (!Array.isArray(messageIds) || messageIds.length === 0 || !sender) return;
    
    const senderOid = safeObjectId(sender);
    const readerOid = safeObjectId(socket.user?._id);
    if (!senderOid || !readerOid) return;
    
    // Validate message IDs
    const validIds = messageIds
      .map(safeObjectId)
      .filter(id => id !== null);
    
    if (validIds.length === 0) return;
    
    // Update message read status in DB
    const updateResult = await Message.updateMany(
      { _id: { $in: validIds }, sender: senderOid, recipient: readerOid },
      { $set: { read: true, readAt: new Date() } }
    );
    
    log.debug(`Marked ${updateResult.modifiedCount} messages as read by ${readerOid}`);
    
    // Notify original sender
    const senderSockets = this.userConnections.get(senderOid.toString());
    if (senderSockets && senderSockets.size > 0) {
      for (const socketId of senderSockets) {
        this.io.to(socketId).emit(EVENTS.MESSAGES_READ, {
          reader: readerOid.toString(),
          messageIds: validIds.map(id => id.toString()),
          timestamp: Date.now()
        });
      }
    }
  }
  
  /**
   * Handle bulk messages
   * @param {Object} socket Socket.IO socket
   * @param {Object} data Bulk messages data
   */
  async handleBulkMessages(socket, data) {
    const { messages, conversationId } = data;
    if (!Array.isArray(messages) || messages.length === 0 || !conversationId) return;
    
    // Verify this user is a participant in the conversation
    const userId = socket.user._id.toString();
    if (!this._verifyConversationAccess(userId, conversationId)) {
      log.warn(`User ${userId} attempted to access unauthorized conversation ${conversationId}`);
      return;
    }
    
    // Filter messages that belong to this conversation
    const validMessages = messages.filter(msg => 
      (msg.sender === userId && msg.recipient === conversationId) ||
      (msg.sender === conversationId && msg.recipient === userId)
    );
    
    // Send the bulk message response
    socket.emit(EVENTS.BULK_MESSAGES, {
      conversationId,
      messages: validMessages,
      timestamp: Date.now()
    });
  }
  
  /**
   * Create a notification for a message
   * @param {Object} sender Sender user
   * @param {Object} recipient Recipient user
   * @param {Object} message Message object
   */
  async createMessageNotification(sender, recipient, message) {
    try {
      // Check if recipient has notifications enabled
      const recipientDoc = await User
        .findById(recipient._id)
        .select("settings socketId")
        .lean();
      
      if (!recipientDoc) return;
      
      // Check if recipient has message notifications enabled
      if (recipientDoc.settings?.notifications?.messages === false) {
        return;
      }
      
      // Create notification in database
      await Notification.create({
        recipient: recipient._id,
        type: "message",
        sender: sender._id,
        content: message.content,
        reference: message._id,
        title: `New message from ${sender.nickname || sender.username || "User"}`,
        data: { message }
      });
      
      log.debug(`Created message notification for recipient ${recipient._id}`);
    } catch (err) {
      log.error(`Error creating message notification: ${err.message}`);
    }
  }
  
  /**
   * Verify that a user has access to a conversation
   * @param {string} userId User ID
   * @param {string} conversationId Conversation (other user) ID
   * @returns {boolean} Whether user has access
   * @private
   */
  _verifyConversationAccess(userId, conversationId) {
    // In this simple implementation, a conversation is just 1:1 between users
    // For a more complex system with group chats, this would check group membership
    return true;
  }
  
  /**
   * Message delivery implementation for the message queue
   * @param {string} recipientId Recipient user ID
   * @param {Object} item Queued message item
   * @returns {Object} Delivery result
   * @private
   */
  async _deliverMessage(recipientId, item) {
    const { message, sender } = item;
    
    // Check if recipient is now online
    const isOnline = this.userConnections.has(recipientId) && 
                     this.userConnections.get(recipientId).size > 0;
    
    if (!isOnline) {
      // Recipient still offline, cannot deliver
      return { delivered: false, item };
    }
    
    // Deliver to all recipient sockets
    const recipientSockets = this.userConnections.get(recipientId);
    let deliveredCount = 0;
    
    for (const socketId of recipientSockets) {
      try {
        this.io.to(socketId).emit(EVENTS.MESSAGE_RECEIVED, message);
        deliveredCount++;
      } catch (err) {
        log.error(`Error delivering queued message to socket ${socketId}: ${err.message}`);
      }
    }
    
    const delivered = deliveredCount > 0;
    
    if (delivered) {
      log.debug(`Delivered queued message ${message._id} to ${deliveredCount} sockets for recipient ${recipientId}`);
    }
    
    return { delivered, item };
  }
  
  /**
   * Send status updates about queued messages to users
   * @private
   */
  _sendQueuedMessageStatus() {
    // This sends periodic updates about queued messages to online users
    for (const [userId, socketIds] of this.userConnections.entries()) {
      // Check if user has sent messages in queue
      let pendingMessageCount = 0;
      
      // Count queued messages where this user is the sender
      for (const [recipientId, queue] of this.messageQueue.queues.entries()) {
        for (const item of queue) {
          if (item.message.sender === userId) {
            pendingMessageCount++;
          }
        }
      }
      
      if (pendingMessageCount > 0) {
        // Send status update to all user sockets
        for (const socketId of socketIds) {
          try {
            this.io.to(socketId).emit(EVENTS.MESSAGE_STATUS, {
              pendingCount: pendingMessageCount,
              timestamp: Date.now()
            });
          } catch (err) {
            // Ignore errors
          }
        }
      }
    }
  }
  
  /**
   * Get queue statistics
   * @returns {Object} Queue statistics
   */
  getQueueStats() {
    return this.messageQueue.getStats();
  }
  
  /**
   * Destroy the messaging service
   */
  destroy() {
    if (this._statusInterval) {
      clearInterval(this._statusInterval);
      this._statusInterval = null;
    }
    
    // Destroy memory managers
    this.messageQueue.destroy();
    this.deduplicationManager.destroy();
    
    log.info("EnhancedMessagingService destroyed");
  }
}

export {
  EnhancedMessagingService,
  MessageQueue,
  MESSAGE_PRIORITY,
  EVENTS
};