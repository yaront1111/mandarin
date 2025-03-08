require('dotenv').config();
const mysql = require('mysql');
const util = require('util');

/**
 * Use a connection pool instead of a single connection.
 * This is more scalable in production.
 */
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'test',
  connectionLimit: 10
});

// Convert "db.query(...)" into a promise-based function
db.query = util.promisify(db.query).bind(db);

// Test the connection on initialization
db.getConnection((err, connection) => {
  if (err) {
    console.error('MySQL connection error: ', err);
  } else {
    console.log(`MySQL connected to database: ${process.env.DB_NAME}`);
    connection.release();
  }
});

module.exports = db;
