// server.js
const app = require('./config/server');
const connectDB = require('./config/db');
const dotenv = require('dotenv');

dotenv.config();

// Connect to MongoDB
connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
