// server.js
const app = require('./config/server');
const connectDB = require('./config/db');
const dotenv = require('dotenv');

dotenv.config();

// Validate critical environment variables
if (!process.env.MONGO_URI) {
  console.error('Error: MONGO_URI is not defined in the .env file');
  process.exit(1);
}

// Connect to MongoDB and start the server
connectDB()
  .then(() => {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to connect to the database:', error);
    process.exit(1);
  });
