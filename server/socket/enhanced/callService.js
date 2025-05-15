// server/socket/enhanced/callService.js
// Enhanced call handling with improved reliability and diagnostics

import { User } from "../../models/index.js";
import logger from "../../logger.js";
import mongoose from "mongoose";
import MemoryManager from "./memory-manager.js";

// Create a logger instance for the call service
const log = {
  info: (...args) => console.log("[socket:enhanced:call]", ...args),
  error: (...args) => console.error("[socket:enhanced:call]", ...args),
  warn: (...args) => console.warn("[socket:enhanced:call]", ...args),
  debug: (...args) => console.debug("[socket:enhanced:call]", ...args)
};

// Call event names
const CALL_EVENTS = {
  INITIATE_CALL:        "initiateCall",
  CALL_INITIATED:       "callInitiated",
  INCOMING_CALL:        "incomingCall",
  CALL_ERROR:           "callError",
  ANSWER_CALL:          "answerCall",
  CALL_ANSWERED:        "callAnswered",
  VIDEO_SIGNAL:         "videoSignal",
  PEER_ID_EXCHANGE:     "peerIdExchange",
  VIDEO_HANGUP:         "videoHangup",
  VIDEO_MEDIA_CONTROL:  "videoMediaControl",
  VIDEO_ERROR:          "videoError",
  CALL_STATS:           "callStats",      // New: detailed call statistics
  CALL_DIAGNOSTICS:     "callDiagnostics" // New: call diagnostics info
};

/**
 * Validate that a string is a valid Mongo ObjectId
 * @param {string} id ID to validate
 * @returns {boolean} Whether ID is valid
 */
function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Enhanced call service with improved reliability and diagnostics
 */
class EnhancedCallService {
  /**
   * Create a new enhanced call service
   * @param {Object} io Socket.IO server instance
   * @param {Map} userConnections Map of user connections
   * @param {Object} options Configuration options
   */
  constructor(io, userConnections, options = {}) {
    this.io = io;
    this.userConnections = userConnections;
    
    // Configuration
    this.config = {
      // Maximum retry attempts for call signals
      maxRetryAttempts: options.maxRetryAttempts || 5,
      
      // Delay between retry attempts in ms
      retryDelay: options.retryDelay || 800,
      
      // Whether to collect call statistics
      collectStats: options.collectStats !== undefined ? options.collectStats : true,
      
      // Whether to enable diagnostic info
      enableDiagnostics: options.enableDiagnostics !== undefined ? options.enableDiagnostics : true,
      
      // How long to keep call records after they end (ms)
      callRecordTTL: options.callRecordTTL || 30 * 60 * 1000, // 30 minutes
      
      // Maximum allowed call duration (ms)
      maxCallDuration: options.maxCallDuration || 4 * 60 * 60 * 1000 // 4 hours
    };
    
    // Use memory manager for active calls
    this.callManager = new MemoryManager({
      maxAge: 4 * 60 * 60 * 1000,  // 4 hours max call duration
      maxSize: 5000,               // 5k concurrent calls max
      cleanupInterval: 5 * 60 * 1000, // 5 minute cleanup
      useWeakRefs: false
    });
    
    // Wrapper for backward compatibility
    this.activeCalls = {
      has: (key) => this.callManager.get(key) !== undefined,
      get: (key) => this.callManager.get(key),
      set: (key, value) => {
        // Calculate TTL based on call status
        const ttl = value.status === 'ended' ? 30 * 60 * 1000 : 4 * 60 * 60 * 1000;
        const references = [value.callerId, value.recipientId].filter(Boolean);
        this.callManager.set(key, value, { ttl, references });
      },
      delete: (key) => this.callManager.delete(key),
      entries: () => this.callManager.data.entries(),
      values: () => this.callManager.data.values(),
      get size() { return this.callManager.data.size; }
    };
    
    // Call statistics
    this.stats = {
      callsInitiated: 0,
      callsAnswered: 0,
      callsRejected: 0,
      callsDropped: 0,
      callsFailed: 0,
      callsByType: {
        audio: 0,
        video: 0
      },
      signalFailures: 0,
      averageDuration: 0,
      totalDuration: 0,
      completedCalls: 0,
      signalsSent: 0
    };
    
    // Set up cleanup interval
    this._cleanupInterval = setInterval(() => {
      this._cleanupEndedCalls();
    }, 10 * 60 * 1000).unref(); // Every 10 minutes
    
    log.info("EnhancedCallService initialized");
  }
  
  /**
   * Register all call handlers on a socket
   * @param {Object} socket Socket.IO socket
   * @param {Object} rateLimiters Rate limiters
   */
  registerHandlers(socket, rateLimiters) {
    const { callLimiter } = rateLimiters;
    
    // Register call initialization
    socket.on(CALL_EVENTS.INITIATE_CALL, async (data) => {
      try {
        if (!socket.user?._id) {
          return socket.emit(CALL_EVENTS.CALL_ERROR, { 
            error: "Not authenticated"
          });
        }
        
        // Apply rate limiting
        try {
          await callLimiter.consume(socket.user._id.toString());
        } catch (err) {
          log.warn(`Call rate limit exceeded for ${socket.user._id}`);
          return socket.emit(CALL_EVENTS.CALL_ERROR, { 
            error: "Rate limit exceeded, please try again later"
          });
        }
        
        await this.handleInitiateCall(socket, data);
      } catch (err) {
        log.error(`Error in initiateCall handler: ${err.message}`);
        socket.emit(CALL_EVENTS.CALL_ERROR, { 
          error: "Failed to initiate call"
        });
      }
    });
    
    // Register call answer
    socket.on(CALL_EVENTS.ANSWER_CALL, async (data) => {
      try {
        if (!socket.user?._id) return;
        
        await this.handleAnswerCall(socket, data);
      } catch (err) {
        log.error(`Error in answerCall handler: ${err.message}`);
      }
    });
    
    // Register video signal
    socket.on(CALL_EVENTS.VIDEO_SIGNAL, async (data) => {
      try {
        if (!socket.user?._id) return;
        
        await this.handleVideoSignal(socket, data);
      } catch (err) {
        log.error(`Error in videoSignal handler: ${err.message}`);
        socket.emit(CALL_EVENTS.VIDEO_ERROR, { 
          error: "Failed to process video signal"
        });
      }
    });
    
    // Register peer ID exchange
    socket.on(CALL_EVENTS.PEER_ID_EXCHANGE, async (data) => {
      try {
        if (!socket.user?._id) return;
        
        await this.handlePeerIdExchange(socket, data);
      } catch (err) {
        log.error(`Error in peerIdExchange handler: ${err.message}`);
        socket.emit(CALL_EVENTS.VIDEO_ERROR, { 
          error: "Failed to exchange peer ID"
        });
      }
    });
    
    // Register video hangup
    socket.on(CALL_EVENTS.VIDEO_HANGUP, async (data) => {
      try {
        if (!socket.user?._id) return;
        
        await this.handleVideoHangup(socket, data);
      } catch (err) {
        log.error(`Error in videoHangup handler: ${err.message}`);
      }
    });
    
    // Register media control
    socket.on(CALL_EVENTS.VIDEO_MEDIA_CONTROL, async (data) => {
      try {
        if (!socket.user?._id) return;
        
        await this.handleMediaControl(socket, data);
      } catch (err) {
        log.error(`Error in videoMediaControl handler: ${err.message}`);
      }
    });
    
    // Register call stats
    if (this.config.collectStats) {
      socket.on(CALL_EVENTS.CALL_STATS, async (data) => {
        try {
          if (!socket.user?._id) return;
          
          this.handleCallStats(socket, data);
        } catch (err) {
          log.error(`Error in callStats handler: ${err.message}`);
        }
      });
    }
  }
  
  /**
   * Handle call initiation
   * @param {Object} socket Socket.IO socket
   * @param {Object} data Call data
   */
  async handleInitiateCall(socket, data) {
    const { recipientId, callType, callId = `call-${Date.now()}` } = data;
    const callerId = socket.user._id.toString();
    
    // Validate recipient ID
    if (!isValidId(recipientId)) {
      socket.emit(CALL_EVENTS.CALL_ERROR, { error: "Invalid recipient ID" });
      return;
    }
    
    // Fetch recipient
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      socket.emit(CALL_EVENTS.CALL_ERROR, { error: "Recipient not found" });
      return;
    }
    
    // Check account tier for video calls
    const caller = await User.findById(callerId);
    if (callType === "video" && caller.accountTier === "FREE") {
      socket.emit(CALL_EVENTS.CALL_ERROR, { error: "Upgrade required for video calls" });
      return;
    }
    
    log.info(`Call initiated from ${callerId} to ${recipientId} (type: ${callType}, id: ${callId})`);
    
    // Create call record
    const callData = {
      callId,
      callType,
      callerId,
      recipientId,
      callerSocketId: socket.id,
      startTime: Date.now(),
      status: "initiating",
      caller: {
        userId: callerId,
        name: caller.nickname || caller.username || "User",
        photo: caller.photos?.[0]?.url || null,
      },
      recipient: {
        userId: recipientId,
        name: recipient.nickname || recipient.username || "User"
      },
      signals: {
        sent: 0,
        received: 0,
        failed: 0
      },
      diagnostics: {},
      retries: 0
    };
    
    // Store call data
    this.activeCalls.set(callId, callData);
    
    // Update statistics
    this.stats.callsInitiated++;
    this.stats.callsByType[callType] = (this.stats.callsByType[callType] || 0) + 1;
    
    // Deliver call to recipient
    const delivered = await this._deliverCallEvent(
      recipientId,
      CALL_EVENTS.INCOMING_CALL,
      {
        callId,
        callType,
        userId: callerId,
        caller: callData.caller,
        timestamp: Date.now()
      },
      callData,
      socket.id
    );
    
    if (delivered) {
      // Update call status
      callData.status = "ringing";
      this.activeCalls.set(callId, callData);
      
      // Send confirmation to caller
      socket.emit(CALL_EVENTS.CALL_INITIATED, {
        success: true,
        recipientId,
        callId,
        timestamp: Date.now()
      });
      
      // Set up call timeout
      this._setCallTimeout(callId);
    } else {
      // Call failed to deliver
      callData.status = "failed";
      this.activeCalls.set(callId, callData);
      
      // Update statistics
      this.stats.callsFailed++;
      
      socket.emit(CALL_EVENTS.CALL_ERROR, {
        error: "Recipient is unavailable",
        callId,
        recipientId
      });
      
      // Schedule call data removal
      setTimeout(() => {
        this.activeCalls.delete(callId);
      }, 60000); // 1 minute
    }
  }
  
  /**
   * Handle call answer
   * @param {Object} socket Socket.IO socket
   * @param {Object} data Answer data
   */
  async handleAnswerCall(socket, data) {
    const { callerId, accept, callId } = data;
    const answererId = socket.user._id.toString();
    
    // Validate data
    if (!isValidId(callerId) || !callId) {
      log.warn(`Invalid answerCall data from ${answererId}`);
      return;
    }
    
    log.info(`Call ${callId} ${accept ? 'accepted' : 'rejected'} by ${answererId}`);
    
    // Get call data
    const callData = this.activeCalls.get(callId);
    if (!callData) {
      log.warn(`Call ${callId} not found or expired`);
      return;
    }
    
    // Verify this user is the recipient
    if (callData.recipientId !== answererId) {
      log.warn(`User ${answererId} attempted to answer call ${callId} intended for ${callData.recipientId}`);
      return;
    }
    
    // Update call status
    callData.status = accept ? "accepted" : "rejected";
    callData.answerTime = Date.now();
    this.activeCalls.set(callId, callData);
    
    // Update statistics
    if (accept) {
      this.stats.callsAnswered++;
    } else {
      this.stats.callsRejected++;
    }
    
    // Notify caller
    await this._deliverCallEvent(
      callerId,
      CALL_EVENTS.CALL_ANSWERED,
      {
        userId: answererId,
        accept,
        callId,
        timestamp: Date.now()
      },
      callData,
      socket.id
    );
    
    // If rejected, schedule removal of call data
    if (!accept) {
      setTimeout(() => {
        this.activeCalls.delete(callId);
      }, 60000); // 1 minute
    }
  }
  
  /**
   * Handle video signal
   * @param {Object} socket Socket.IO socket
   * @param {Object} data Signal data
   */
  async handleVideoSignal(socket, data) {
    const { recipientId, signal, from, callId } = data;
    const senderId = socket.user._id.toString();
    
    // Validate data
    if (!isValidId(recipientId) || !signal) {
      socket.emit(CALL_EVENTS.VIDEO_ERROR, { error: "Invalid signal data" });
      return;
    }
    
    log.debug(`Video signal from ${senderId} → ${recipientId}`);
    
    // Track in statistics
    this.stats.signalsSent++;
    
    // Update call data if available
    const callData = callId ? this.activeCalls.get(callId) : null;
    if (callData) {
      callData.signals.sent++;
      callData.lastActivity = Date.now();
      this.activeCalls.set(callId, callData);
    }
    
    // Send the signal
    const delivered = await this._deliverCallEvent(
      recipientId,
      CALL_EVENTS.VIDEO_SIGNAL,
      {
        signal,
        userId: senderId,
        callId,
        from: from || {
          userId: senderId,
          name: socket.user.nickname || "User",
        },
        timestamp: Date.now()
      },
      callData,
      socket.id
    );
    
    if (!delivered) {
      socket.emit(CALL_EVENTS.VIDEO_ERROR, {
        error: "Failed to deliver signal",
        recipientId
      });
      
      // Update call statistics
      if (callData) {
        callData.signals.failed++;
        this.activeCalls.set(callId, callData);
      }
      
      this.stats.signalFailures++;
    }
  }
  
  /**
   * Handle peer ID exchange
   * @param {Object} socket Socket.IO socket
   * @param {Object} data Peer ID data
   */
  async handlePeerIdExchange(socket, data) {
    const { recipientId, peerId, from, isFallback, callId } = data;
    const senderId = socket.user._id.toString();
    
    // Validate data
    if (!isValidId(recipientId) || !peerId) {
      socket.emit(CALL_EVENTS.VIDEO_ERROR, { error: "Invalid peer ID data" });
      return;
    }
    
    log.debug(`Peer ID exchange from ${senderId} → ${recipientId}`);
    
    // Update call data if available
    const callData = callId ? this.activeCalls.get(callId) : null;
    if (callData) {
      callData.lastActivity = Date.now();
      this.activeCalls.set(callId, callData);
    }
    
    // Send the peer ID
    const delivered = await this._deliverCallEvent(
      recipientId,
      CALL_EVENTS.PEER_ID_EXCHANGE,
      {
        peerId,
        userId: senderId,
        callId,
        from: from || { userId: senderId, name: socket.user.nickname || "User" },
        isFallback: Boolean(isFallback),
        timestamp: Date.now()
      },
      callData,
      socket.id
    );
    
    if (!delivered) {
      socket.emit(CALL_EVENTS.VIDEO_ERROR, {
        error: "Failed to deliver peer ID",
        recipientId
      });
    }
  }
  
  /**
   * Handle video hangup
   * @param {Object} socket Socket.IO socket
   * @param {Object} data Hangup data
   */
  async handleVideoHangup(socket, data) {
    const { recipientId, callId } = data;
    const senderId = socket.user._id.toString();
    
    // Validate data
    if (!isValidId(recipientId)) {
      return;
    }
    
    log.debug(`Video hangup from ${senderId} → ${recipientId}`);
    
    // Update call data
    const callData = callId ? this.activeCalls.get(callId) : null;
    if (callData) {
      callData.status = "ended";
      callData.endTime = Date.now();
      callData.endedBy = senderId;
      this.activeCalls.set(callId, callData);
      
      // Update statistics
      if (callData.status === "accepted") {
        const duration = callData.endTime - callData.answerTime;
        this.stats.totalDuration += duration;
        this.stats.completedCalls++;
        this.stats.averageDuration = this.stats.totalDuration / this.stats.completedCalls;
      } else {
        this.stats.callsDropped++;
      }
    }
    
    // Send hangup signal
    await this._deliverCallEvent(
      recipientId,
      CALL_EVENTS.VIDEO_HANGUP,
      {
        userId: senderId,
        callId,
        timestamp: Date.now()
      },
      callData,
      socket.id
    );
  }
  
  /**
   * Handle media control
   * @param {Object} socket Socket.IO socket
   * @param {Object} data Media control data
   */
  async handleMediaControl(socket, data) {
    const { recipientId, type, muted, callId } = data;
    const senderId = socket.user._id.toString();
    
    // Validate data
    if (!isValidId(recipientId) || !["audio", "video"].includes(type)) {
      return;
    }
    
    log.debug(`Media control (${type}:${muted}) from ${senderId} → ${recipientId}`);
    
    // Update call data
    const callData = callId ? this.activeCalls.get(callId) : null;
    if (callData) {
      callData.lastActivity = Date.now();
      
      // Track media states
      callData.mediaState = callData.mediaState || {};
      callData.mediaState[senderId] = callData.mediaState[senderId] || {};
      callData.mediaState[senderId][type] = muted;
      
      this.activeCalls.set(callId, callData);
    }
    
    // Send media control signal
    await this._deliverCallEvent(
      recipientId,
      CALL_EVENTS.VIDEO_MEDIA_CONTROL,
      {
        userId: senderId,
        callId,
        type,
        muted,
        timestamp: Date.now()
      },
      callData,
      socket.id
    );
  }
  
  /**
   * Handle call stats from client
   * @param {Object} socket Socket.IO socket
   * @param {Object} data Call stats data
   */
  handleCallStats(socket, data) {
    const { callId, stats } = data;
    if (!callId || !stats) return;
    
    const callData = this.activeCalls.get(callId);
    if (!callData) return;
    
    // Update call diagnostics
    callData.diagnostics = {
      ...callData.diagnostics,
      clientStats: stats
    };
    
    this.activeCalls.set(callId, callData);
    
    log.debug(`Received call stats for call ${callId}`);
  }
  
  /**
   * Deliver a call event to a recipient with retry logic
   * @param {string} recipientId Recipient user ID
   * @param {string} eventName Event name
   * @param {Object} payload Event payload
   * @param {Object} callData Call data for tracking
   * @param {string} fromSocketId Sender socket ID
   * @returns {boolean} Whether delivery was successful
   * @private
   */
  async _deliverCallEvent(recipientId, eventName, payload, callData, fromSocketId) {
    // Check if recipient is connected
    if (!this.userConnections.has(recipientId)) {
      log.warn(`Cannot deliver ${eventName}: Recipient ${recipientId} is offline`);
      
      if (fromSocketId) {
        this.io.to(fromSocketId).emit(CALL_EVENTS.CALL_ERROR, {
          error: "Recipient is offline",
          event: eventName,
          recipientId
        });
      }
      
      return false;
    }
    
    // Get recipient sockets
    const recipientSockets = this.userConnections.get(recipientId);
    if (recipientSockets.size === 0) {
      log.warn(`Cannot deliver ${eventName}: Recipient ${recipientId} has no active sockets`);
      return false;
    }
    
    // Try to deliver to all sockets with retry logic
    let attempts = 0;
    let delivered = false;
    
    const maxAttempts = this.config.maxRetryAttempts;
    const delay = this.config.retryDelay;
    
    while (attempts < maxAttempts && !delivered) {
      let socketCount = 0;
      
      // Try each socket
      for (const socketId of recipientSockets) {
        try {
          this.io.to(socketId).emit(eventName, payload);
          socketCount++;
        } catch (err) {
          log.error(`Error emitting ${eventName} to socket ${socketId}: ${err.message}`);
        }
      }
      
      // If we delivered to at least one socket, consider it successful
      if (socketCount > 0) {
        delivered = true;
        break;
      }
      
      // Otherwise, retry after delay
      attempts++;
      if (attempts < maxAttempts) {
        log.warn(`Retrying ${eventName} delivery (attempt ${attempts}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Re-fetch the recipient sockets in case they changed
        if (this.userConnections.has(recipientId)) {
          const updatedSockets = this.userConnections.get(recipientId);
          if (updatedSockets.size > 0) {
            recipientSockets = updatedSockets;
          } else {
            // No more sockets, stop retrying
            break;
          }
        } else {
          // Recipient disconnected, stop retrying
          break;
        }
      }
    }
    
    // Update call data with retry information if available
    if (callData && callData.callId) {
      callData.retries = (callData.retries || 0) + (attempts > 0 ? attempts : 0);
      if (!delivered) {
        callData.deliveryFailures = (callData.deliveryFailures || 0) + 1;
      }
    }
    
    // Send error to original sender if delivery failed
    if (!delivered && fromSocketId) {
      this.io.to(fromSocketId).emit(CALL_EVENTS.CALL_ERROR, {
        error: "Failed to reach recipient after multiple attempts",
        event: eventName,
        recipientId
      });
    }
    
    return delivered;
  }
  
  /**
   * Set up timeout for unanswered calls
   * @param {string} callId Call ID
   * @private
   */
  _setCallTimeout(callId) {
    // Auto-end unanswered calls after 60 seconds
    setTimeout(() => {
      const callData = this.activeCalls.get(callId);
      if (callData && callData.status === "ringing") {
        // Call wasn't answered, mark as missed
        callData.status = "missed";
        callData.endTime = Date.now();
        this.activeCalls.set(callId, callData);
        
        // Notify caller that call was missed
        if (callData.callerSocketId) {
          this.io.to(callData.callerSocketId).emit(CALL_EVENTS.CALL_ERROR, {
            error: "Call not answered",
            callId
          });
        }
        
        // Update statistics
        this.stats.callsDropped++;
      }
    }, 60000); // 60 seconds
    
    // Set maximum call duration
    setTimeout(() => {
      const callData = this.activeCalls.get(callId);
      if (callData && (callData.status === "accepted" || callData.status === "ringing")) {
        // Call exceeded maximum duration, force end
        callData.status = "ended";
        callData.endTime = Date.now();
        callData.endReason = "max-duration-exceeded";
        this.activeCalls.set(callId, callData);
        
        // Notify both parties
        if (callData.callerSocketId) {
          this.io.to(callData.callerSocketId).emit(CALL_EVENTS.VIDEO_HANGUP, {
            userId: "system",
            callId,
            reason: "max-duration-exceeded",
            timestamp: Date.now()
          });
        }
        
        const recipientSockets = this.userConnections.get(callData.recipientId);
        if (recipientSockets) {
          for (const socketId of recipientSockets) {
            this.io.to(socketId).emit(CALL_EVENTS.VIDEO_HANGUP, {
              userId: "system",
              callId,
              reason: "max-duration-exceeded",
              timestamp: Date.now()
            });
          }
        }
        
        // Update statistics
        if (callData.status === "accepted" && callData.answerTime) {
          const duration = callData.endTime - callData.answerTime;
          this.stats.totalDuration += duration;
          this.stats.completedCalls++;
          this.stats.averageDuration = this.stats.totalDuration / this.stats.completedCalls;
        } else {
          this.stats.callsDropped++;
        }
      }
    }, this.config.maxCallDuration);
  }
  
  /**
   * Clean up ended calls
   * @private
   */
  _cleanupEndedCalls() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [callId, callData] of this.activeCalls.entries()) {
      // Update status for stale initiating calls
      if (
        callData.status === "initiating" && 
        now - callData.startTime > 120000 // 2 minutes
      ) {
        callData.status = "failed";
        callData.endTime = now;
        callData.endReason = "timed-out";
        this.activeCalls.set(callId, callData);
        cleanedCount++;
      }
      
      // Update status for stale ringing calls
      if (
        callData.status === "ringing" && 
        now - callData.startTime > 90000 // 1.5 minutes
      ) {
        callData.status = "missed";
        callData.endTime = now;
        callData.endReason = "no-answer";
        this.activeCalls.set(callId, callData);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      log.debug(`Updated ${cleanedCount} stale calls`);
    }
    
    // The memory manager handles the actual cleanup based on TTL
  }
  
  /**
   * Get call statistics
   * @returns {Object} Call statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeCalls: this.activeCalls.size
    };
  }
  
  /**
   * Get data for a specific call
   * @param {string} callId Call ID
   * @returns {Object} Call data
   */
  getCallData(callId) {
    return this.activeCalls.get(callId);
  }
  
  /**
   * Get all active calls
   * @returns {Array} Active calls
   */
  getActiveCalls() {
    return Array.from(this.activeCalls.values());
  }
  
  /**
   * Clear and reset statistics
   */
  resetStats() {
    this.stats = {
      callsInitiated: 0,
      callsAnswered: 0,
      callsRejected: 0,
      callsDropped: 0,
      callsFailed: 0,
      callsByType: {
        audio: 0,
        video: 0
      },
      signalFailures: 0,
      averageDuration: 0,
      totalDuration: 0,
      completedCalls: 0,
      signalsSent: 0
    };
    
    log.info("Call statistics reset");
  }
  
  /**
   * Destroy the call service
   */
  destroy() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }
    
    // Destroy memory manager
    this.callManager.destroy();
    
    log.info("EnhancedCallService destroyed");
  }
}

export {
  EnhancedCallService,
  CALL_EVENTS
};