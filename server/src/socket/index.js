// src/socket/index.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { User, Match, Call } = require('../models');
const { Op } = require('sequelize');

let io;

exports.initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: config.clientUrl,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Socket auth
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('No token'));

      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await User.findByPk(decoded.id);
      if (!user) return next(new Error('Invalid user'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.id}`);

    // Let’s join personal room
    socket.join(`user:${socket.user.id}`);

    // *** Video call events ***

    socket.on('call:initiate', async ({ matchId, receiverId, callType }) => {
      try {
        const callerId = socket.user.id;
        // Ensure caller and receiver are actually in a match
        const match = await Match.findOne({
          where: {
            id: matchId,
            [Op.or]: [
              { userAId: callerId, userBId: receiverId },
              { userAId: receiverId, userBId: callerId }
            ]
          }
        });
        if (!match) {
          return socket.emit('error', { message: 'No valid match' });
        }

        // Create call record
        const call = await Call.create({
          matchId,
          callerId,
          receiverId,
          callType,
          status: 'initiated'
        });

        // Notify receiver
        io.to(`user:${receiverId}`).emit('call:incoming', {
          callId: call.id,
          callerId,
          callerName: socket.user.firstName,
          matchId,
          callType
        });

        // Acknowledge caller
        socket.emit('call:initiated', { callId: call.id });
      } catch (err) {
        console.error('Call initiation error:', err);
        socket.emit('error', { message: 'Failed to initiate call' });
      }
    });

    socket.on('call:accept', async ({ callId }) => {
      try {
        const call = await Call.findOne({
          where: {
            id: callId,
            receiverId: socket.user.id,
            status: 'initiated'
          }
        });
        if (!call) return socket.emit('error', { message: 'Call not found' });

        call.status = 'connected';
        call.startedAt = new Date();
        await call.save();

        // Both parties join a room e.g. `call:<callId>`
        socket.join(`call:${call.id}`);
        io.to(`user:${call.callerId}`).emit('call:accepted', { callId });
      } catch (err) {
        socket.emit('error', { message: 'Failed to accept call' });
      }
    });

    socket.on('call:decline', async ({ callId }) => {
      try {
        const call = await Call.findOne({
          where: {
            id: callId,
            receiverId: socket.user.id,
            status: 'initiated'
          }
        });
        if (!call) return socket.emit('error', { message: 'Call not found' });

        call.status = 'declined';
        await call.save();

        io.to(`user:${call.callerId}`).emit('call:declined', { callId });
      } catch (err) {
        socket.emit('error', { message: 'Failed to decline call' });
      }
    });

    socket.on('call:end', async ({ callId }) => {
      try {
        const call = await Call.findOne({
          where: {
            id: callId,
            [Op.or]: [
              { callerId: socket.user.id },
              { receiverId: socket.user.id }
            ],
            status: 'connected'
          }
        });
        if (!call) return socket.emit('error', { message: 'Active call not found' });

        // Mark ended
        call.status = 'ended';
        call.endedAt = new Date();
        call.duration = Math.floor((call.endedAt - call.startedAt) / 1000);
        await call.save();

        // Notify both parties
        io.to(`call:${callId}`).emit('call:ended', {
          callId,
          duration: call.duration
        });
        // All participants leave the room
        socket.leave(`call:${callId}`);
      } catch (err) {
        socket.emit('error', { message: 'Failed to end call' });
      }
    });

    // WebRTC signaling
    socket.on('webrtc:offer', ({ callId, offer }) => {
      socket.to(`call:${callId}`).emit('webrtc:offer', { callId, offer });
    });

    socket.on('webrtc:answer', ({ callId, answer }) => {
      socket.to(`call:${callId}`).emit('webrtc:answer', { callId, answer });
    });

    socket.on('webrtc:ice-candidate', ({ callId, candidate }) => {
      socket.to(`call:${callId}`).emit('webrtc:ice-candidate', { callId, candidate });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.id}`);
    });
  });
};

exports.getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};
