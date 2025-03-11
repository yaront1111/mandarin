// server/src/rebuildDatabase.js

/**
 * Database Rebuild Script
 * 
 * This script will:
 * 1. Drop all tables in the database
 * 2. Recreate them with the latest model definitions
 * 3. Add test data if needed
 * 
 * ⚠️ WARNING: This will DELETE ALL DATA in your database ⚠️
 * 
 * Usage: node server/src/rebuildDatabase.js
 */

const { sequelize, User, Profile, Photo, Like, Match, Message } = require('./models');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

async function rebuildDatabase() {
  try {
    console.log('Starting database rebuild...');
    
    // Drop all tables and recreate them
    console.log('Dropping and recreating all tables...');
    await sequelize.sync({ force: true });
    
    console.log('✅ All tables have been recreated successfully!');
    
    // Optionally add a test admin user
    console.log('Creating test admin user...');
    const adminPassword = 'password123';
    
    const admin = await User.create({
      id: uuidv4(),
      email: 'yaront111@gmail.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      nickname: 'admin',
      birthDate: '1990-01-01',
      gender: 'other',
      lookingFor: ['all'],
      role: 'admin',
      isOnline: true,
      lastActive: new Date()
    });
    
    // Create admin profile
    await Profile.create({
      id: uuidv4(),
      userId: admin.id,
      bio: 'System administrator',
      interests: ['Technology', 'System Management']
    });
    
    console.log('✅ Test admin user created with email: admin@example.com and password: admin123');
    
    // Create a test regular user
    console.log('Creating test regular user...');
    const userPassword = await bcrypt.hash('user123', 10);
    
    const user = await User.create({
      id: uuidv4(),
      email: 'user@example.com',
      password: userPassword,
      firstName: 'Test',
      lastName: 'User',
      nickname: 'testuser',
      birthDate: '1995-05-15',
      gender: 'male',
      lookingFor: ['dating', 'sex'],
      role: 'user',
      isOnline: true,
      lastActive: new Date()
    });
    
    // Create user profile
    await Profile.create({
      id: uuidv4(),
      userId: user.id,
      bio: 'Regular test user account',
      interests: ['Music', 'Movies', 'Travel']
    });
    
    console.log('✅ Test regular user created with email: user@example.com and password: user123');
    
    console.log('Database rebuild completed successfully!');
    return true;
  } catch (error) {
    console.error('Error rebuilding database:', error);
    return false;
  }
}

// Run the function
rebuildDatabase()
  .then((success) => {
    if (success) {
      console.log('Done! Exiting...');
    } else {
      console.log('Failed to rebuild database. Check the errors above.');
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
