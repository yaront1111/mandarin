const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { User, Message } = require('../models');
const config = require('../config');

let io;

exports.initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: config.clientUrl,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Middleware for socket auth
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('No token'));
      }
      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await User.findByPk(decoded.id);
      if (!user || user.accountStatus !== 'active') {
        return next(new Error('Invalid user'));
      }
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: userId=${socket.user.id}`);

    // Join a personal room
    socket.join(`user:${socket.user.id}`);

    socket.on('joinMatch', (matchId) => {
      socket.join(`match:${matchId}`);
    });

    socket.on('chatMessage', async ({ matchId, content, messageType }) => {
      const newMessage = await Message.create({
        matchId,
        senderId: socket.user.id,
        content,
        messageType: messageType || 'text'
      });

      // Broadcast to everyone in this match room
      io.to(`match:${matchId}`).emit('chatMessage', newMessage);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: userId=${socket.user.id}`);
    });
  });
};

exports.getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};
