// seed.js - Basic version for local development
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs'; // Changed from bcrypt to bcryptjs to match model
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

// --- Configuration ---
const MONGO_URI = 'mongodb://localhost:27017/mandarin';
const NUM_USERS = 20; // Fewer users for local development
const SALT_ROUNDS = 12;
const ADMIN_EMAIL = 'yaront111@gmail.com'; // Updated to match production

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
const firstNames = [
  // Hebrew names
  'אורי', 'שירה', 'נועם', 'מיכל', 'עידן', 'דניאל', 'יעל', 'איתי', 'רונית', 'אמיר',
  'מאיה', 'גיא', 'שני', 'עמית', 'תמר', 'יובל', 'הילה', 'עומר', 'נטע', 'אלון',
  // English names
  'James', 'John', 'Robert', 'Michael', 'David', 'Mary', 'Sarah', 'Emma', 'Olivia', 'Emily'
];

const nicknames = [
  'Explorer', 'Dreamer', 'Traveler', 'Adventurer', 'Creator', 'Stargazer', 'Sunshine', 'Moonlight',
  'Wanderer', 'Seeker', 'FunLover', 'NightOwl', 'DayDreamer', 'Voyager', 'Nomad', 'FreeSoul', 'OpenMind'
];

const locations = [
  'תל אביב', 'תל אביב צפון', 'רמת אביב', 'פלורנטין', 'רוטשילד', 'הרצליה פיתוח', 'רמת השרון',
  'רעננה', 'כפר סבא', 'נתניה', 'ראשון לציון', 'אשדוד', 'אשקלון', 'מודיעין', 'ירושלים',
  'חיפה', 'קריות', 'באר שבע', 'אילת', 'הוד השרון', 'פתח תקווה', 'רמת גן', 'בת ים'
];

const interests = [
  'Reading', 'Traveling', 'Cooking', 'Photography', 'Hiking', 'Movies', 'Music', 'Dancing',
  'Painting', 'Writing', 'Yoga', 'Meditation', 'Swimming', 'Running', 'Cycling', 'Gaming',
  'Gardening', 'Fishing', 'Camping', 'Singing', 'Playing Guitar', 'Chess', 'Tennis', 'Basketball'
];

const intoTags = [
  'Deep Conversations', 'Spontaneous Adventures', 'Movie Nights', 'Beach Days', 'Fitness',
  'Foodie Experiences', 'Art Galleries', 'Live Music', 'Theater', 'Outdoor Activities', 
  'Weekend Getaways', 'Coffee Dates', 'Wine Tasting', 'Concerts', 'Festivals'
];

const turnOns = [
  'Intelligence', 'Sense of Humor', 'Confidence', 'Kindness', 'Ambition', 'Passion',
  'Honesty', 'Creativity', 'Adventure', 'Openness', 'Good Listener', 'Thoughtfulness',
  'Compassion', 'Playfulness', 'Generosity', 'Independence', 'Reliability'
];

// Make sure these match exactly with the enum values in User.js model
const maritalStatusOptions = [
  "Single", "Married", "Divorced", "Separated", "Widowed",
  "In a relationship", "It's complicated", "Open relationship", "Polyamorous"
];

// --- Bio Templates ---
const bioTemplates = [
  // English templates
  (details) => `Hi, I'm ${details.age} years old and from ${details.location}. I enjoy ${details.interests[0] || 'traveling'} and ${details.interests[1] || 'reading'}. Looking to connect with like-minded people.`,
  
  (details) => `${details.maritalStatus || 'Single'} and enjoying life in ${details.location}. Passionate about ${details.interests[0] || 'music'} and ${details.interests[1] || 'art'}. Let's get to know each other!`,
  
  (details) => `${details.age} year old ${details.gender || 'person'} living in ${details.location}. I'm into ${details.interests[0] || 'fitness'} and ${details.interests[1] || 'cooking'}. Looking forward to making connections here.`,
  
  // Hebrew templates
  (details) => `אני בן/בת ${details.age} מ${details.location}, אוהב/ת ${details.interests[0] || 'טיולים'} ו${details.interests[1] || 'מוזיקה'}. מחפש/ת אנשים מעניינים לשיחה.`,
  
  (details) => `${details.maritalStatus || 'Single'} מ${details.location}, נהנה/ית מ${details.interests[0] || 'ספורט'} ו${details.interests[1] || 'בישול'}. בואו נכיר!`,
  
  (details) => `בן/בת ${details.age}, גר/ה ב${details.location}. אוהב/ת ${details.interests[0] || 'קולנוע'} ו${details.interests[1] || 'מוזיקה'}. מחפש/ת קשרים משמעותיים.`
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

    logger.info(`Will create ${usersToCreate} basic development users.`);

    // --- Seed Users with Basic Development Data ---
    if (usersToCreate > 0) {
      logger.info(`Seeding ${usersToCreate} users with basic profiles...`);
      for (let i = 0; i < usersToCreate; i++) {
        // Generate user data
        const isMale = Math.random() > 0.5;
        const isCouple = Math.random() > 0.9; // 10% chance to be a couple
        
        // Decide user type first to guide other selections - must match enum in User.js
        const iAm = isCouple ? "couple" : (isMale ? "man" : "woman");
        
        // Generate appropriate name based on user type
        let nickname;
        if (isCouple) {
          const name1 = getRandomElement(firstNames);
          let name2 = getRandomElement(firstNames);
          while (name1 === name2) {
            name2 = getRandomElement(firstNames);
          }
          nickname = `${name1} & ${name2}`;
        } else {
          nickname = getRandomElement(firstNames);
          if (Math.random() > 0.5) {
            nickname = `${nickname} ${Math.random() > 0.5 ? getRandomElement(nicknames) : ""}`;
          }
        }
        
        // Username 
        const username = nickname.toLowerCase().replace(/\s+/g, '') + getRandomInt(1, 999);
        
        // Generate valid lookingFor options - MUST match validation in User.js
        let lookingFor = [];
        
        // Add 1 to 3 valid options from ["women", "men", "couples"]
        const validOptions = ["women", "men", "couples"];
        const numOptions = getRandomInt(1, 3);
        lookingFor = getRandomUniqueElements(validOptions, numOptions);
        
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
        
        // Select gender based on iAm
        let gender;
        if (iAm === 'woman') {
          gender = 'female';
        } else if (iAm === 'man') {
          gender = 'male';
        } else { // couple
          gender = Math.random() > 0.5 ? 'male' : 'female'; // Represent primary account holder
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
        
        // Select marital status from valid options only
        let maritalStatus = getRandomElement(maritalStatusOptions);
        
        // Build user details object
        const userDetails = {
          age,
          gender,
          location: getRandomElement(locations),
          interests: userInterests,
          iAm,
          lookingFor,
          intoTags: userIntoTags,
          turnOns: userTurnOns,
          maritalStatus,
          seedGenerated: true // Mark as generated by seed for future reference
        };
        
        // Select bio template
        const bioTemplate = getRandomElement(bioTemplates);
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
        
        try {
          const newUser = new User(userData);
          await newUser.save();
          
          if ((i + 1) % 10 === 0) {
            logger.info(`Created ${i + 1} users so far...`);
          }
        } catch (error) {
          logger.error(`Error creating user ${nickname}: ${error.message}. Skipping user.`);
          if (error.errors) {
            Object.keys(error.errors).forEach(key => {
              logger.error(`Validation Error (${key}): ${error.errors[key].message}`);
            });
          }
        }
      }
      
      logger.info(`Successfully created development users.`);
    }

    // --- Add Likes Between Users ---
    if (usersToCreate > 0) {
      logger.info('Seeding likes between users...');
      
      // Get all users
      const allUsers = await User.find({});
      const userIds = allUsers.map(user => user._id.toString());
      
      // Make sure we have enough users to create likes
      if (userIds.length >= 2) {
        const NUM_LIKES_TO_SEED = Math.min(30, userIds.length * 2);
        
        for (let i = 0; i < NUM_LIKES_TO_SEED; i++) {
          // Get random user IDs
          let fromUserId = getRandomElement(userIds);
          let toUserId = getRandomElement(userIds);
          
          // Ensure we're not liking ourselves
          while (fromUserId === toUserId) {
            toUserId = getRandomElement(userIds);
          }
          
          try {
            // Create like with possibility of it being mutual
            const isMutual = Math.random() < 0.5;
            
            const like = new Like({
              fromUser: fromUserId,
              toUser: toUserId,
              createdAt: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 48)),
              status: isMutual ? 'mutual' : 'pending'
            });
            
            await like.save();
            
            // If mutual, create the reciprocal like
            if (isMutual) {
              const reciprocalLike = new Like({
                fromUser: toUserId,
                toUser: fromUserId,
                createdAt: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24)),
                status: 'mutual'
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
        
        logger.info(`Created ${NUM_LIKES_TO_SEED} likes between users`);
      } else {
        logger.warn('Not enough users to seed likes');
      }
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