// server/socket/index.js
const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
const { User, Message } = require('../models');
const config = require('../config');
const logger = require('../logger');

/**
 * Initialize Socket.IO server
 * @param {Object} server - HTTP server instance
 * @returns {Object} Socket.IO server instance
 */
const initSocketServer = (server) => {
  // Define allowed origins based on environment
  // More flexible CORS configuration for both development and production
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS
       ? process.env.ALLOWED_ORIGINS.split(',')
       : [process.env.FRONTEND_URL || 'https://yourdomain.com'])
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5000', 'http://127.0.0.1:5000'];

  // Log configured origins for debugging
  logger.info(`Socket.IO configured with allowed origins: ${JSON.stringify(allowedOrigins)}`);

  const io = socketio(server, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, Postman)
        if (!origin) {
          logger.debug('Socket connection with no origin allowed');
          return callback(null, true);
        }

        // Check if origin is allowed or if we're in development
        if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
          logger.debug(`Socket.IO CORS allowed for origin: ${origin}`);
          return callback(null, true);
        }

        // Log rejected origins for debugging
        logger.warn(`Socket.IO CORS rejected for origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'), false);
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true, // Enable credentials for auth scenarios
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    },
    // Additional Socket.IO configuration for production
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 30000,
    maxHttpBufferSize: 1e6 // 1MB
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      // Get token from query parameter
      const token = socket.handshake.query?.token;

      if (!token) {
        logger.warn(`Socket authentication failed: No token provided (IP: ${socket.handshake.address})`);
        return next(new Error('Authentication error'));
      }

      // Verify token
      const decoded = jwt.verify(token, config.JWT_SECRET);

      // Check if user exists
      const user = await User.findById(decoded.id);

      if (!user) {
        logger.warn(`Socket authentication failed: User not found for ID ${decoded.id}`);
        return next(new Error('User not found'));
      }

      // Attach user data to socket
      socket.user = {
        _id: user._id,
        nickname: user.nickname
      };

      logger.debug(`Socket ${socket.id} authenticated for user ${user.nickname} (${user._id})`);
      next();
    } catch (err) {
      logger.error(`Socket authentication error: ${err.message}`);
      next(new Error('Authentication error'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} (User: ${socket.user._id})`);

    // Join user to their room
    socket.on('join', async ({ userId }) => {
      // Verify that the requested userId matches the authenticated user
      if (userId !== socket.user._id.toString()) {
        logger.warn(`Unauthorized join attempt by ${socket.user._id} for user ${userId}`);
        socket.emit('error', { message: 'Unauthorized user ID' });
        return;
      }

      socket.join(userId);

      try {
        await User.findByIdAndUpdate(userId, {
          isOnline: true,
          lastActive: Date.now()
        });

        socket.broadcast.emit('userOnline', { userId });
        logger.info(`User ${userId} joined and is online`);
      } catch (err) {
        logger.error(`Error updating user online status: ${err.message}`);
        socket.emit('error', { message: 'Failed to update online status' });
      }
    });

    // Handle private messages with acknowledgments
    socket.on('privateMessage', async ({ sender, recipient, type, content }, callback) => {
      try {
        // Verify that the sender is the authenticated user
        if (sender !== socket.user._id.toString()) {
          logger.warn(`Unauthorized message attempt by ${socket.user._id} for user ${sender}`);
          if (callback) callback({ error: 'Unauthorized sender ID' });
          return;
        }

        const message = await Message.create({
          sender,
          recipient,
          type,
          content
        });

        io.to(recipient).emit('newMessage', message);
        logger.debug(`Message sent from ${sender} to ${recipient} (type: ${type})`);

        if (callback) callback({ success: true, message });
      } catch (err) {
        logger.error(`Error sending private message: ${err.message}`);
        if (callback) callback({ error: err.message });
      }
    });

    // Typing indicator
    socket.on('typing', ({ sender, recipient }) => {
      // Verify sender is the authenticated user
      if (sender !== socket.user._id.toString()) {
        logger.warn(`Unauthorized typing indicator from ${socket.user._id} for user ${sender}`);
        return;
      }

      io.to(recipient).emit('userTyping', { userId: sender });
    });

    // Video call request with acknowledgments
    socket.on('videoCallRequest', ({ caller, recipient }, callback) => {
      // Verify caller is the authenticated user
      if (caller !== socket.user._id.toString()) {
        logger.warn(`Unauthorized call request from ${socket.user._id} for user ${caller}`);
        if (callback) callback({ error: 'Unauthorized caller ID' });
        return;
      }

      io.to(recipient).emit('incomingCall', { userId: caller });
      logger.info(`Video call initiated from ${caller} to ${recipient}`);

      if (callback) callback({ success: true });
    });

    // Video call answer with acknowledgments
    socket.on('videoCallAnswer', ({ caller, recipient, answer }, callback) => {
      // Verify recipient is the authenticated user
      if (recipient !== socket.user._id.toString()) {
        logger.warn(`Unauthorized call answer from ${socket.user._id} for user ${recipient}`);
        if (callback) callback({ error: 'Unauthorized recipient ID' });
        return;
      }

      io.to(caller).emit('callAnswered', { userId: recipient, answer });
      logger.info(`Call answered by ${recipient} to ${caller}: ${answer ? 'accepted' : 'declined'}`);

      if (callback) callback({ success: true });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      logger.info(`Socket disconnected: ${socket.id} (User: ${socket.user._id})`);

      try {
        await User.findByIdAndUpdate(socket.user._id, {
          isOnline: false,
          lastActive: Date.now()
        });

        io.emit('userOffline', { userId: socket.user._id });
      } catch (err) {
        logger.error(`Error updating user offline status: ${err.message}`);
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id} (User: ${socket.user?._id}): ${error.message}`);
    });
  });

  // Server-side error handling
  io.engine.on('connection_error', (err) => {
    logger.error(`Socket.IO connection error: ${err.code} - ${err.message}`);
  });

  return io;
};

module.exports = initSocketServer;
