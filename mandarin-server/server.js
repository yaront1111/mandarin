// server.js

// Load environment variables early in the application lifecycle
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan'); // Request logging middleware
const connectDB = require('./config/db');

// Import route modules for better modularity and maintainability
const authRoutes = require('./routes/authRoutes');
const mapRoutes = require('./routes/mapRoutes');
const messageRoutes = require('./routes/messageRoutes');
const moderationRoutes = require('./routes/moderationRoutes');
const storyRoutes = require('./routes/storyRoutes');
const userRoutes = require('./routes/userRoutes');

// Validate critical environment variables to avoid runtime errors
if (!process.env.MONGO_URI) {
  console.error('Error: MONGO_URI is not defined in .env');
  process.exit(1);
}

/**
 * startServer: Asynchronously connects to the database and starts the Express server.
 */
const startServer = async () => {
  try {
    // Connect to MongoDB using async/await for clarity
    await connectDB();
    console.log('Database connected successfully');

    // Create an Express application instance
    const app = express();

    // Set up security-related HTTP headers and CORS support
    app.use(helmet());
    app.use(cors());

    // Log incoming requests for debugging and monitoring purposes
    app.use(morgan('combined'));

    // Middleware to parse JSON bodies in incoming requests
    app.use(express.json());

    // Define API routes with appropriate endpoint prefixes
    app.use('/api/auth', authRoutes);
    app.use('/api/map', mapRoutes);
    app.use('/api/messages', messageRoutes);
    app.use('/api/moderation', moderationRoutes);
    app.use('/api/stories', storyRoutes);
    app.use('/api/users', userRoutes);

    // 404 handler for requests to undefined routes
    app.use((req, res, next) => {
      res.status(404).json({ message: 'Not Found' });
    });

    /**
     * Global error handling middleware:
     * - Checks if headers have been sent.
     * - Differentiates between known error types (e.g., ValidationError, UnauthorizedError)
     *   and defaults to a generic 500 Internal Server Error response.
     */
    app.use((err, req, res, next) => {
      // If headers are already sent, delegate to the default Express error handler
      if (res.headersSent) {
        return next(err);
      }

      console.error('Global Error Handler:', err);

      // Handle specific error types for better client feedback
      if (err.name === 'ValidationError') {
        return res.status(400).json({ message: err.message });
      }

      if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Fallback for unhandled errors
      res.status(500).json({ message: 'Internal Server Error' });
    });

    // Start the server on the specified port (default to 5000)
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    // Gracefully handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('Unhandled Promise Rejection:', err);
      server.close(() => {
        process.exit(1);
      });
    });

    // Gracefully handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err);
      server.close(() => {
        process.exit(1);
      });
    });
  } catch (error) {
    // Exit if the database connection fails
    console.error('Failed to connect to the database:', error);
    process.exit(1);
  }
};

// Initialize the server startup
startServer();
