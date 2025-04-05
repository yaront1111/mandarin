import express from "express"
import mongoose from "mongoose"
import authRoutes from "./authRoutes.js"
import userRoutes from "./userRoutes.js"
import messageRoutes from "./messageRoutes.js"
import storyRoutes from "./storyRoutes.js"
import notificationRoutes from "./notificationRoutes.js"
import avatarRoutes from "./avatarRoutes.js"
import subscriptionRoutes from "./subscriptionRoutes.js"
import { protect } from "../middleware/auth.js"
import logger from "../logger.js"

const router = express.Router()

// Health check route
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || "1.0.0",
  })
})

// Enhanced Socket.io fallback for when WebSockets are blocked
// Provides polling-based fallback for real-time notifications, messages and events
router.get("/socket-fallback", protect, (req, res) => {
  // Get socket instance
  const io = req.app.get('io');
  if (!io) {
    return res.status(503).json({
      success: false,
      error: "Socket.IO not initialized on server"
    });
  }
  
  if (req.user && req.user._id) {
    try {
      const userId = req.user._id.toString();
      const userRoom = userId;
      const clientId = req.query.clientId || `fallback_${Date.now()}`;
      
      // Log this fallback request for monitoring
      logger.info(`Socket fallback API request from user ${userId} with client ID ${clientId}`);
      
      // Force emit a fallback notification to this user
      io.to(userRoom).emit('fallbackConnection', {
        timestamp: Date.now(),
        userId: userId,
        clientId: clientId,
        message: "Socket fallback API connection successful"
      });
      
      // Return success with diagnostic information
      return res.status(200).json({
        success: true,
        message: "Socket fallback connection successful",
        timestamp: Date.now(),
        userId: userId,
        clientId: clientId,
        instructions: "Use the long-polling endpoint for receiving notifications",
        endpoints: {
          send: "/api/socket-fallback/send",
          receive: "/api/socket-fallback/poll",
          presence: "/api/socket-fallback/presence"
        }
      });
    } catch (err) {
      logger.error(`Socket fallback error: ${err.message}`);
      return res.status(500).json({
        success: false,
        error: `Socket fallback error: ${err.message}`
      });
    }
  } else {
    return res.status(401).json({
      success: false,
      error: "Authentication required"
    });
  }
})

// Fallback for sending messages when socket.io is unreachable
router.post("/socket-fallback/send", protect, (req, res) => {
  const io = req.app.get('io');
  if (!io) {
    return res.status(503).json({
      success: false,
      error: "Socket.IO not initialized on server"
    });
  }
  
  if (!req.user || !req.user._id) {
    return res.status(401).json({
      success: false,
      error: "Authentication required"
    });
  }
  
  try {
    const { event, data, target } = req.body;
    
    if (!event) {
      return res.status(400).json({
        success: false,
        error: "Event name is required"
      });
    }
    
    const userId = req.user._id.toString();
    
    // Log this fallback event for monitoring
    logger.info(`Socket fallback send event '${event}' from user ${userId} to ${target || 'server'}`);
    
    // Handle different event destinations
    if (target) {
      // Send to a specific user/room
      io.to(target).emit(event, {
        ...data,
        userId: userId,
        timestamp: Date.now(),
        fromFallback: true
      });
    } else {
      // Broadcast on behalf of this user
      // For security, only certain events are allowed to be broadcast
      const allowedBroadcastEvents = ['typing', 'userStatus', 'presence'];
      
      if (allowedBroadcastEvents.includes(event)) {
        io.emit(event, {
          ...data,
          userId: userId,
          timestamp: Date.now(),
          fromFallback: true
        });
      } else {
        return res.status(403).json({
          success: false,
          error: "Broadcasting this event type is not allowed via fallback API"
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      message: `Event '${event}' sent successfully via fallback API`,
      timestamp: Date.now()
    });
  } catch (err) {
    logger.error(`Socket fallback send error: ${err.message}`);
    return res.status(500).json({
      success: false,
      error: `Error sending event: ${err.message}`
    });
  }
})

// Long-polling fallback endpoint for receiving notifications when socket.io is unreachable
router.get("/socket-fallback/poll", protect, (req, res) => {
  const io = req.app.get('io');
  
  if (!req.user || !req.user._id) {
    return res.status(401).json({
      success: false,
      error: "Authentication required"
    });
  }
  
  const userId = req.user._id.toString();
  const lastEventId = parseInt(req.query.lastEventId) || 0;
  const timeout = Math.min(parseInt(req.query.timeout) || 20000, 30000); // Max 30 seconds
  
  // Create a queue for this polling request
  const eventQueue = [];
  
  // Set up a timeout for the long poll
  const timeoutId = setTimeout(() => {
    // If no events after timeout, return empty result
    if (res.headersSent) return;
    
    return res.status(200).json({
      success: true,
      events: eventQueue,
      timestamp: Date.now(),
      pollingInfo: {
        lastEventId: Math.max(lastEventId, eventQueue.length > 0 ? eventQueue[eventQueue.length - 1].id : lastEventId),
        nextPollDelay: 0 // Poll again immediately since we timed out
      }
    });
  }, timeout);
  
  // Unique ID for this polling listener
  const listenerId = `poll_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  // Track event ID for this session
  let currentEventId = lastEventId;
  
  // Function to handle incoming events for this user
  const handleEvent = (eventName, eventData) => {
    // Only add to queue if this is targeted at our user
    if (eventData && (
      !eventData.userId || // Global events
      eventData.userId === userId || // Events for this user
      (eventData.recipientId && eventData.recipientId === userId) // Messages to this user
    )) {
      currentEventId++;
      
      // Add to the queue
      eventQueue.push({
        id: currentEventId,
        event: eventName,
        data: eventData,
        timestamp: Date.now()
      });
      
      // If we have events, respond immediately
      if (eventQueue.length >= 1 && !res.headersSent) {
        clearTimeout(timeoutId);
        
        return res.status(200).json({
          success: true,
          events: eventQueue,
          timestamp: Date.now(),
          pollingInfo: {
            lastEventId: currentEventId,
            nextPollDelay: 0 // Poll again immediately
          }
        });
      }
    }
  };
  
  // Important notification events to listen for
  const notificationEvents = [
    'notification', 'newMessage', 'newLike', 'photoPermissionRequestReceived',
    'photoPermissionResponseReceived', 'newComment', 'incomingCall', 'newStory',
    'userOnline', 'userOffline', 'messageReceived', 'fallbackConnection'
  ];
  
  // Register listeners for all notification events
  notificationEvents.forEach(eventName => {
    io.of('/').adapter.on(eventName, handleEvent.bind(null, eventName));
  });
  
  // Also listen for events in the user's room
  const userRoom = io.to(userId);
  if (userRoom) {
    notificationEvents.forEach(eventName => {
      userRoom.on(eventName, handleEvent.bind(null, eventName));
    });
  }
  
  // Clean up on response end
  res.on('close', () => {
    clearTimeout(timeoutId);
    // Clean up event listeners
    notificationEvents.forEach(eventName => {
      try {
        io.of('/').adapter.off(eventName, handleEvent);
        if (userRoom) userRoom.off(eventName, handleEvent);
      } catch (err) {
        // Ignore errors during cleanup
      }
    });
  });
  
  // Immediate return if there are events in the queue from other sources
  if (eventQueue.length > 0 && !res.headersSent) {
    clearTimeout(timeoutId);
    return res.status(200).json({
      success: true,
      events: eventQueue,
      timestamp: Date.now(),
      pollingInfo: {
        lastEventId: currentEventId,
        nextPollDelay: 0
      }
    });
  }
})

// User presence API for checking who is online when socket.io is unreachable
router.get("/socket-fallback/presence", protect, async (req, res) => {
  const io = req.app.get('io');
  
  try {
    // Import User model for checking online status
    const { User } = await import("../models/index.js");
    
    // Get users who are currently marked as online
    const onlineUsers = await User.find({ isOnline: true })
      .select('_id nickname lastActive')
      .sort('-lastActive')
      .limit(50);
    
    return res.status(200).json({
      success: true,
      online: onlineUsers.map(user => ({
        userId: user._id.toString(),
        nickname: user.nickname,
        lastActive: user.lastActive
      })),
      timestamp: Date.now(),
      totalOnline: onlineUsers.length
    });
  } catch (err) {
    logger.error(`Presence fallback error: ${err.message}`);
    return res.status(500).json({
      success: false,
      error: `Error checking presence: ${err.message}`
    });
  }
})

// Add diagnostic route for debugging avatar endpoint issues
router.get("/debug-routes", (req, res) => {
  const mountedRoutes = {
    message: "Routes currently mounted in the server",
    timestamp: new Date().toISOString(),
    routes: {
      "GET /api/health": "API health check",
      "GET /api/avatar/health": "Avatar routes health check",
      "GET /api/avatar/:userId": "Get user avatar",
      "GET /api/debug-routes": "This route - shows available routes",
      "GET /api/debug-auth": "Authentication debugging route (protected)"
    }
  };
  return res.status(200).json(mountedRoutes);
})

// Debug route to diagnose auth and user ID issues
router.get("/debug-auth", protect, (req, res) => {
  // Check if user exists in request
  if (!req.user) {
    return res.status(500).json({
      success: false,
      error: "No user in request",
    });
  }

  // Extract user details for debugging
  const userIdRaw = req.user._id;
  const userIdStr = String(userIdRaw);
  
  // Check if ID is a valid MongoDB ObjectID
  const isValidObjectId = mongoose.Types.ObjectId.isValid(userIdStr);
  
  // Check if we can convert it to an ObjectId
  let objectIdResult = null;
  let objectIdError = null;
  try {
    objectIdResult = new mongoose.Types.ObjectId(userIdStr);
  } catch (err) {
    objectIdError = err.message;
  }

  // Log the results for server-side debugging
  logger.info(`Debug Auth Route - User ID Check:`, {
    id: userIdStr,
    valid: isValidObjectId,
    error: objectIdError
  });

  // Return detailed diagnostics
  return res.status(200).json({
    success: true,
    diagnostics: {
      user: {
        id: userIdRaw,
        idType: typeof userIdRaw,
        idString: userIdStr,
        idLength: userIdStr.length,
        isValidObjectId: isValidObjectId,
        objectIdResult: objectIdResult ? objectIdResult.toString() : null,
        objectIdError: objectIdError,
        idMatchesFormat: /^[0-9a-fA-F]{24}$/.test(userIdStr)
      },
      token: {
        exists: !!req.headers.authorization,
        format: req.headers.authorization ? req.headers.authorization.substring(0, 15) + '...' : null
      },
      tests: {
        conversationsTest: `/api/messages/conversations will ${isValidObjectId ? 'likely work' : 'likely fail'}`,
        resetInstructions: "To reset your session: localStorage.clear(); sessionStorage.clear(); window.location.href='/login';"
      }
    }
  });
})

// Mount routes
router.use("/auth", authRoutes)
router.use("/users", userRoutes)
router.use("/messages", messageRoutes)
router.use("/stories", storyRoutes)
router.use("/notifications", notificationRoutes)
router.use("/avatar", avatarRoutes)
// Also mount at '/avatars' for backwards compatibility 
router.use("/avatars", avatarRoutes)
router.use("/subscription", subscriptionRoutes)

export default router
