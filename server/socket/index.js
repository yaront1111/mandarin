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
  const io = socketio(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL || 'https://yourdomain.com'
        : 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: false
    }
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      // Get token from query parameter
      const token = socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication error'));
      }

      // Verify token
      const decoded = jwt.verify(token, config.JWT_SECRET);

      // Check if user exists
      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new Error('User not found'));
      }

      // Attach user data to socket
      socket.user = {
        _id: user._id,
        nickname: user.nickname
      };

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

        if (callback) callback({ success: true, message });
      } catch (err) {
        logger.error(`Error sending private message: ${err.message}`);
        if (callback) callback({ error: err.message });
      }
    });

    // Typing indicator
    socket.on('typing', ({ sender, recipient }) => {
      // Verify sender is the authenticated user
      if (sender !== socket.user._id.toString()) return;

      io.to(recipient).emit('userTyping', { userId: sender });
    });

    // Video call request with acknowledgments
    socket.on('videoCallRequest', ({ caller, recipient }, callback) => {
      // Verify caller is the authenticated user
      if (caller !== socket.user._id.toString()) {
        if (callback) callback({ error: 'Unauthorized caller ID' });
        return;
      }

      io.to(recipient).emit('incomingCall', { userId: caller });

      if (callback) callback({ success: true });
    });

    // Video call answer with acknowledgments
    socket.on('videoCallAnswer', ({ caller, recipient, answer }, callback) => {
      // Verify recipient is the authenticated user
      if (recipient !== socket.user._id.toString()) {
        if (callback) callback({ error: 'Unauthorized recipient ID' });
        return;
      }

      io.to(caller).emit('callAnswered', { userId: recipient, answer });

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
  });

  return io;
};

module.exports = initSocketServer;

// In server.js, replace the current socket.io initialization with:
/*
const initSocketServer = require('./socket');
const io = initSocketServer(server);
*/
