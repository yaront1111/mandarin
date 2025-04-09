// seed.js - Enhanced for development and testing
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs'; // Using bcryptjs for compatibility
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

// --- Configuration ---
const MONGO_URI = 'mongodb://localhost:27017/mandarin';
const NUM_USERS = 20; // Fewer users for development
const SALT_ROUNDS = 12;
const ADMIN_EMAIL = 'yaront111@gmail.com';

// Check for --clean flag to completely clean the database
const CLEAN_DATABASE = process.argv.includes('--clean');

// --- Import Mongoose Models ---
import User from './models/User.js';
import Like from './models/Like.js';
import PhotoPermission from './models/PhotoPermission.js';
import logger from './logger.js';

// --- Helper Functions ---
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomUniqueElements = (arr, count) => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, arr.length));
};

// --- Basic Data Arrays ---

// Names
const firstNames = [
  // Hebrew names
  'אורי', 'שירה', 'נועם', 'מיכל', 'עידן', 'דניאל', 'יעל', 'איתי', 'רונית', 'אמיר',
  'מאיה', 'גיא', 'שני', 'עמית', 'תמר', 'יובל', 'הילה', 'עומר', 'נטע', 'אלון',
  // English names
  'James', 'John', 'Robert', 'Michael', 'David', 'Mary', 'Sarah', 'Emma', 'Olivia', 'Emily'
];

// Nicknames
const nicknames = [
  'Explorer', 'Dreamer', 'Traveler', 'Adventurer', 'Creator', 'Stargazer', 'Sunshine',
  'Wanderer', 'Seeker', 'FunLover', 'NightOwl', 'DayDreamer', 'Voyager', 'Nomad', 'FreeSoul'
];

// Israeli locations
const locations = [
  'תל אביב', 'תל אביב צפון', 'רמת אביב', 'פלורנטין', 'רוטשילד', 'הרצליה פיתוח', 'רמת השרון',
  'רעננה', 'כפר סבא', 'נתניה', 'ראשון לציון', 'אשדוד', 'אשקלון', 'מודיעין', 'ירושלים',
  'חיפה', 'קריות', 'באר שבע', 'אילת', 'הוד השרון', 'פתח תקווה', 'רמת גן', 'בת ים'
];

// Interests with both Hebrew and English options
const interests = [
  // Hebrew interests
  "טיולים", "קריאה", "בישול", "צילום", "מוזיקה", "סרטים", "ספורט", "ריקוד",
  "אומנות", "כתיבה", "יוגה", "מדיטציה", "שחייה", "ריצה", "אופניים",
  // English interests
  "Travel", "Reading", "Cooking", "Photography", "Music", "Movies", "Sports", "Dancing",
  "Art", "Writing", "Yoga", "Meditation", "Swimming", "Running", "Cycling"
];

// "Into" tags
const intoTags = [
  // Hebrew tags
  'שיחות עמוקות', 'הרפתקאות', 'ערבי סרטים', 'ימי חוף', 'כושר',
  'חוויות קולינריות', 'גלריות אמנות', 'מוזיקה חיה',
  // English tags
  'Deep Conversations', 'Spontaneous Adventures', 'Movie Nights', 'Beach Days', 'Fitness',
  'Food Experiences', 'Art Galleries', 'Live Music', 'Theater', 'Outdoor Activities'
];

// Turn-ons
const turnOns = [
  // Hebrew turn-ons
  'אינטליגנציה', 'חוש הומור', 'ביטחון', 'אדיבות', 'שאפתנות', 'תשוקה',
  'כנות', 'יצירתיות', 'הרפתקנות', 'פתיחות',
  // English turn-ons
  'Intelligence', 'Humor', 'Confidence', 'Kindness', 'Ambition', 'Passion',
  'Honesty', 'Creativity', 'Adventure', 'Openness'
];

// IMPORTANT: Must match the enum values in User.js model schema
const VALID_IAM_VALUES = ["woman", "man", "couple"];
const VALID_LOOKING_FOR = ["women", "men", "couples"];
const VALID_MARITAL_STATUS = [
  "Single", "Married", "Divorced", "Separated", "Widowed",
  "In a relationship", "It's complicated", "Open relationship", "Polyamorous"
];

// --- Bio Templates ---
const bioTemplates = [
  // English templates for men
  (details) => `${details.age} year old guy living in ${details.location}. I enjoy ${details.interests[0] || 'traveling'} and ${details.interests[1] || 'music'}. Looking to connect with interesting people.`,
  
  // English templates for women
  (details) => `${details.age} year old woman from ${details.location}. Passionate about ${details.interests[0] || 'art'} and ${details.interests[1] || 'yoga'}. Looking to meet new people.`,
  
  // English templates for couples
  (details) => `Couple in ${details.location}, both in our ${details.age}s. We enjoy ${details.interests[0] || 'traveling'} and ${details.interests[1] || 'music'} together. Looking to make new connections.`,
  
  // Hebrew templates for men
  (details) => `בן ${details.age}, גר ב${details.location}. אוהב ${details.interests[0] || 'טיולים'} ו${details.interests[1] || 'מוזיקה'}. מחפש קשר עם מישהי מעניינת.`,
  
  // Hebrew templates for women
  (details) => `בת ${details.age}, גרה ב${details.location}. אוהבת ${details.interests[0] || 'אמנות'} ו${details.interests[1] || 'ספורט'}. מחפשת להכיר אנשים חדשים.`,
  
  // Hebrew templates for couples
  (details) => `זוג בשנות ה${details.age}, מ${details.location}. אוהבים ${details.interests[0] || 'טיולים'} ו${details.interests[1] || 'בישול'}. מחפשים להכיר אנשים חדשים.`
];

// --- Clean Database Function ---
const cleanDatabase = async () => {
  logger.warn('CLEANING DATABASE: Removing all data from collections...');

  // Get all collections in the database
  const collections = mongoose.connection.collections;

  // Drop all collections except for system collections
  for (const collectionName in collections) {
    if (!collectionName.startsWith('system.')) {
      try {
        await collections[collectionName].deleteMany({});
        logger.info(`Cleared collection: ${collectionName}`);
      } catch (err) {
        logger.error(`Error clearing collection ${collectionName}: ${err.message}`);
      }
    }
  }

  logger.warn('DATABASE CLEANED: All collections have been emptied.');

  // Re-create admin user
  const adminPassword = await bcrypt.hash('admin123', SALT_ROUNDS);
  const adminUser = new User({
    nickname: 'Admin',
    username: 'admin',
    email: ADMIN_EMAIL,
    password: adminPassword,
    role: 'admin',
    accountTier: 'PAID',
    isVerified: true,
    active: true
  });

  await adminUser.save();
  logger.info(`Re-created admin user ${ADMIN_EMAIL}`);

  return true;
};

// --- Generate unique couple name ---
const generateCoupleName = () => {
  const name1 = getRandomElement(firstNames);
  let name2 = getRandomElement(firstNames);
  
  // Ensure different names
  while (name1 === name2) {
    name2 = getRandomElement(firstNames);
  }

  // Use Hebrew connector or English "&" randomly
  const connector = Math.random() < 0.5 ? " ו" : " & ";
  return `${name1}${connector}${name2}`;
};

// --- Main Seeding Function ---
const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info('MongoDB Connected for development seeding...');

    // Clean the database if requested
    if (CLEAN_DATABASE) {
      await cleanDatabase();
    }

    // --- Check for Admin User ---
    const adminExists = await User.findOne({ email: ADMIN_EMAIL });

    if (adminExists) {
      logger.info(`Admin user ${ADMIN_EMAIL} already exists. Will be preserved.`);

      // Ensure admin has proper role and tier
      if (adminExists.role !== 'admin') {
        await User.findByIdAndUpdate(adminExists._id, { role: 'admin' });
        logger.info(`Updated ${ADMIN_EMAIL} to admin role.`);
      }
    } else {
      logger.warn(`Admin user ${ADMIN_EMAIL} not found. Will create one.`);

      // Create admin user if not exists
      const adminPassword = await bcrypt.hash('admin123', SALT_ROUNDS);
      const adminUser = new User({
        nickname: 'Admin',
        username: 'admin',
        email: ADMIN_EMAIL,
        password: adminPassword,
        role: 'admin',
        accountTier: 'PAID',
        isVerified: true,
        active: true
      });

      await adminUser.save();
      logger.info(`Created admin user ${ADMIN_EMAIL}`);
    }

    // --- Check Existing User Count ---
    const existingUserCount = await User.countDocuments({});
    logger.info(`Found ${existingUserCount} existing users.`);

    // Calculate how many more users we need to create
    let usersToCreate = 0;

    if (CLEAN_DATABASE) {
      usersToCreate = NUM_USERS; // Create full set after cleaning
    } else {
      if (existingUserCount < NUM_USERS) {
        usersToCreate = NUM_USERS - existingUserCount;

        // Clear existing seed-generated data but preserve real users
        logger.warn('Removing seed-generated data only...');
        await User.deleteMany({ 'details.seedGenerated': true });
        await Like.deleteMany({});
        await PhotoPermission.deleteMany({});
        logger.info('Seed-generated data cleared.');
      } else {
        logger.warn(`Database already has ${existingUserCount} users, which exceeds the target of ${NUM_USERS}.`);
        logger.warn('Skipping user creation but will add missing data to existing users if needed.');
      }
    }

    logger.info(`Will create ${usersToCreate} additional users.`);

    // Get existing users after possible deletion
    const existingUsers = await User.find({});
    const createdUserIds = existingUsers.map(user => user._id.toString());
    let createdUsers = [...existingUsers];

    // --- 1. Seed Users with Development Profiles ---
    if (usersToCreate > 0) {
      logger.info(`Seeding ${usersToCreate} users with development profiles...`);
      for (let i = 0; i < usersToCreate; i++) {
        try {
          // Decide user type first to guide other selections
          // IMPORTANT: Must use valid enum values from User model
          const iAm = getRandomElement(VALID_IAM_VALUES);

          // Generate appropriate name based on user type
          let nickname;
          if (iAm === 'couple') {
            nickname = generateCoupleName();
          } else if (iAm === 'woman') {
            nickname = getRandomElement(firstNames);
            // Add a last name sometimes
            if (Math.random() > 0.7) {
              nickname = `${nickname} ${getRandomElement(['Cohen', 'Levy', 'Dahan', 'Peretz'])}`;
            }
          } else { // man
            nickname = getRandomElement(firstNames);
            // Add a last name sometimes
            if (Math.random() > 0.7) {
              nickname = `${nickname} ${getRandomElement(['Cohen', 'Levy', 'Dahan', 'Peretz'])}`;
            }
          }

          // Ensure nickname is at least 3 characters (required by schema)
          if (nickname.length < 3) {
            nickname += " " + getRandomElement(nicknames);
          }

          // Generate username from nickname
          const username = nickname.toLowerCase().replace(/\s+/g, '') + getRandomInt(1, 999);

          // Generate appropriate looking for options - CRITICAL: use VALID_LOOKING_FOR array
          const lookingForCount = getRandomInt(1, 3);
          const lookingFor = getRandomUniqueElements(VALID_LOOKING_FOR, lookingForCount);
          
          // Age based on user type
          let age;
          if (iAm === 'couple') {
            age = getRandomInt(25, 45);
          } else if (iAm === 'woman') {
            age = getRandomInt(22, 40);
          } else { // man
            age = getRandomInt(24, 48);
          }

          // Select appropriate account tier
          let accountTier;
          if (iAm === 'woman') {
            accountTier = 'FEMALE';
          } else if (iAm === 'couple') {
            accountTier = 'COUPLE';
          } else { // man
            accountTier = Math.random() < 0.3 ? 'PAID' : 'FREE';
          }

          // Select gender based on iAm for mongoDB model (not display)
          let gender;
          if (iAm === 'woman') {
            gender = 'female';
          } else if (iAm === 'man') {
            gender = 'male';
          } else { // couple
            gender = Math.random() > 0.5 ? 'male' : 'female'; // Primary account holder
          }

          // Select interest count
          const interestCount = getRandomInt(2, 4);
          
          // Select non-duplicate interests
          const userInterests = getRandomUniqueElements(interests, interestCount);
          
          // Select non-duplicate into tags
          const intoTagsCount = getRandomInt(2, 4);
          const userIntoTags = getRandomUniqueElements(intoTags, intoTagsCount);
          
          // Select non-duplicate turn-ons
          const turnOnsCount = getRandomInt(2, 4);
          const userTurnOns = getRandomUniqueElements(turnOns, turnOnsCount);
          
          // IMPORTANT: Select marital status from VALID_MARITAL_STATUS only
          const maritalStatus = getRandomElement(VALID_MARITAL_STATUS);
          
          // Build user details object
          const userDetails = {
            age,
            gender,
            location: getRandomElement(locations),
            interests: userInterests,
            iAm, // Using valid enum value
            lookingFor, // Using valid enum values array
            intoTags: userIntoTags,
            turnOns: userTurnOns,
            maritalStatus, // Using valid enum value
            seedGenerated: true // Mark as generated by seed
          };
          
          // Select bio template based on iAm
          let bioTemplate;
          if (iAm === 'man') {
            bioTemplate = Math.random() < 0.5 ? bioTemplates[0] : bioTemplates[3];
          } else if (iAm === 'woman') {
            bioTemplate = Math.random() < 0.5 ? bioTemplates[1] : bioTemplates[4];
          } else { // couple
            bioTemplate = Math.random() < 0.5 ? bioTemplates[2] : bioTemplates[5];
          }
          
          userDetails.bio = bioTemplate(userDetails);
          
          // Create the final user object
          const plainPassword = 'password123';
          const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);
          
          const userData = {
            nickname,
            username,
            email: `${username}@example.com`,
            password: hashedPassword,
            accountTier,
            details: userDetails,
            isOnline: Math.random() < 0.3, // 30% chance to be online
            lastActive: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 7)), // Within last week
            isVerified: true,
            active: true,
          };
          
          const newUser = new User(userData);
          const savedUser = await newUser.save();
          createdUserIds.push(savedUser._id.toString());
          createdUsers.push(savedUser);
          
          if ((i + 1) % 5 === 0) {
            logger.info(`Created ${i + 1} users so far...`);
          }
        } catch (error) {
          logger.error(`Error creating user: ${error.message}. Skipping user.`);
          if (error.errors) {
            Object.keys(error.errors).forEach(key => {
              logger.error(`Validation Error (${key}): ${error.errors[key].message}`);
            });
          }
        }
      }
      
      logger.info(`Successfully created ${createdUsers.length - existingUsers.length} additional users.`);
    }

    // --- 2. Seed Likes Between Users ---
    logger.info('Seeding likes between users...');
    
    if (createdUserIds.length >= 2) {
      // Set number of likes to create based on user count
      const NUM_LIKES_TO_SEED = Math.min(40, createdUserIds.length * 2);
      
      for (let i = 0; i < NUM_LIKES_TO_SEED; i++) {
        // Get random user IDs
        let senderId = getRandomElement(createdUserIds);
        let recipientId = getRandomElement(createdUserIds);
        
        // Ensure we're not liking ourselves
        while (senderId === recipientId) {
          recipientId = getRandomElement(createdUserIds);
        }
        
        try {
          // Create like with possibility of it being mutual
          const isMutual = Math.random() < 0.5;
          
          const like = new Like({
            sender: senderId,
            recipient: recipientId,
            createdAt: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 48))
          });
          
          await like.save();
          
          // If mutual, create the reciprocal like
          if (isMutual) {
            const reciprocalLike = new Like({
              sender: recipientId,
              recipient: senderId,
              createdAt: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24))
            });
            
            await reciprocalLike.save();
            i++; // Count this as another seeded like
          }
        } catch (error) {
          // If it's a duplicate key error, just continue
          if (error.code !== 11000) {
            logger.error(`Error creating like: ${error.message}`);
          }
        }
      }
      
      logger.info(`Created approximately ${NUM_LIKES_TO_SEED} likes between users`);
    } else {
      logger.warn('Not enough users to seed likes');
    }

    logger.info('Development database seeding completed successfully!');

  } catch (error) {
    logger.error('Database seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected.');
  }
};

// Log info about running modes
if (CLEAN_DATABASE) {
  console.log('=================================');
  console.log('RUNNING WITH --clean OPTION: The database will be completely wiped before seeding!');
  console.log('=================================');
} else {
  console.log('=================================');
  console.log('RUNNING WITHOUT --clean OPTION: Only seed-generated data will be removed.');
  console.log('To completely clean the database, use: node seed.js --clean');
  console.log('=================================');
}

// Run the seeding function
seedDatabase();