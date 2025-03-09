// recreatedb.js
require('dotenv').config();
const { Sequelize } = require('sequelize');

// Connect to the postgres database (default admin database)
const sequelize = new Sequelize({
  host: process.env.DB_HOST || 'localhost',
  username: process.env.DB_USER || 'yarontorgeman',
  password: process.env.DB_PASS || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: 'postgres', // Connect to postgres database instead of trying the username
  dialect: 'postgres',
  logging: console.log
});

// The database name you want to recreate
const dbName = process.env.DB_NAME || 'mandarin';

async function recreateDatabase() {
  try {
    // Connect to PostgreSQL
    await sequelize.authenticate();
    console.log('Connected to PostgreSQL successfully');

    // Drop the database if it exists
    console.log(`Dropping database "${dbName}" if it exists...`);
    await sequelize.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    console.log(`Database "${dbName}" dropped successfully`);

    // Create a new database
    console.log(`Creating database "${dbName}"...`);
    await sequelize.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Database "${dbName}" created successfully`);

    console.log('✅ Database recreation completed successfully!');
    console.log('Now run your application with sequelize.sync({force: true}) to create the tables.');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Close the connection
    await sequelize.close();
    console.log('Database connection closed');
  }
}

// Run the function
recreateDatabase();
