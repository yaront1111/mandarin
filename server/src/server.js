const http = require('http');
const app = require('./app');
const config = require('./config');
const { cleanupExpiredStories } = require('./services/storyService');
const runMigrations = require('./migrate');
const { initSocket } = require('./socket'); // Import the Socket.IO initialization

// Create HTTP server
const server = http.createServer(app);

// Run cleanupExpiredStories every hour
setInterval(cleanupExpiredStories, 1000 * 60 * 60);

const startServer = async () => {
  try {
    console.log('Running migrations...');
    await runMigrations();
    console.log('Migrations complete.');

    // Initialize Socket.IO with the HTTP server
    initSocket(server);

    server.listen(config.port, () => {
      console.log(`✅ Server running on port ${config.port} in ${config.nodeEnv} mode`);
    });
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  }
};

startServer();
