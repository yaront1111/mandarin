const http = require('http');
const app = require('./app');
const config = require('./config');
const { cleanupExpiredStories } = require('./services/storyService');
const runMigrations = require('./migrate'); // Your migration runner file

// If you plan to use Socket.IO in the future, initialize it here
// const { init } = require('./socket'); // Uncomment when ready

const server = http.createServer(app);

// Run cleanupExpiredStories every hour
setInterval(cleanupExpiredStories, 1000 * 60 * 60);

const startServer = async () => {
  try {
    console.log('Running migrations...');
    await runMigrations();
    console.log('Migrations complete.');

    // Uncomment the following line once you have Socket.IO set up
    // init(server);

    server.listen(config.port, () => {
      console.log(`✅ Server running on port ${config.port} in ${config.nodeEnv} mode`);
    });
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  }
};

startServer();
