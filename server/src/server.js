const http = require('http');
const app = require('./app');
const config = require('./config');
const { cleanupExpiredStories } = require('./services/storyService');

// If you plan to use Socket.IO in the future, we do this:
const { init } = require('./socket'); // We'll create it later

const server = http.createServer(app);

// If you plan to use Socket.IO, initialize it here
// init(server); // We'll uncomment once socket code exists
// Run every hour
setInterval(cleanupExpiredStories, 1000 * 60 * 60);

server.listen(config.port, () => {
  console.log(`✅ Server running on port ${config.port} in ${config.nodeEnv} mode`);
});
