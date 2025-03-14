// server/server.js
const express = require('express');
const http = require('http');
const path = require('path');
const morgan = require('morgan');
const config = require('./config');
const connectDB = require('./db');
const routes = require('./routes');
const logger = require('./logger');

// Import custom middleware and services
const corsMiddleware = require('./middleware/cors');
const initSocketServer = require('./socket');

// Initialize Express
const app = express();
const server = http.createServer(app);

// Connect to MongoDB
connectDB();

// Use Morgan to log HTTP requests; pipe output to Winston
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) }
}));

// Standard middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Use custom CORS middleware
app.use(corsMiddleware());

// Set static folder for uploads
app.use('/uploads', express.static(config.FILE_UPLOAD_PATH));

// Mount API routes
app.use('/api', routes);

// Initialize Socket.IO with improved implementation
const io = initSocketServer(server);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static(path.join(__dirname, '../client/build')));

  // Any route that is not an API route should be handled by React
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'));
  });
}

// Global error-handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.status || 500;
  const errorMessage = err.message || 'Server Error';

  logger.error(
    `${statusCode} - ${errorMessage} - ${req.originalUrl} - ${req.method} - ${req.ip}`
  );

  // Don't expose stack traces in production
  const error = process.env.NODE_ENV === 'production'
    ? errorMessage
    : { message: errorMessage, stack: err.stack };

  res.status(statusCode).json({
    success: false,
    error
  });
});

// Start the server
server.listen(config.PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${config.PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
