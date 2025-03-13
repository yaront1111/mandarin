// server.js
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketio = require('socket.io');
const path = require('path');
const morgan = require('morgan');
const config = require('./config');
const connectDB = require('./db'); // DB connection file (see below)
const routes = require('./routes');
const { User } = require('./models');
const logger = require('./logger'); // Winston logger

// Initialize Express
const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Connect to MongoDB
connectDB();

// Use Morgan to log HTTP requests; pipe output to Winston
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) }
}));

// Standard middleware
app.use(express.json());
app.use(cors());

// Set static folder for uploads
app.use('/uploads', express.static(path.join(__dirname, config.FILE_UPLOAD_PATH)));

// Mount API routes
app.use('/api', routes);

// Socket.io connection and events
io.on('connection', socket => {
  logger.info(`Socket connected: ${socket.id}`);

  // Join user to their room and update online status
  socket.on('join', async ({ userId }) => {
    socket.join(userId);
    try {
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastActive: Date.now()
      });
      socket.broadcast.emit('userOnline', { userId });
    } catch (err) {
      logger.error(`Error updating user online status: ${err.message}`);
    }
  });

  // Handle private messages
  socket.on('privateMessage', async ({ sender, recipient, type, content }) => {
    try {
      // Require Message model dynamically if needed
      const { Message } = require('./models');
      const message = await Message.create({
        sender,
        recipient,
        type,
        content
      });
      io.to(recipient).emit('newMessage', message);
      socket.emit('messageSent', message);
    } catch (err) {
      socket.emit('error', { message: err.message });
      logger.error(`Error sending private message: ${err.message}`);
    }
  });

  // Typing indicator
  socket.on('typing', ({ sender, recipient }) => {
    io.to(recipient).emit('userTyping', { userId: sender });
  });

  // Video call request
  socket.on('videoCallRequest', ({ caller, recipient }) => {
    io.to(recipient).emit('incomingCall', { userId: caller });
  });

  // Video call answer
  socket.on('videoCallAnswer', ({ caller, recipient, answer }) => {
    io.to(caller).emit('callAnswered', { userId: recipient, answer });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
    // Optionally, update user status here
  });
});

// Global error-handling middleware
app.use((err, req, res, next) => {
  logger.error(
    `${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`
  );
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Server Error'
  });
});

// Start the server
server.listen(config.PORT, () => {
  logger.info(`Server running on port ${config.PORT}`);
});
