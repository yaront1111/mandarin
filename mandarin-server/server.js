// server.js
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const connectDB = require('./config/db');

// Import your route modules
const authRoutes = require('./routes/authRoutes');
const mapRoutes = require('./routes/mapRoutes');
const messageRoutes = require('./routes/messageRoutes');
const moderationRoutes = require('./routes/moderationRoutes');
const storyRoutes = require('./routes/storyRoutes');
const userRoutes = require('./routes/userRoutes');

// 1. Validate critical environment variables
if (!process.env.MONGO_URI) {
  console.error('Error: MONGO_URI is not defined in .env');
  process.exit(1);
}

// 2. Connect to MongoDB
connectDB()
  .then(() => {
    // 3. Once DB is connected, create and configure the Express app
    const app = express();

    // Security middlewares
    app.use(helmet());
    app.use(cors());

    // Parse JSON request body
    app.use(express.json());

    // 4. Define routes
    app.use('/api/auth', authRoutes);
    app.use('/api/map', mapRoutes);
    app.use('/api/messages', messageRoutes);
    app.use('/api/moderation', moderationRoutes);
    app.use('/api/stories', storyRoutes);
    app.use('/api/users', userRoutes);

    // 404 handler (if a route doesn't exist)
    app.use((req, res) => {
      res.status(404).json({ message: 'Not Found' });
    });

    // Optional global error handler
    app.use((err, req, res, next) => {
      console.error('Global Error Handler:', err);
      res.status(500).json({ message: 'Internal Server Error' });
    });

    // 5. Start the server
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    // 6. Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('Unhandled Promise Rejection:', err);
      server.close(() => {
        process.exit(1);
      });
    });

    // 7. Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err);
      server.close(() => {
        process.exit(1);
      });
    });
  })
  .catch((error) => {
    // If we fail to connect to DB, log and exit
    console.error('Failed to connect to the database:', error);
    process.exit(1);
  });
