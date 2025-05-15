// server/socket/enhanced/monitoring.js
// Advanced connection monitoring and diagnostics for Socket.IO

import { User } from "../../models/index.js";
import logger from "../../logger.js";
import MemoryManager from "./memory-manager.js";

// Create a logger instance for the monitoring module
const log = {
  info: (...args) => console.log("[socket:monitoring]", ...args),
  error: (...args) => console.error("[socket:monitoring]", ...args),
  warn: (...args) => console.warn("[socket:monitoring]", ...args),
  debug: (...args) => console.debug("[socket:monitoring]", ...args)
};

/**
 * SocketMonitor provides advanced monitoring capabilities for socket connections
 * including connection tracking, health checks, and diagnostics.
 */
class SocketMonitor {
  /**
   * Create a new socket monitor
   * @param {Object} io Socket.IO server instance
   * @param {Map} userConnections Map of user connections
   * @param {Object} options Monitor configuration
   */
  constructor(io, userConnections, options = {}) {
    this.io = io;
    this.userConnections = userConnections;
    
    // Configuration with defaults
    this.config = {
      // How often to check connection health (ms)
      healthCheckInterval: options.healthCheckInterval || 60 * 1000,
      
      // How often to validate online status in DB (ms)
      dbValidationInterval: options.dbValidationInterval || 5 * 60 * 1000,
      
      // How often to collect metrics (ms)
      metricsInterval: options.metricsInterval || 5 * 60 * 1000,
      
      // Inactivity threshold to mark users offline (ms)
      inactivityThreshold: options.inactivityThreshold || 10 * 60 * 1000,
      
      // Maximum socket age before forced reconnection (ms)
      maxSocketAge: options.maxSocketAge || 12 * 60 * 60 * 1000, // 12 hours
      
      // Whether to track detailed metrics
      detailedMetrics: options.detailedMetrics !== undefined ? options.detailedMetrics : true,
      
      // Whether to force-disconnect ghost connections
      cleanGhostConnections: options.cleanGhostConnections !== undefined ? options.cleanGhostConnections : true
    };
    
    // Initialize metrics
    this.metrics = {
      totalConnections: 0,
      totalUsers: 0,
      totalMessages: 0,
      connectionsPerUser: {},
      transportTypes: {
        websocket: 0,
        polling: 0,
        unknown: 0
      },
      clientVersions: {},
      connectionErrors: {},
      avgLatency: 0,
      latencySamples: [],
      messageRate: 0,
      startTime: Date.now(),
      // Detailed metrics for periodic reset
      periodMetrics: {
        messageCount: 0,
        connectCount: 0,
        disconnectCount: 0,
        errorCount: 0,
        lastReset: Date.now()
      }
    };
    
    // Track health check results
    this.healthStatus = {
      lastCheck: 0,
      unhealthySockets: 0,
      zombieConnections: 0, 
      ghostUsers: 0,
      latencyIssues: 0
    };
    
    // Use memory manager for heartbeat tracking
    this.heartbeatManager = new MemoryManager({
      maxAge: 5 * 60 * 1000,      // 5 minutes for heartbeats
      maxSize: 50000,             // 50k sockets max
      cleanupInterval: 60 * 1000, // 1 minute cleanup
      useWeakRefs: false
    });
    
    // Use memory manager for connection info
    this.connectionInfoManager = new MemoryManager({
      maxAge: 60 * 60 * 1000,     // 1 hour for connection info
      maxSize: 50000,             // 50k connections max
      cleanupInterval: 5 * 60 * 1000, // 5 minutes cleanup
      useWeakRefs: false
    });
    
    // Wrapper for backward compatibility
    this.heartbeats = {
      has: (key) => this.heartbeatManager.get(key) !== undefined,
      get: (key) => this.heartbeatManager.get(key),
      set: (key, value) => this.heartbeatManager.set(key, value),
      delete: (key) => this.heartbeatManager.delete(key),
      get size() { return this.heartbeatManager.data.size; }
    };
    
    this.connectionInfo = {
      has: (key) => this.connectionInfoManager.get(key) !== undefined,
      get: (key) => this.connectionInfoManager.get(key),
      set: (key, value) => this.connectionInfoManager.set(key, value),
      delete: (key) => this.connectionInfoManager.delete(key),
      get size() { return this.connectionInfoManager.data.size; },
      entries: () => this.connectionInfoManager.data.entries(),
      values: () => this.connectionInfoManager.data.values()
    };
    
    // Setup intervals
    this._setupIntervals();
    
    log.info("Socket monitor initialized with intervals: " +
             `health=${this.config.healthCheckInterval}ms, ` +
             `db=${this.config.dbValidationInterval}ms, ` +
             `metrics=${this.config.metricsInterval}ms`);
  }
  
  /**
   * Set up monitoring intervals
   * @private
   */
  _setupIntervals() {
    // Health check interval
    this._healthCheckInterval = setInterval(
      () => this.runHealthCheck(),
      this.config.healthCheckInterval
    ).unref();
    
    // Online status validation interval
    this._dbValidationInterval = setInterval(
      () => this.validateOnlineUsers(),
      this.config.dbValidationInterval
    ).unref();
    
    // Metrics collection interval
    if (this.config.detailedMetrics) {
      this._metricsInterval = setInterval(
        () => this.collectMetrics(),
        this.config.metricsInterval
      ).unref();
    }
  }
  
  /**
   * Register a new socket connection for monitoring
   * @param {Object} socket Socket.IO socket
   * @param {Object} user User object associated with the socket
   */
  registerSocket(socket, user) {
    if (!socket || !user) return;
    
    // Store connection info
    const userAgent = socket.handshake.headers["user-agent"] || "unknown";
    const transport = socket.conn?.transport?.name || "unknown";
    const clientVersion = socket.handshake.query?.version || "unknown";
    const ip = socket.handshake.address || "0.0.0.0";
    
    const connectionData = {
      userId: user._id.toString(),
      connected: Date.now(),
      lastActivity: Date.now(),
      transport,
      userAgent,
      clientVersion,
      ip,
      pongs: 0,
      lastPong: null,
      latency: [],
      messagesSent: 0,
      messagesReceived: 0
    };
    
    // Use memory manager with references to user
    this.connectionInfoManager.set(socket.id, connectionData, {
      references: [user._id.toString()],
      ttl: 60 * 60 * 1000 // 1 hour TTL
    });
    
    // Init heartbeat monitoring for this socket
    const heartbeatData = {
      lastBeat: Date.now(),
      missed: 0
    };
    
    this.heartbeatManager.set(socket.id, heartbeatData, {
      references: [socket.id],
      ttl: 10 * 60 * 1000 // 10 minute TTL
    });
    
    // Update metrics
    this.metrics.totalConnections++;
    this.metrics.periodMetrics.connectCount++;
    this.metrics.transportTypes[transport] = (this.metrics.transportTypes[transport] || 0) + 1;
    
    if (!this.metrics.clientVersions[clientVersion]) {
      this.metrics.clientVersions[clientVersion] = 0;
    }
    this.metrics.clientVersions[clientVersion]++;
    
    // Set up socket monitoring
    this._setupSocketMonitoring(socket);
    
    log.debug(`Registered socket ${socket.id} for user ${user._id} using ${transport}`);
  }
  
  /**
   * Update socket activity timestamp
   * @param {string} socketId Socket ID
   */
  updateActivity(socketId) {
    const info = this.connectionInfo.get(socketId);
    if (info) {
      info.lastActivity = Date.now();
    }
  }
  
  /**
   * Record a ping/pong exchange
   * @param {string} socketId Socket ID
   * @param {number} latency Latency in ms
   */
  recordPong(socketId, latency) {
    const info = this.connectionInfo.get(socketId);
    if (info) {
      info.pongs++;
      info.lastPong = Date.now();
      info.latency.push(latency);
      
      // Keep only last 10 latency measurements
      if (info.latency.length > 10) {
        info.latency.shift();
      }
      
      // Update heartbeat
      const heartbeat = this.heartbeats.get(socketId);
      if (heartbeat) {
        heartbeat.lastBeat = Date.now();
        heartbeat.missed = 0;
      }
    }
  }
  
  /**
   * Setup monitoring for a specific socket
   * @param {Object} socket Socket.IO socket
   * @private
   */
  _setupSocketMonitoring(socket) {
    // Track disconnect
    socket.on("disconnect", (reason) => {
      this.metrics.periodMetrics.disconnectCount++;
      
      const info = this.connectionInfo.get(socket.id);
      if (info) {
        // Track connection duration
        const duration = Date.now() - info.connected;
        log.debug(`Socket ${socket.id} disconnected after ${Math.round(duration/1000)}s. Reason: ${reason}`);
      }
      
      // Cleanup
      this.connectionInfo.delete(socket.id);
      this.heartbeats.delete(socket.id);
    });
    
    // Track errors
    socket.on("error", (error) => {
      this.metrics.periodMetrics.errorCount++;
      
      const errorType = error.type || "unknown";
      if (!this.metrics.connectionErrors[errorType]) {
        this.metrics.connectionErrors[errorType] = 0;
      }
      this.metrics.connectionErrors[errorType]++;
      
      log.error(`Socket ${socket.id} error: ${error.message}`);
    });
    
    // Track pongs for heartbeat
    socket.on("pong", () => {
      const pingTime = socket._lastPing || Date.now();
      const latency = Date.now() - pingTime;
      
      this.recordPong(socket.id, latency);
      
      // Track for average latency
      this.metrics.latencySamples.push(latency);
      if (this.metrics.latencySamples.length > 100) {
        this.metrics.latencySamples.shift();
      }
    });
    
    // Capture message events for metrics
    socket.onAny(() => {
      this.metrics.periodMetrics.messageCount++;
      this.metrics.totalMessages++;
      
      const info = this.connectionInfo.get(socket.id);
      if (info) {
        info.messagesReceived++;
        info.lastActivity = Date.now();
      }
    });
    
    // Store ping time for latency calculation
    socket._lastPing = null;
    const originalEmit = socket.emit;
    socket.emit = (ev, ...args) => {
      if (ev === "ping") {
        socket._lastPing = Date.now();
      }
      
      const info = this.connectionInfo.get(socket.id);
      if (info) {
        info.messagesSent++;
      }
      
      return originalEmit.apply(socket, [ev, ...args]);
    };
  }
  
  /**
   * Run a comprehensive health check on all socket connections
   */
  async runHealthCheck() {
    const now = Date.now();
    let unhealthySockets = 0;
    let zombieConnections = 0;
    let longConnections = 0;
    let transportMismatches = 0;
    
    log.info("Running socket health check");
    
    // Check each socket
    for (const socket of this.io.sockets.sockets.values()) {
      const socketId = socket.id;
      const info = this.connectionInfo.get(socketId);
      const heartbeat = this.heartbeats.get(socketId);
      
      if (!info || !heartbeat) {
        log.warn(`Found untracked socket: ${socketId}`);
        // Track it now
        if (socket.user) {
          this.registerSocket(socket, socket.user);
        } else {
          zombieConnections++;
          // Force disconnect if enabled
          if (this.config.cleanGhostConnections) {
            log.warn(`Disconnecting zombie socket ${socketId} with no user`);
            try {
              socket.disconnect(true);
            } catch (err) {
              log.error(`Error disconnecting zombie socket: ${err.message}`);
            }
          }
        }
        continue;
      }
      
      // Check for socket health issues
      let socketIssues = [];
      
      // 1. Check heartbeat health
      if (now - heartbeat.lastBeat > 2 * this.config.healthCheckInterval) {
        heartbeat.missed++;
        socketIssues.push("missed-heartbeat");
        
        // If too many missed heartbeats, emit ping to check
        if (heartbeat.missed >= 2) {
          try {
            socket.emit("ping");
          } catch (err) {
            log.error(`Error sending ping to ${socketId}: ${err.message}`);
          }
        }
        
        // If excessive missed heartbeats, consider unhealthy
        if (heartbeat.missed >= 3) {
          socketIssues.push("dead-heartbeat");
          unhealthySockets++;
        }
      }
      
      // 2. Check for inactivity
      if (now - info.lastActivity > this.config.inactivityThreshold) {
        socketIssues.push("inactive");
        
        // Force disconnect if enabled
        if (this.config.cleanGhostConnections) {
          log.warn(`Disconnecting inactive socket ${socketId} after ${Math.round((now - info.lastActivity)/1000)}s`);
          try {
            socket.disconnect(true);
          } catch (err) {
            log.error(`Error disconnecting inactive socket: ${err.message}`);
          }
        }
      }
      
      // 3. Check for too-long connections
      if (now - info.connected > this.config.maxSocketAge) {
        socketIssues.push("age-limit");
        longConnections++;
        
        // Force a reconnection for socket hygiene
        if (this.config.cleanGhostConnections) {
          log.info(`Refreshing long-running socket ${socketId} after ${Math.round((now - info.connected)/1000/60/60)}h`);
          try {
            // Emit event to client suggesting reconnection
            socket.emit("reconnect_suggestion", {
              reason: "connection-age",
              socketAge: now - info.connected,
              timestamp: now
            });
            
            // Give client some time to handle gracefully, then force disconnect
            setTimeout(() => {
              try {
                if (this.io.sockets.sockets.has(socketId)) {
                  socket.disconnect(true);
                }
              } catch (err) {
                // Ignore errors on delayed disconnect
              }
            }, 10000);
          } catch (err) {
            log.error(`Error refreshing aged socket: ${err.message}`);
          }
        }
      }
      
      // 4. Check if transport matches what's in connection info
      const currentTransport = socket.conn?.transport?.name || "unknown";
      if (info.transport !== currentTransport) {
        socketIssues.push("transport-mismatch");
        transportMismatches++;
        
        // Update the transport info
        info.transport = currentTransport;
        this.connectionInfo.set(socketId, info);
      }
      
      // 5. Check for high latency
      if (info.latency.length > 3) {
        const avgLatency = info.latency.reduce((sum, val) => sum + val, 0) / info.latency.length;
        if (avgLatency > 500) { // 500ms is quite high for websocket
          socketIssues.push("high-latency");
        }
      }
      
      // Log issues if any
      if (socketIssues.length > 0) {
        log.warn(`Socket ${socketId} health issues: ${socketIssues.join(", ")}`);
      }
    }
    
    // Update health status
    this.healthStatus = {
      lastCheck: now,
      unhealthySockets,
      zombieConnections,
      longConnections,
      transportMismatches
    };
    
    log.info(`Health check complete: ${unhealthySockets} unhealthy, ${zombieConnections} zombies, ${longConnections} aged`);
    
    return this.healthStatus;
  }
  
  /**
   * Validate users who are marked as online but have no active connections
   */
  async validateOnlineUsers() {
    try {
      log.info("Validating online users in database");
      
      // Find all users currently marked as online in database
      const onlineUsers = await User.find({ isOnline: true }).select('_id lastActive');
      
      let updatedCount = 0;
      let ghostUsers = 0;
      const now = Date.now();
      
      // Check each online user
      for (const user of onlineUsers) {
        const userId = user._id.toString();
        
        // If user has no socket connections OR hasn't been active recently
        if (!this.userConnections.has(userId) || (now - user.lastActive > this.config.inactivityThreshold)) {
          // Update them to offline
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastActive: now
          });
          
          // Notify other users
          this.io.emit("userOffline", { userId, timestamp: now });
          updatedCount++;
          
          if (!this.userConnections.has(userId)) {
            ghostUsers++;
          }
        }
      }
      
      // Update health status with ghost users
      this.healthStatus.ghostUsers = ghostUsers;
      
      if (updatedCount > 0) {
        log.info(`Fixed ${updatedCount} users who were incorrectly marked as online (${ghostUsers} ghosts)`);
      }
      
      return updatedCount;
    } catch (error) {
      log.error(`Error validating online users: ${error.message}`);
      return 0;
    }
  }
  
  /**
   * Collect and calculate metrics about socket usage
   */
  collectMetrics() {
    const now = Date.now();
    
    // Calculate total active users
    this.metrics.totalUsers = this.userConnections.size;
    
    // Calculate connections per user
    this.metrics.connectionsPerUser = {};
    let multiConnectionUsers = 0;
    
    for (const [userId, socketIds] of this.userConnections.entries()) {
      const count = socketIds.size;
      this.metrics.connectionsPerUser[count] = (this.metrics.connectionsPerUser[count] || 0) + 1;
      
      if (count > 1) {
        multiConnectionUsers++;
      }
    }
    
    // Calculate average latency
    if (this.metrics.latencySamples.length > 0) {
      this.metrics.avgLatency = this.metrics.latencySamples.reduce((sum, val) => sum + val, 0) / 
                                this.metrics.latencySamples.length;
    }
    
    // Calculate message rate (messages per second)
    const timeSinceLastReset = (now - this.metrics.periodMetrics.lastReset) / 1000; // in seconds
    this.metrics.messageRate = this.metrics.periodMetrics.messageCount / timeSinceLastReset;
    
    // Log metrics summary
    log.info(`Socket metrics: ${this.io.sockets.sockets.size} sockets, ${this.metrics.totalUsers} users, ` +
             `${multiConnectionUsers} multi-connection users, ${Math.round(this.metrics.messageRate * 100) / 100} msg/s, ` +
             `avg latency ${Math.round(this.metrics.avgLatency)}ms`);
    
    // Reset period metrics
    this.metrics.periodMetrics = {
      messageCount: 0,
      connectCount: 0,
      disconnectCount: 0,
      errorCount: 0,
      lastReset: now
    };
    
    return this.metrics;
  }
  
  /**
   * Get detailed stats about a specific user's connections
   * @param {string} userId User ID
   * @returns {Object} User connection stats
   */
  getUserConnectionStats(userId) {
    if (!userId || !this.userConnections.has(userId)) {
      return null;
    }
    
    const socketIds = this.userConnections.get(userId);
    const connections = [];
    
    for (const socketId of socketIds) {
      const info = this.connectionInfo.get(socketId);
      if (info) {
        connections.push({
          socketId,
          transport: info.transport,
          connected: info.connected,
          lastActivity: info.lastActivity,
          age: Date.now() - info.connected,
          messagesSent: info.messagesSent,
          messagesReceived: info.messagesReceived,
          avgLatency: info.latency.length > 0 
            ? info.latency.reduce((sum, val) => sum + val, 0) / info.latency.length 
            : null
        });
      }
    }
    
    return {
      userId,
      connectionCount: socketIds.size,
      connections
    };
  }
  
  /**
   * Clean up resources used by the monitor
   */
  destroy() {
    // Clear intervals
    if (this._healthCheckInterval) {
      clearInterval(this._healthCheckInterval);
      this._healthCheckInterval = null;
    }
    
    if (this._dbValidationInterval) {
      clearInterval(this._dbValidationInterval);
      this._dbValidationInterval = null;
    }
    
    if (this._metricsInterval) {
      clearInterval(this._metricsInterval);
      this._metricsInterval = null;
    }
    
    // Destroy memory managers
    this.connectionInfoManager.destroy();
    this.heartbeatManager.destroy();
    
    log.info("Socket monitor destroyed");
  }
}

export default SocketMonitor;