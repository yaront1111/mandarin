// seed-production.js - Enhanced for production use
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs'; // Using bcryptjs instead of bcrypt for compatibility
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

// --- Configuration ---
const MONGO_URI = 'mongodb://localhost:27017/mandarin';
const NUM_USERS = 200;
const MAX_PHOTOS_PER_USER = 7;
const NUM_LIKES_TO_SEED = 400;
const NUM_PHOTO_REQUESTS_TO_SEED = 200;
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

// --- Enhanced Data Arrays ---

// Hebrew female names
const hebrewFemaleNames = [
  'מאיה', 'נועה', 'יעל', 'שירה', 'מיכל', 'הילה', 'ליאל', 'שני', 'עדי', 'אדל',
  'רותם', 'גפן', 'טליה', 'רוני', 'דנה', 'אלה', 'שיר', 'שקד', 'עלמה', 'יסמין',
  'מיקה', 'אביגיל', 'ענבר', 'נטע', 'אילה', 'שירלי', 'לירון', 'דניאל', 'נופר', 'גלי'
];

// Hebrew male names
const hebrewMaleNames = [
  'איתי', 'יובל', 'עומר', 'אמיר', 'אורי', 'רועי', 'נועם', 'יונתן', 'אלון', 'דניאל',
  'אייל', 'אסף', 'עידו', 'גיא', 'נדב', 'תומר', 'עמית', 'ניר', 'אלעד', 'רון'
];

// Cool nicknames
const nicknames = [
  'Explorer', 'Dreamer', 'Traveler', 'Adventurer', 'Creator', 'Stargazer', 'Sunshine',
  'Wanderer', 'Seeker', 'FunLover', 'NightOwl', 'DayDreamer', 'Voyager', 'Nomad', 'FreeSoul',
  'ישראלי', 'חופשי', 'מטייל', 'הרפתקן', 'חולם', 'יצירתי', 'משוגע', 'מלאך', 'חמוד', 'חמודה'
];

// Israeli locations with Hebrew
const locations = [
  'תל אביב', 'תל אביב צפון', 'רמת אביב', 'פלורנטין', 'רוטשילד', 'הרצליה פיתוח', 'רמת השרון',
  'רעננה', 'כפר סבא', 'נתניה', 'ראשון לציון', 'אשדוד', 'אשקלון', 'מודיעין', 'ירושלים',
  'חיפה', 'קריות', 'באר שבע', 'אילת', 'הוד השרון', 'פתח תקווה', 'רמת גן', 'בת ים'
];

// Interesting categories
const interestsBank = [
  // Hebrew interests
  "טיולים", "קריאה", "בישול", "צילום", "מוזיקה", "סרטים", "ספורט", "ריקוד",
  "אומנות", "כתיבה", "יוגה", "מדיטציה", "שחייה", "ריצה", "אופניים", "משחקי מחשב",
  "גינון", "דיג", "קמפינג", "שירה", "גיטרה", "שחמט", "טניס", "כדורסל",
  // English interests
  "Travel", "Reading", "Cooking", "Photography", "Music", "Movies", "Sports", "Dancing",
  "Art", "Writing", "Yoga", "Meditation", "Swimming", "Running", "Cycling", "Gaming",
  "Gardening", "Fishing", "Camping", "Singing", "Guitar", "Chess", "Tennis", "Basketball"
];

// "Into" tags
const intoTagsOptions = [
  // Hebrew tags
  'שיחות עמוקות', 'הרפתקאות ספונטניות', 'ערבי סרטים', 'ימי חוף', 'כושר',
  'חוויות קולינריות', 'גלריות אמנות', 'מוזיקה חיה', 'תיאטרון', 'פעילויות בחוץ',
  'חופשות סוף שבוע', 'פגישות קפה', 'טעימות יין', 'הופעות', 'פסטיבלים',
  // English tags
  'Deep Conversations', 'Spontaneous Adventures', 'Movie Nights', 'Beach Days', 'Fitness',
  'Food Experiences', 'Art Galleries', 'Live Music', 'Theater', 'Outdoor Activities', 
  'Weekend Getaways', 'Coffee Dates', 'Wine Tasting', 'Concerts', 'Festivals'
];

// Turn-ons
const turnOnsOptions = [
  // Hebrew turn-ons
  'אינטליגנציה', 'חוש הומור', 'ביטחון', 'אדיבות', 'שאפתנות', 'תשוקה',
  'כנות', 'יצירתיות', 'הרפתקנות', 'פתיחות', 'הקשבה', 'התחשבות',
  'חמלה', 'משחקיות', 'נדיבות', 'עצמאות', 'אמינות',
  // English turn-ons
  'Intelligence', 'Humor', 'Confidence', 'Kindness', 'Ambition', 'Passion',
  'Honesty', 'Creativity', 'Adventure', 'Openness', 'Listening', 'Thoughtfulness',
  'Compassion', 'Playfulness', 'Generosity', 'Independence', 'Reliability'
];

// The valid values from User model schema
const VALID_IAM_VALUES = ["woman", "man", "couple"];
const VALID_LOOKING_FOR = ["women", "men", "couples"];
const VALID_MARITAL_STATUS = [
  "Single", "Married", "Divorced", "Separated", "Widowed",
  "In a relationship", "It's complicated", "Open relationship", "Polyamorous"
];

// --- Bio Templates ---

// Hebrew bio templates for men
const hebrewMaleBioTemplates = [
  (details) => `בן ${details.age}, גר ב${details.location}. אוהב ${details.interests[0] || 'טיולים'} ו${details.interests[1] || 'מוזיקה'}. מחפש קשר עם מישהי מעניינת.`,
  
  (details) => `${details.maritalStatus || 'Single'}, גר ב${details.location}, אוהב ${details.interests[0] || 'ספורט'} ו${details.interests[1] || 'בישול'}. בואי נכיר!`,
  
  (details) => `בן ${details.age}, מ${details.location}. אוהב ${details.interests[0] || 'קולנוע'} ו${details.interests[1] || 'מוזיקה'}. מחפש בחורה נחמדה להכיר.`
];

// Hebrew bio templates for women
const hebrewFemaleBioTemplates = [
  (details) => `בת ${details.age}, גרה ב${details.location}. אוהבת ${details.interests[0] || 'טיולים'} ו${details.interests[1] || 'מוזיקה'}. מחפשת להכיר אנשים חדשים.`,
  
  (details) => `${details.maritalStatus || 'Single'}, גרה ב${details.location}, אוהבת ${details.interests[0] || 'ספורט'} ו${details.interests[1] || 'קריאה'}. בואו נכיר!`,
  
  (details) => `בת ${details.age}, מ${details.location}. אוהבת ${details.interests[0] || 'אמנות'} ו${details.interests[1] || 'בישול'}. מחפשת קשר איכותי.`
];

// Hebrew bio templates for couples
const hebrewCoupleBioTemplates = [
  (details) => `זוג, היא בת ${details.age-2}, הוא בן ${details.age+2}. גרים ב${details.location}. אוהבים ${details.interests[0] || 'טיולים'} ו${details.interests[1] || 'מוזיקה'}. מחפשים להכיר זוגות וחברים חדשים.`,
  
  (details) => `זוג ${details.maritalStatus || 'Married'} מ${details.location}, אוהבים ${details.interests[0] || 'בילויים'} ו${details.interests[1] || 'טיולים'}. בואו נכיר!`,
  
  (details) => `זוג בני ${details.age}, מ${details.location}. אוהבים ${details.interests[0] || 'מסיבות'} ו${details.interests[1] || 'ספורט'}. פתוחים להכיר אנשים חדשים.`
];

// English bio templates for men
const englishMaleBioTemplates = [
  (details) => `${details.age} year old guy living in ${details.location}. I enjoy ${details.interests[0] || 'traveling'} and ${details.interests[1] || 'photography'}. Looking to connect with interesting people.`,
  
  (details) => `${details.maritalStatus || 'Single'} man in ${details.location}. Passionate about ${details.interests[0] || 'music'} and ${details.interests[1] || 'art'}. Let's get to know each other!`,
  
  (details) => `${details.age}M from ${details.location}. Into ${details.interests[0] || 'fitness'} and ${details.interests[1] || 'cooking'}. Looking forward to making connections here.`
];

// English bio templates for women
const englishFemaleBioTemplates = [
  (details) => `${details.age} year old woman living in ${details.location}. I enjoy ${details.interests[0] || 'traveling'} and ${details.interests[1] || 'reading'}. Looking to meet new people.`,
  
  (details) => `${details.maritalStatus || 'Single'} woman in ${details.location}. Passionate about ${details.interests[0] || 'music'} and ${details.interests[1] || 'dance'}. Let's get to know each other!`,
  
  (details) => `${details.age}F from ${details.location}. Into ${details.interests[0] || 'art'} and ${details.interests[1] || 'yoga'}. Looking forward to making connections here.`
];

// English bio templates for couples
const englishCoupleBioTemplates = [
  (details) => `Couple in ${details.location}, she's ${details.age-2}, he's ${details.age+2}. We enjoy ${details.interests[0] || 'traveling'} and ${details.interests[1] || 'dining out'}. Looking to meet new friends.`,
  
  (details) => `${details.maritalStatus || 'Married'} couple in ${details.location}. We love ${details.interests[0] || 'adventure'} and ${details.interests[1] || 'socializing'}. Let's connect!`,
  
  (details) => `Couple, both ${details.age}, in ${details.location}. We're into ${details.interests[0] || 'parties'} and ${details.interests[1] || 'sports'}. Open to meeting new people.`
];

// --- Photo Collections ---
const photoCollections = {
  woman: [
    "https://images.unsplash.com/photo-1509967419530-da38b4704bc6?q=80&w=800", // From behind at sunset
    "https://images.unsplash.com/photo-1548911131-43cc6389d52d?q=80&w=800", // Woman on beach from behind
    "https://images.unsplash.com/photo-1502378735452-bc7d86632805?q=80&w=800", // Woman by pool from behind
    "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?q=80&w=800", // Woman on beach at sunset
    "https://images.unsplash.com/photo-1543857778-c4a1a3e0b2eb?q=80&w=800", // Woman by window silhouette
    "https://images.unsplash.com/photo-1528046279030-0bfb3d3f4de6?q=80&w=800", // Woman's silhouette in doorway
    "https://images.unsplash.com/photo-1590066233913-941dd51a2a63?q=80&w=800", // Woman silhouette by window
    "https://images.unsplash.com/photo-1499603732040-179b50c68549?q=80&w=800"  // Woman in bathtub
  ],

  man: [
    "https://images.unsplash.com/photo-1567013275689-c179a874478f?q=80&w=800", // Man's back muscles
    "https://images.unsplash.com/photo-1520975954732-35dd22299614?q=80&w=800", // Man in suit from behind
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=800", // Man's profile dark lighting
    "https://images.unsplash.com/photo-1485875437342-9b39470b3d95?q=80&w=800", // Man with tattoos from behind
    "https://images.unsplash.com/photo-1520975661595-6453be3f7070?q=80&w=800", // Man in formal wear silhouette
    "https://images.unsplash.com/photo-1589571894960-20bbe2828d0a?q=80&w=800", // Man at sunset from behind
    "https://images.unsplash.com/photo-1506634572416-48cdfe530110?q=80&w=800", // Man in pool from behind
    "https://images.unsplash.com/photo-1515122616000-5badf9ded1c4?q=80&w=800"  // Man in gym from behind
  ],

  couple: [
    "https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?q=80&w=800", // Couple embracing shadows
    "https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=800", // Couple from behind sunset
    "https://images.unsplash.com/photo-1545193410-42d16995ba83?q=80&w=800", // Couple silhouette
    "https://images.unsplash.com/photo-1522433435688-b56f576d71e8?q=80&w=800", // Couple dancing silhouette
    "https://images.unsplash.com/photo-1474552226712-ac0f0961a954?q=80&w=800", // Couple holding hands
    "https://images.unsplash.com/photo-1463478954257-d2db1343dee3?q=80&w=800", // Couple in shadows
    "https://images.unsplash.com/photo-1526382899600-66b58e05b3e5?q=80&w=800", // Couple embracing silhouette
    "https://images.unsplash.com/photo-1495490311930-678c8ecb13d1?q=80&w=800"  // Couple kissing silhouette
  ]
};

// Helper function for generating couple names
const generateCoupleName = () => {
  // Include both Hebrew names for couples
  const allFirstNames = [...hebrewFemaleNames, ...hebrewMaleNames];
  const name1 = getRandomElement(allFirstNames);
  let name2 = getRandomElement(allFirstNames);
  while (name1 === name2) {
    name2 = getRandomElement(allFirstNames);
  }

  // Use Hebrew connector occasionally
  const connector = Math.random() < 0.3 ? " ו" : (Math.random() < 0.5 ? " & " : " and ");
  return `${name1}${connector}${name2}`;
};

// Generate username based on name or use a cool nickname
const generateUsername = (name) => {
  // 50% chance to use a nickname
  if (Math.random() < 0.5) {
    return getRandomElement(nicknames) + getRandomInt(1, 99);
  }

  // Otherwise derive from name
  const parts = name.toLowerCase().replace(/[^a-zא-ת0-9]/g, ' ').split(' ').filter(p => p);
  if (parts.length === 0) return `user_${getRandomInt(1000, 9999)}`;

  const base = parts.join('');
  const num = getRandomInt(0, 999);
  return num > 0 ? `${base}${num}` : base;
};

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
    logger.info('MongoDB Connected for production seeding...');

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

    // --- 1. Seed Users with realistic profiles ---
    if (usersToCreate > 0) {
      logger.info(`Seeding ${usersToCreate} users with realistic profiles...`);
      for (let i = 0; i < usersToCreate; i++) {
        // Decide user type first to guide other selections
        const iAm = getRandomElement(VALID_IAM_VALUES);

        // Generate appropriate name based on user type
        let nickname;
        if (iAm === 'couple') {
          nickname = generateCoupleName();
        } else if (iAm === 'woman') {
          nickname = getRandomElement(hebrewFemaleNames);
        } else { // man
          nickname = getRandomElement(hebrewMaleNames);
        }

        // Add a last name sometimes for individuals
        if (iAm !== 'couple' && Math.random() > 0.7) {
          const lastName = Math.random() > 0.5 ? 
            getRandomElement([...hebrewMaleNames, ...hebrewFemaleNames]) : 
            getRandomElement(['Cohen', 'Levy', 'Mizrahi', 'Peretz', 'Azoulay', 'Dahan', 'Hoffman', 'שטרן']);
          nickname = `${nickname} ${lastName}`;
        }

        // Ensure nickname is at least 3 characters
        if (nickname.length < 3) {
          nickname = nickname + " " + getRandomElement(nicknames);
        }

        // Generate matching username or use a cool nickname
        const username = generateUsername(nickname);

        // Generate appropriate looking for options (using valid values only)
        const lookingForCount = getRandomInt(1, 3);
        const lookingFor = getRandomUniqueElements(VALID_LOOKING_FOR, lookingForCount);
        
        // Age based on user type
        let age;
        if (iAm === 'couple') {
          age = getRandomInt(25, 50);
        } else if (iAm === 'woman') {
          age = getRandomInt(21, 45);
        } else { // man
          age = getRandomInt(24, 55);
        }

        // Select appropriate account tier
        let accountTier;
        if (iAm === 'woman') {
          accountTier = Math.random() < 0.8 ? 'FEMALE' : getRandomElement(['FREE', 'PAID']);
        } else if (iAm === 'couple') {
          accountTier = Math.random() < 0.7 ? 'COUPLE' : getRandomElement(['FREE', 'PAID']);
        } else { // man
          accountTier = Math.random() < 0.5 ? 'PAID' : 'FREE';
        }

        // Select gender based on iAm
        let gender;
        if (iAm === 'woman') {
          gender = 'female';
        } else if (iAm === 'man') {
          gender = 'male';
        } else { // couple
          gender = getRandomElement(['male', 'female']); // Represent primary account holder
        }

        // Select interest count
        const interestCount = getRandomInt(3, 5);
        
        // Select non-duplicate interests
        const interests = getRandomUniqueElements(interestsBank, interestCount);
        
        // Select non-duplicate into tags
        const intoTagsCount = getRandomInt(3, 5);
        const intoTags = getRandomUniqueElements(intoTagsOptions, intoTagsCount);
        
        // Select non-duplicate turn-ons
        const turnOnsCount = getRandomInt(3, 5);
        const turnOns = getRandomUniqueElements(turnOnsOptions, turnOnsCount);
        
        // Select marital status
        const maritalStatus = getRandomElement(VALID_MARITAL_STATUS);
        
        // Build user details object
        const userDetails = {
          age,
          gender,
          location: getRandomElement(locations),
          interests,
          iAm,
          lookingFor,
          intoTags,
          turnOns,
          maritalStatus,
          seedGenerated: true // Mark as generated by seed for future reference
        };
        
        // Select bio template based on user type
        let bioTemplate;
        const useHebrew = Math.random() < 0.8;
        
        if (iAm === 'man') {
          bioTemplate = useHebrew ?
            getRandomElement(hebrewMaleBioTemplates) :
            getRandomElement(englishMaleBioTemplates);
        } else if (iAm === 'woman') {
          bioTemplate = useHebrew ?
            getRandomElement(hebrewFemaleBioTemplates) :
            getRandomElement(englishFemaleBioTemplates);
        } else { // couple
          bioTemplate = useHebrew ?
            getRandomElement(hebrewCoupleBioTemplates) :
            getRandomElement(englishCoupleBioTemplates);
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
          isOnline: Math.random() < 0.4, // 40% chance to be online
          lastActive: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 48)), // Recent activity
          isVerified: true,
          active: true,
        };
        
        try {
          const newUser = new User(userData);
          const savedUser = await newUser.save();
          createdUserIds.push(savedUser._id.toString());
          createdUsers.push(savedUser);
          
          if ((i + 1) % 50 === 0) {
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
      
      logger.info(`Successfully created ${createdUserIds.length} total users.`);
      if (createdUserIds.length === 0) {
        logger.error("No users were created. Aborting further seeding.");
        return;
      }
    }

    // --- 2. Seed Photos ---
    logger.info('Seeding photos for users...');
    const allPrivatePhotoIdsWithOwner = [];
    
    for (const user of createdUsers) {
      // Skip if user already has photos
      if (user.photos && user.photos.length > 0) {
        logger.info(`User ${user.nickname} already has ${user.photos.length} photos. Skipping.`);
        
        // Still collect private photo IDs for permission seeding
        user.photos.forEach((photo) => {
          if (photo.isPrivate && photo._id) {
            allPrivatePhotoIdsWithOwner.push({
              photoId: photo._id.toString(),
              ownerId: user._id.toString()
            });
          }
        });
        continue;
      }
      
      const userType = user.details?.iAm || 'default';
      let photoCollection;
      
      // Select appropriate photo collection based on user type
      if (userType === 'woman') photoCollection = photoCollections.woman;
      else if (userType === 'man') photoCollection = photoCollections.man;
      else if (userType === 'couple') photoCollection = photoCollections.couple;
      else photoCollection = photoCollections[userType] || photoCollections.man;
      
      // Determine how many photos based on account tier
      let numPhotos;
      if (user.accountTier === 'PAID' || user.accountTier === 'FEMALE' || user.accountTier === 'COUPLE') {
        numPhotos = getRandomInt(4, MAX_PHOTOS_PER_USER);
      } else {
        numPhotos = getRandomInt(2, 4); // Free accounts get fewer photos
      }
      
      // Shuffle the collection and take the first numPhotos
      const shuffledPhotos = [...photoCollection].sort(() => 0.5 - Math.random());
      const selectedPhotos = shuffledPhotos.slice(0, numPhotos);
      
      const photosToAdd = [];
      
      // Add the profile picture first (public)
      photosToAdd.push({
        url: selectedPhotos[0],
        isPrivate: false,
        metadata: {
          uploadedBySeed: true,
          originalName: `${userType}_profile.jpg`,
          uploadDate: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 10))
        }
      });
      
      // Add additional photos
      for (let p = 1; p < selectedPhotos.length; p++) {
        const isPrivate = Math.random() < 0.4; // 40% chance to be private
        
        const photoData = {
          url: selectedPhotos[p],
          isPrivate: isPrivate,
          metadata: {
            uploadedBySeed: true,
            originalName: `${userType}_photo_${p + 1}.jpg`,
            uploadDate: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 5))
          }
        };
        photosToAdd.push(photoData);
      }
      
      if (photosToAdd.length > 0) {
        try {
          // Update user directly
          const updatedUser = await User.findByIdAndUpdate(
            user._id,
            { $set: { photos: photosToAdd } },
            { new: true }
          );
          
          if (updatedUser) {
            // Record private photo IDs from the updated user document
            updatedUser.photos.forEach((photo) => {
              if (photo.isPrivate && photo._id) {
                allPrivatePhotoIdsWithOwner.push({
                  photoId: photo._id.toString(),
                  ownerId: updatedUser._id.toString()
                });
              }
            });
          } else {
            logger.warn(`Could not find user ${user.nickname} to add photos after creation.`);
          }
        } catch(error) {
          logger.error(`Error adding photos for user ${user.nickname}: ${error.message}. Skipping photos for this user.`);
        }
      }
    }
    
    logger.info(`Finished seeding photos. ${allPrivatePhotoIdsWithOwner.length} private photos recorded.`);

    // --- 3. Seed Likes ---
    logger.info(`Seeding ${NUM_LIKES_TO_SEED} likes between users...`);
    
    if (createdUserIds.length >= 2) {
      for (let i = 0; i < NUM_LIKES_TO_SEED; i++) {
        // Get random user IDs
        let fromUserId = getRandomElement(createdUserIds);
        let toUserId = getRandomElement(createdUserIds);
        
        // Ensure we're not liking ourselves
        while (fromUserId === toUserId) {
          toUserId = getRandomElement(createdUserIds);
        }
        
        try {
          // Create like with 60% being mutual
          const isMutual = Math.random() < 0.6;
          
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
            logger.error(`Error creating like from ${fromUserId} to ${toUserId}: ${error.message}`);
          }
        }
      }
      
      logger.info('Likes seeded successfully');
    } else {
      logger.warn('Not enough users to seed likes. Skipping.');
    }

    // --- 4. Seed Photo Permissions ---
    logger.info(`Seeding ${NUM_PHOTO_REQUESTS_TO_SEED} photo permissions...`);
    
    if (allPrivatePhotoIdsWithOwner.length > 0 && createdUserIds.length > 1) {
      // For each permission we want to seed
      for (let i = 0; i < NUM_PHOTO_REQUESTS_TO_SEED; i++) {
        // Get a random private photo
        const randomPhotoWithOwner = getRandomElement(allPrivatePhotoIdsWithOwner);
        const ownerId = randomPhotoWithOwner.ownerId;
        const photoId = randomPhotoWithOwner.photoId;
        
        // Get a random user that isn't the owner
        let requesterId;
        do {
          requesterId = getRandomElement(createdUserIds);
        } while (requesterId === ownerId);
        
        // Determine if this permission is approved, pending, or denied
        let status;
        const randomStatus = Math.random();
        if (randomStatus < 0.6) {
          status = 'approved'; // 60% approved
        } else if (randomStatus < 0.9) {
          status = 'pending';  // 30% pending
        } else {
          status = 'denied';   // 10% denied
        }
        
        try {
          const photoPermission = new PhotoPermission({
            photo: photoId,
            owner: ownerId,
            requester: requesterId,
            status: status,
            requestDate: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 3)),
            responseDate: status !== 'pending' ?
              new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 12)) :
              null
          });
          
          await photoPermission.save();
        } catch (error) {
          // If it's a duplicate key error, just continue
          if (error.code !== 11000) {
            logger.error(`Error creating photo permission: ${error.message}`);
          }
        }
      }
      
      logger.info('Photo permissions seeded successfully');
    } else {
      logger.warn('Not enough private photos or users to seed photo permissions. Skipping.');
    }
    
    logger.info('Database seeding completed successfully!');
    
  } catch (error) {
    logger.error('Production database seeding failed:', error);
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
  console.log('To completely clean the database, use: node seed-production.js --clean');
  console.log('=================================');
}

// Run the seeding function
seedDatabase();