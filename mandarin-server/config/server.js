// config/server.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// Import routes
const authRoutes = require('../routes/authRoutes');
const userRoutes = require('../routes/userRoutes');
const messageRoutes = require('../routes/messageRoutes');
const mapRoutes = require('../routes/mapRoutes');
const moderationRoutes = require('../routes/moderationRoutes');
const storyRoutes = require('../routes/storyRoutes');

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

// Routes mounting
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/stories', storyRoutes);

module.exports = app;
