// seedDatabase from scraped data
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// --- Configuration ---
const MONGO_URI = 'mongodb://localhost:27017/mandarin';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Import Mongoose Models ---
import User from './models/User.js';
import Like from './models/Like.js';
import PhotoPermission from './models/PhotoPermission.js';
import logger from './logger.js';

// --- Helper Functions ---
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Generate a random online status
const generateOnlineStatus = () => {
  // 30% chance of being online
  return Math.random() < 0.3;
};

// Generate last active time
const generateLastActive = (isOnline) => {
  if (isOnline) {
    return new Date(); // Currently online
  }
  // Random time in the last 7 days
  const hoursAgo = getRandomInt(1, 168);
  const date = new Date();
  date.setHours(date.getHours() - hoursAgo);
  return date;
};

// Add private photos placeholder
const addPrivatePhotos = (existingPhotos) => {
  const additionalPhotos = [];
  
  // 40% chance to add 1-2 private photos
  if (Math.random() < 0.4) {
    const numPrivatePhotos = getRandomInt(1, 2);
    const privatePhotoUrls = [
      '/uploads/seed/placeholder_1.jpg',
      '/uploads/seed/placeholder_2.png',
      '/uploads/seed/placeholder_3.png',
      '/uploads/seed/placeholder_4.png',
      '/uploads/seed/placeholder_5.jpg',
      '/uploads/seed/placeholder_6.png',
      '/uploads/seed/placeholder_7.jpg',
      '/uploads/seed/placeholder_8.png',
    ];
    
    for (let i = 0; i < numPrivatePhotos; i++) {
      additionalPhotos.push({
        url: getRandomElement(privatePhotoUrls),
        isProfile: false,
        privacy: 'private',
        isDeleted: false,
        uploadedAt: new Date(Date.now() - getRandomInt(1, 365) * 24 * 60 * 60 * 1000),
        metadata: {
          filename: `private_${crypto.randomBytes(8).toString('hex')}.jpg`,
          size: getRandomInt(100000, 500000),
          mimeType: 'image/jpeg',
          width: getRandomInt(800, 2000),
          height: getRandomInt(800, 2000)
        }
      });
    }
  }
  
  return additionalPhotos;
};

// Generate random tags for users
const generateRandomTags = () => {
  const interests = [
    "Dating", "Casual", "Friendship", "Long-term", "Travel", "Outdoors",
    "Movies", "Music", "Fitness", "Food", "Art", "Gaming", "Reading", "Tech",
    "Photography", "Dancing", "Cooking", "Sports", "Fashion", "Wine",
    "Beer", "Coffee", "Hiking", "Beach", "Yoga", "Meditation", "Parties",
    "Nightlife", "Museums", "Theatre", "Books", "Nature", "Adventure"
  ];
  
  const intoTags = [
    "Meetups", "Online fun", "Long walks", "Netflix & chill", "Road trips",
    "Weekend getaways", "Fine dining", "Street food", "Live music", "Festivals",
    "Working out", "Running", "Swimming", "Cycling", "Rock climbing",
    "Surfing", "Skiing", "Board games", "Video games", "Karaoke",
    "Comedy shows", "Jazz bars", "Wine tasting", "Craft beer", "Cocktails",
    "Brunch", "Picnics", "Camping", "Photography walks", "Art galleries"
  ];
  
  const turnOns = [
    "Intelligence", "Confidence", "Sense of humor", "Kindness", "Creativity",
    "Ambition", "Passion", "Authenticity", "Open-mindedness", "Adventure",
    "Good conversation", "Eye contact", "Smiles", "Spontaneity", "Romance",
    "Loyalty", "Honesty", "Respect", "Communication", "Emotional maturity",
    "Physical fitness", "Style", "Tattoos", "Accents", "Musicians",
    "Artists", "Entrepreneurs", "Travelers", "Foodies", "Dog lovers"
  ];
  
  // Function to get random items from an array
  const getRandomItems = (arr, min, max) => {
    const count = getRandomInt(min, max);
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };
  
  return {
    interests: getRandomItems(interests, 3, 7),
    intoTags: getRandomItems(intoTags, 3, 8),
    turnOns: getRandomItems(turnOns, 3, 6)
  };
};

// Copy scraped photos to server uploads directory
const copyScrapedPhotos = async () => {
  const sourceDir = path.join(__dirname, '../scraper/scraped_data_zbeng_full_refactor/photos');
  const targetDir = path.join(__dirname, 'uploads/images');
  
  try {
    // Create target directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      logger.info(`Created directory: ${targetDir}`);
    }
    
    // Check if source directory exists
    if (!fs.existsSync(sourceDir)) {
      logger.error(`Source directory does not exist: ${sourceDir}`);
      return;
    }
    
    // Read all files from source directory
    const files = fs.readdirSync(sourceDir);
    logger.info(`Found ${files.length} files in source directory`);
    
    let copiedCount = 0;
    let skippedCount = 0;
    
    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);
      
      // Check if it's a file
      const stats = fs.statSync(sourcePath);
      if (!stats.isFile()) {
        logger.info(`Skipping directory: ${file}`);
        continue;
      }
      
      // Only copy if file doesn't exist in target
      if (!fs.existsSync(targetPath)) {
        fs.copyFileSync(sourcePath, targetPath);
        copiedCount++;
      } else {
        skippedCount++;
      }
    }
    
    logger.info(`Copied ${copiedCount} photos to uploads directory.`);
    logger.info(`Skipped ${skippedCount} photos (already exist).`);
    logger.info(`Total photos in uploads directory: ${fs.readdirSync(targetDir).filter(f => fs.statSync(path.join(targetDir, f)).isFile()).length}`);
    
  } catch (error) {
    logger.error('Error copying photos:', error);
  }
};

// --- Main Seeding Function ---
const seedDatabase = async () => {
  try {
    // First copy the scraped photos
    logger.info('Copying scraped photos to uploads directory...');
    await copyScrapedPhotos();
    
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    logger.info('MongoDB connected for seeding scraped data.');

    // Read scraped data (use the new file with correct photo mappings)
    const scrapedDataPath = path.join(__dirname, '../scraper/scraped_data_zbeng_full_refactor/seed_users_with_photos.json');
    let scrapedUsers = [];
    
    try {
      const fileContent = fs.readFileSync(scrapedDataPath, 'utf8');
      scrapedUsers = JSON.parse(fileContent);
      
      // Fix photo paths from /uploads/photos/ to /uploads/images/
      scrapedUsers = scrapedUsers.map(user => {
        if (user.photos && user.photos.length > 0) {
          user.photos = user.photos.map(photo => ({
            ...photo,
            url: photo.url.replace('/uploads/photos/', '/uploads/images/')
          }));
        }
        return user;
      });
      
      logger.info(`Loaded ${scrapedUsers.length} users from scraped data.`);
    } catch (error) {
      logger.error(`Error reading scraped data: ${error.message}`);
      return;
    }

    // Clear existing data
    await User.deleteMany({});
    await Like.deleteMany({});
    await PhotoPermission.deleteMany({});
    logger.info('Cleared existing data.');

    // Insert scraped users with modifications
    const createdUsers = [];
    
    for (const userData of scrapedUsers) {
      try {
        // Generate online status
        const isOnline = generateOnlineStatus();
        const lastActive = generateLastActive(isOnline);
        
        // Add private photos to existing photos
        const privatePhotos = addPrivatePhotos(userData.photos || []);
        const allPhotos = [...(userData.photos || []), ...privatePhotos];
        
        // Generate random tags for this user
        const randomTags = generateRandomTags();
        
        // Update user data
        const modifiedUserData = {
          ...userData,
          isOnline,
          lastActive,
          photos: allPhotos,
          // Ensure required fields are set
          active: true,
          isVerified: true,
          createdAt: userData.createdAt || new Date(Date.now() - getRandomInt(30, 365) * 24 * 60 * 60 * 1000),
          updatedAt: userData.updatedAt || lastActive,
          // Override details with random tags
          details: {
            ...userData.details,
            interests: randomTags.interests,
            intoTags: randomTags.intoTags,
            turnOns: randomTags.turnOns
          }
        };
        
        // Make sure photos have correct structure and fix paths
        modifiedUserData.photos = modifiedUserData.photos.map((photo, index) => ({
          ...photo,
          url: photo.url.replace('/uploads/photos/', '/uploads/images/'), // Fix path
          isProfile: photo.isProfile || (index === 0),
          privacy: photo.privacy || 'public',
          isDeleted: photo.isDeleted || false,
          uploadedAt: photo.uploadedAt || new Date(),
          metadata: photo.metadata || {
            filename: path.basename(photo.url),
            size: getRandomInt(100000, 500000),
            mimeType: 'image/jpeg',
            width: getRandomInt(800, 2000),
            height: getRandomInt(800, 2000)
          }
        }));
        
        const newUser = new User(modifiedUserData);
        await newUser.save();
        createdUsers.push(newUser);
        
        logger.info(`Created user: ${newUser.nickname} (${newUser.email})`);
      } catch (error) {
        logger.error(`Error creating user ${userData.email}: ${error.message}`);
      }
    }

    logger.info(`Successfully created ${createdUsers.length} users from scraped data.`);

    // Seed random likes between users
    const numLikes = Math.min(createdUsers.length * 3, 300);
    let likesCreated = 0;
    
    for (let i = 0; i < numLikes; i++) {
      try {
        const sender = getRandomElement(createdUsers);
        const recipient = getRandomElement(createdUsers.filter(u => u._id.toString() !== sender._id.toString()));
        
        // Check if like already exists
        const existingLike = await Like.findOne({ sender: sender._id, recipient: recipient._id });
        if (!existingLike) {
          await Like.create({
            sender: sender._id,
            recipient: recipient._id,
            message: `I think you're ${['amazing', 'interesting', 'attractive', 'wonderful'][getRandomInt(0, 4)]}!`,
            createdAt: new Date(Date.now() - getRandomInt(1, 30) * 24 * 60 * 60 * 1000)
          });
          likesCreated++;
        }
      } catch (error) {
        logger.error(`Error creating like: ${error.message}`);
      }
    }
    
    logger.info(`Created ${likesCreated} likes between users.`);

    // Seed photo permission requests for private photos
    const usersWithPrivatePhotos = createdUsers.filter(user => 
      user.photos.some(photo => photo.privacy === 'private')
    );
    
    const numRequests = Math.min(usersWithPrivatePhotos.length * 2, 100);
    let requestsCreated = 0;
    
    for (let i = 0; i < numRequests; i++) {
      try {
        const owner = getRandomElement(usersWithPrivatePhotos);
        const requester = getRandomElement(createdUsers.filter(u => u._id.toString() !== owner._id.toString()));
        
        // Get owner's private photos
        const privatePhotos = owner.photos.filter(photo => photo.privacy === 'private');
        if (privatePhotos.length === 0) continue;
        
        const targetPhoto = getRandomElement(privatePhotos);
        
        // Check if permission already exists
        const existingPermission = await PhotoPermission.findOne({ 
          photo: targetPhoto._id, 
          requestedBy: requester._id 
        });
        
        if (!existingPermission) {
          const status = getRandomElement(['pending', 'approved', 'rejected']);
          await PhotoPermission.create({
            photo: targetPhoto._id,
            requestedBy: requester._id,
            photoOwnerId: owner._id,
            status,
            message: status === 'pending' ? 'I would love to see your private photos!' : null,
            respondedAt: status !== 'pending' ? new Date() : null,
            expiresAt: status === 'approved' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
            createdAt: new Date(Date.now() - getRandomInt(1, 30) * 24 * 60 * 60 * 1000)
          });
          requestsCreated++;
        }
      } catch (error) {
        logger.error(`Error creating photo permission: ${error.message}`);
      }
    }
    
    logger.info(`Created ${requestsCreated} photo permission requests.`);

    // Create test user
    try {
      await User.deleteOne({ email: 'test@example.com' });
      
      // Generate random tags for test user too
      const testUserTags = generateRandomTags();
      
      const testUser = new User({
        nickname: 'Test User',
        username: 'testuser',
        email: 'test@example.com',
        password: '$2a$12$hWJXPxS3KgZjGm5h0wKxI.1v0FhewGYQBrPLYJq9lYZxJqGc7xRLa', // password123
        role: 'user',
        accountTier: 'PAID',
        details: {
          age: 30,
          gender: 'male',
          location: 'Tel Aviv',
          interests: testUserTags.interests,
          iAm: 'man',
          lookingFor: ['women', 'couples'],
          intoTags: testUserTags.intoTags,
          turnOns: testUserTags.turnOns,
          maritalStatus: 'Single',
          bio: 'This is a test user account with predictable login credentials.'
        },
        photos: [
          {
            url: '/uploads/seed/placeholder_1.jpg',
            isProfile: true,
            privacy: 'public',
            isDeleted: false,
            uploadedAt: new Date(),
            metadata: {
              filename: 'test_photo_1.jpg',
              size: 123456,
              mimeType: 'image/jpeg',
              width: 1000,
              height: 1000
            }
          }
        ],
        isOnline: true,
        lastActive: new Date(),
        isVerified: true,
        active: true,
      });
      
      await testUser.save();
      logger.info('Created test user with email: test@example.com and password: password123');
    } catch (error) {
      logger.error(`Error creating test user: ${error.message}`);
    }

    logger.info('Database seeding from scraped data completed successfully!');

  } catch (error) {
    logger.error('Database seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected.');
  }
};

// Run the seeding function
seedDatabase();