// server.js

// Load environment variables
require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');

// Import route modules
const authRoutes = require('./routes/authRoutes');
const mapRoutes = require('./routes/mapRoutes');
const messageRoutes = require('./routes/messageRoutes');
const moderationRoutes = require('./routes/moderationRoutes');
const storyRoutes = require('./routes/storyRoutes');
const userRoutes = require('./routes/userRoutes');

// Ensure critical ENV variables exist
if (!process.env.MONGO_URI) {
  console.error('Error: MONGO_URI is not defined in .env');
  process.exit(1);
}

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('Database connected successfully');

    const app = express();

    // Security & CORS
    app.use(helmet());
    app.use(cors());
    // Logging
    app.use(morgan('combined'));
    // JSON body parsing
    app.use(express.json());

    // API Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/map', mapRoutes);
    app.use('/api/messages', messageRoutes);
    app.use('/api/moderation', moderationRoutes);
    app.use('/api/stories', storyRoutes);
    app.use('/api/users', userRoutes);

    // --- Serve React build (Only in Production) ---
    if (process.env.NODE_ENV === 'production') {
      const clientBuildPath = path.join(__dirname, '..', 'client', 'build');
      // Serve static files from the React app
      app.use(express.static(clientBuildPath));

      // For any other route, serve index.html to let React handle routing
      app.get('*', (req, res) => {
        res.sendFile(path.join(clientBuildPath, 'index.html'));
      });
    }

    // 404 Handler (for APIs)
    app.use((req, res, next) => {
      res.status(404).json({ message: 'Not Found' });
    });

    // Global Error Handler
    app.use((err, req, res, next) => {
      if (res.headersSent) {
        return next(err);
      }
      console.error('Global Error Handler:', err);
      if (err.name === 'ValidationError') {
        return res.status(400).json({ message: err.message });
      }
      if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      res.status(500).json({ message: 'Internal Server Error' });
    });

    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    // Graceful shutdown for unhandled rejections
    process.on('unhandledRejection', (err) => {
      console.error('Unhandled Promise Rejection:', err);
      server.close(() => process.exit(1));
    });

    // Graceful shutdown for uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err);
      server.close(() => process.exit(1));
    });
  } catch (error) {
    console.error('Failed to connect to the database:', error);
    process.exit(1);
  }
};

// Initialize the server
startServer();
