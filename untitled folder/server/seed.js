// seedDb.js (Refactored for Better Data Quality)
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// --- Configuration ---
const MONGO_URI = 'mongodb://localhost:27017/mandarin';
const NUM_USERS = 300;
const MAX_PHOTOS_PER_USER = 6; // Increased for more photos
const NUM_LIKES_TO_SEED = 500; // Increased for more engagement
const NUM_PHOTO_REQUESTS_TO_SEED = 250;
const SALT_ROUNDS = 12;

// --- Import Mongoose Models ---
import User from './models/User.js';
import Like from './models/Like.js';
import PhotoPermission from './models/PhotoPermission.js';
import logger from './logger.js';

// --- Helper Functions ---
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Get multiple random elements without duplicates
const getRandomUniqueElements = (arr, count) => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, arr.length));
};

// Generate a realistic first name
const firstNames = [
  // Female names
  'Emma', 'Olivia', 'Ava', 'Isabella', 'Sophia', 'Mia', 'Charlotte', 'Amelia', 'Harper', 'Evelyn',
  'Abigail', 'Emily', 'Elizabeth', 'Sofia', 'Avery', 'Ella', 'Scarlett', 'Grace', 'Victoria', 'Riley',
  'Aria', 'Lily', 'Zoey', 'Penelope', 'Layla', 'Nora', 'Camila', 'Chloe', 'Gabriella', 'Skylar',
  'Maya', 'Audrey', 'Alice', 'Madeline', 'Autumn', 'Savannah', 'Lila', 'Natalia', 'Zara', 'Leila',
  'Tamar', 'Yael', 'Noa', 'Shira', 'Adina', 'Maya', 'Rina',

  // Male names
  'Liam', 'Noah', 'William', 'James', 'Oliver', 'Benjamin', 'Elijah', 'Lucas', 'Mason', 'Logan',
  'Alexander', 'Ethan', 'Jacob', 'Michael', 'Daniel', 'Henry', 'Jackson', 'Sebastian', 'Aiden', 'Matthew',
  'Samuel', 'David', 'Joseph', 'Carter', 'Owen', 'Wyatt', 'John', 'Jack', 'Luke', 'Jayden',
  'Julian', 'Gabriel', 'Anthony', 'Leo', 'Isaac', 'Caleb', 'Isaiah', 'Thomas', 'Eli', 'Aaron',
  'Daniel', 'Moshe', 'Avi', 'Yosef', 'David', 'Jonathan', 'Eitan', 'Noam', 'Yoni'
];

// Generate a realistic last name
const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor',
  'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson',
  'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker', 'Hall', 'Allen', 'Young', 'Hernandez', 'King',
  'Wright', 'Lopez', 'Hill', 'Scott', 'Green', 'Adams', 'Baker', 'Gonzalez', 'Nelson', 'Carter',
  'Cohen', 'Levi', 'Friedman', 'Goldstein', 'Rosenberg', 'Katz', 'Schwartz', 'Hoffman', 'Berg', 'Klein',
  'Levy', 'Stern', 'Blum', 'Shapiro', 'Weiss', 'Roth', 'Stein', 'Rubin', 'Kaplan', 'Zimmerman'
];

// Generate couple names
const generateCoupleName = () => {
  const name1 = getRandomElement(firstNames);
  let name2 = getRandomElement(firstNames);
  while (name1 === name2) {
    name2 = getRandomElement(firstNames);
  }
  return `${name1} & ${name2}`;
};

// Generate username based on name
const generateUsername = (name) => {
  const parts = name.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(' ').filter(p => p);
  if (parts.length === 0) return `user_${getRandomInt(1000, 9999)}`;

  const base = parts.join('');
  const num = getRandomInt(0, 999);
  return num > 0 ? `${base}${num}` : base;
};

// --- Enhanced Data Arrays ---
const roles = ["user", "user", "user", "user", "moderator"];
const accountTiers = ["FREE", "PAID", "FEMALE", "COUPLE"];
const genders = ["male", "female", "non-binary", "other"];
const locations = [
  'Tel Aviv', 'Jerusalem', 'Haifa', 'Rishon LeZion', 'Petah Tikva', 'Ashdod', 'Netanya', 'Beersheba',
  'Holon', 'Ramat Gan', 'Herzliya', 'Bat Yam', 'Kfar Saba', 'Ra\'anana', 'Modi\'in', 'Ashkelon',
  'Eilat', 'Tiberias', 'Nazareth', 'Nahariya', 'Acre', 'Lod', 'Rehovot', 'Ramla', 'Hadera'
];

const interestsBank = [
  // General Interests
  "Dating", "Casual", "Friendship", "Long-term", "Travel", "Outdoors", "Movies", "Music", "Fitness",
  "Food", "Art", "Gaming", "Reading", "Tech", "Photography", "Cooking", "Dance", "Wine", "Beer",
  "Concerts", "Festivals", "Yoga", "Meditation", "Running", "Swimming", "Hiking", "Biking", "Tennis",
  "Volleyball", "Basketball", "Soccer", "Football", "Skiing", "Surfing", "Sailing", "Theatre",
  "Comedy", "DIY", "Gardening", "Pets", "Animals", "Science", "History", "Politics", "Languages",
  "Writing", "Fashion", "Makeup", "Beauty", "Health", "Nutrition", "Podcasts", "Blogging",
  "Entrepreneurship", "Investing", "Volunteering", "Community", "Spirituality", "Philosophy",

  // Israeli-specific interests
  "Beach life", "Tel Aviv nightlife", "Hummus spots", "Desert hiking", "Dead Sea trips",
  "Golan Heights", "Wineries", "Israeli cuisine", "Shabbat dinners", "Falafel hunting"
];

const iAmOptions = ["woman", "man", "couple"];

const lookingForOptions = ["women", "men", "couples"];

const intoTagsOptions = [
  'Meetups', 'Kink', 'BDSM', 'Swinging', 'Group play', 'Threesomes', 'Chatting', 'Online fun',
  'Role play', 'Exhibitionism', 'Voyeurism', 'Tantra', 'Sensual massage', 'Cuddling', 'Spanking',
  'Bondage', 'Dominance', 'Submission', 'Discipline', 'Toys', 'Lingerie', 'Costumes', 'Feet',
  'Orgasm control', 'Edging', 'Teasing', 'Oral', 'Anal', 'Public play', 'Watching', 'Being watched',
  'Photography', 'Videos', 'Sexting', 'Voice messages', 'Cam play', 'Fantasy sharing',
  'Light BDSM', 'Soft swap', 'Full swap', 'MFM', 'FMF', 'Parties', 'Clubs', 'Spontaneous',
  'Planned', 'Travel dates', 'Weekend getaways', 'Hotel fun', 'Outdoor adventures'
];

const turnOnsOptions = [
  'Dirty talk', 'Fit bodies', 'Intelligence', 'Humor', 'Confidence', 'Dominance', 'Submission',
  'Uniforms', 'Lingerie', 'Stockings', 'High heels', 'Suits', 'Tattoos', 'Piercings',
  'Beards', 'Long hair', 'Shaved', 'Natural', 'Muscular', 'Curvy', 'Petite', 'Tall',
  'Accent', 'Voice', 'Smile', 'Eyes', 'Hands', 'Neck', 'Back', 'Legs', 'Butt', 'Chest',
  'Dancing', 'Cooking', 'Good listener', 'Thoughtfulness', 'Generosity', 'Adventurous spirit',
  'Risk-taking', 'Creativity', 'Artistic talent', 'Musical ability', 'Athletic skill',
  'Knowledge', 'Worldliness', 'Ambition', 'Success', 'Kindness', 'Sensuality', 'Touch',
  'Massage', 'Eye contact', 'Teasing', 'Anticipation', 'Spontaneity', 'Playfulness',
  'Experience', 'Innocence', 'Eagerness', 'Taking charge', 'Being guided'
];

const maritalStatusOptions = ['Single', 'Married', 'Divorced', 'Widowed', 'In relationship', 'It\'s complicated', 'Open relationship', 'Polyamorous'];

// Bio templates for more realistic profiles
const bioTemplates = [
  (details) => `Hey there! I'm ${details.age}, ${details.maritalStatus.toLowerCase()} and living in ${details.location}. I love ${details.interests[0] || 'meeting new people'} and ${details.interests[1] || 'having good conversations'}. Looking for someone to share amazing experiences with.`,

  (details) => `${details.maritalStatus} ${details.iAm} based in ${details.location}. ${details.age} years young and full of energy. Passionate about ${details.interests[0] || 'life'} and always up for ${details.interests[1] || 'adventures'}. Let's connect and see where it goes!`,

  (details) => `Life is too short not to enjoy it! ${details.age}-year-old ${details.iAm} who loves ${details.interests[0] || 'good times'}. When I'm not working, you'll find me ${details.interests[1] ? 'enjoying ' + details.interests[1] : 'exploring new places'}. Looking for genuine connections in ${details.location}.`,

  (details) => `${details.location} native, ${details.age} years old. ${details.maritalStatus} and enjoying life. I'm deeply into ${details.interests[0] || 'entertainment'} and ${details.interests[1] || 'culture'}. I value honesty, respect, and good communication. Let's chat and see if we click.`,

  (details) => `Just a ${details.iAm} who enjoys the finer things in life. ${details.age}, living in beautiful ${details.location}. ${details.maritalStatus}. My passions include ${details.interests[0] || 'traveling'} and ${details.interests[1] || 'meeting new people'}. Message me if you're interested in knowing more.`,

  (details) => `${details.iAm.charAt(0).toUpperCase() + details.iAm.slice(1)}, ${details.age}, ${details.maritalStatus.toLowerCase()}. Based in ${details.location}. Looking for fun times and meaningful connections. Love ${details.interests[0] || 'adventures'} and ${details.interests[1] || 'spontaneous plans'}. Say hi if you think we'd get along!`,

  (details) => `Living my best life in ${details.location}! ${details.age}-year-old ${details.iAm}, ${details.maritalStatus.toLowerCase()}. When I'm not working, I enjoy ${details.interests[0] || 'socializing'} and ${details.interests[1] || 'relaxing'}. Open to new experiences and meeting interesting people.`,

  (details) => `${details.maritalStatus} ${details.iAm} from ${details.location}. ${details.age} years young with a passion for ${details.interests[0] || 'meeting new people'} and ${details.interests[1] || 'trying new things'}. Looking for genuine connections - life's too short for anything less!`,

  (details) => `Hello from ${details.location}! I'm a ${details.age}-year-old ${details.iAm}, ${details.maritalStatus.toLowerCase()} and enjoying life. My interests include ${details.interests[0] || 'socializing'}, ${details.interests[1] || 'having fun'}, and making meaningful connections. Let's chat!`,

  (details) => `${details.iAm.charAt(0).toUpperCase() + details.iAm.slice(1)}, ${details.age}. Living in ${details.location} and loving it! ${details.maritalStatus} and open to new experiences. Passionate about ${details.interests[0] || 'life'} and ${details.interests[1] || 'good company'}. Message me if we seem compatible!`
];

// Enhanced photo collections with better quality image URLs
const photoCollections = {
  woman: [
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1548142813-c348350df52b?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1499714608240-22fc6ad53fb2?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1577023311546-cdc07a8454d9?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1481824429379-07aa5e5b0739?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1513732822839-24f03a92f633?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1507152832244-10d45c7eda57?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1564485377539-4af72d1f6a2f?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1524638431109-93d95c968f03?auto=format&fit=crop&w=800'
  ],
  man: [
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1480455624313-e29b44bbfde1?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1531891437562-4301cf35b7e4?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1488161628813-04466f872be2?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1564564321837-a57b7070ac4f?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1508341591423-4347099e1f19?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1504257432389-52343af06ae3?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800'
  ],
  couple: [
    'https://images.unsplash.com/photo-1516585427167-9f4af9627e6c?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1528657249085-554e19b13cde?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1567784177951-6fa58317e16b?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1494774157365-9e04c6720e47?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1521897258701-21e2a01f5e8b?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1589440557903-e7a8b40a254c?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1477265650817-5dd8256e26ae?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1542841791-1925b02a2bbb?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1515355758951-b4b26c789f2e?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1521260857128-e762e14101a6?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1604604557773-c70cbc10360b?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1523031456599-e7689798c5dc?auto=format&fit=crop&w=800',
    'https://images.unsplash.com/photo-1503224081655-338c8cf6e9f8?auto=format&fit=crop&w=800'
  ]
};

// --- Main Seeding Function ---
const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info('MongoDB Connected for seeding...');

    // --- Clear Existing Data (Optional - Use with caution!) ---
    logger.warn('Clearing existing User, Like, and PhotoPermission data...');
    await User.deleteMany({});
    await Like.deleteMany({});
    await PhotoPermission.deleteMany({});
    logger.info('Existing data cleared.');

    const createdUserIds = [];
    const createdUsers = [];

    // --- 1. Seed Users with Better Data ---
    logger.info(`Seeding ${NUM_USERS} users with enhanced profiles...`);
    for (let i = 0; i < NUM_USERS; i++) {
      // Decide user type first to guide other selections
      const iAm = getRandomElement(iAmOptions);

      // Generate appropriate name based on user type
      let nickname;
      if (iAm === 'couple') {
        nickname = generateCoupleName();
      } else if (iAm === 'woman') {
        nickname = getRandomElement(firstNames.slice(0, 47)); // Use female names subset
      } else { // man
        nickname = getRandomElement(firstNames.slice(47)); // Use male names subset
      }

      // Add a last name sometimes for individuals
      if (iAm !== 'couple' && Math.random() > 0.5) {
        nickname = `${nickname} ${getRandomElement(lastNames)}`;
      }

      // Generate matching username
      const username = generateUsername(nickname);

      // Generate appropriate looking for options
      let lookingFor;
      if (iAm === 'couple') {
        // Couples typically look for women, men, or other couples
        lookingFor = getRandomUniqueElements(lookingForOptions, getRandomInt(1, 3));
      } else if (iAm === 'woman') {
        // More variety in what women might look for
        lookingFor = getRandomUniqueElements(lookingForOptions, getRandomInt(1, 3));
      } else { // man
        // Men might look for women, couples, or less frequently men
        const preferences = Math.random() < 0.8 ? ['women', 'couples'] : lookingForOptions;
        lookingFor = getRandomUniqueElements(preferences, getRandomInt(1, preferences.length));
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

      // Set age ranges more realistically
      let age;
      if (iAm === 'couple') {
        age = getRandomInt(25, 55); // Couples tend to be a bit older
      } else {
        age = getRandomInt(21, 60); // Individual age range
      }

      // Select appropriate account tier
      let accountTier;
      if (iAm === 'woman') {
        accountTier = Math.random() < 0.7 ? 'FEMALE' : getRandomElement(['FREE', 'PAID']);
      } else if (iAm === 'couple') {
        accountTier = Math.random() < 0.6 ? 'COUPLE' : getRandomElement(['FREE', 'PAID']);
      } else { // man
        accountTier = Math.random() < 0.4 ? 'PAID' : 'FREE';
      }

      // Select interest count based on account tier
      const interestCount = accountTier === 'FREE' ? getRandomInt(2, 5) : getRandomInt(4, 8);

      // Select non-duplicate interests
      const interests = getRandomUniqueElements(interestsBank, interestCount);

      // Select non-duplicate into tags - more for paid accounts
      const intoTagsCount = accountTier === 'FREE' ? getRandomInt(2, 4) : getRandomInt(3, 7);
      const intoTags = getRandomUniqueElements(intoTagsOptions, intoTagsCount);

      // Select non-duplicate turn-ons - more for paid accounts
      const turnOnsCount = accountTier === 'FREE' ? getRandomInt(2, 4) : getRandomInt(3, 6);
      const turnOns = getRandomUniqueElements(turnOnsOptions, turnOnsCount);

      // Select marital status appropriate to user type
      let maritalStatus;
      if (iAm === 'couple') {
        maritalStatus = getRandomElement(['Married', 'In relationship', 'Open relationship', 'Polyamorous']);
      } else {
        maritalStatus = getRandomElement(maritalStatusOptions);
      }

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
        maritalStatus
      };

      // Generate bio using templates
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
        role: getRandomElement(roles),
        accountTier,
        details: userDetails,
        isOnline: Math.random() < 0.3,
        lastActive: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 14)), // More recent activity
        photos: [],
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
        if (error.code === 11000) {
          logger.warn(`Duplicate key error for user ${nickname}. Might be email/nickname collision.`);
        }
        if (error.errors) {
          Object.keys(error.errors).forEach(key => {
            logger.error(`Validation Error (${key}): ${error.errors[key].message}`);
          });
        }
      }
    }

    logger.info(`Successfully created ${createdUserIds.length} users.`);
    if (createdUserIds.length === 0) {
      logger.error("No users were created. Aborting further seeding.");
      return;
    }

    // --- 2. Seed Photos with Better Quality Images ---
    logger.info('Seeding photos for users with higher quality images...');
    const allPrivatePhotoIdsWithOwner = [];

    for (const user of createdUsers) {
      const userType = user.details?.iAm || 'default';
      const photoCollection = photoCollections[userType] || photoCollections.man;

      // Determine how many photos based on account tier
      let numPhotos;
      if (user.accountTier === 'PAID' || user.accountTier === 'FEMALE' || user.accountTier === 'COUPLE') {
        numPhotos = getRandomInt(3, MAX_PHOTOS_PER_USER);
      } else {
        numPhotos = getRandomInt(1, 3); // Free accounts get fewer photos
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
          uploadDate: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 30))
        }
      });

      // Add additional photos (some private)
      for (let p = 1; p < selectedPhotos.length; p++) {
        // Higher tier accounts have more private photos
        const isPrivate = user.accountTier !== 'FREE' && Math.random() < 0.5;

        const photoData = {
          url: selectedPhotos[p],
          isPrivate: isPrivate,
          metadata: {
            uploadedBySeed: true,
            originalName: `${userType}_photo_${p + 1}.jpg`,
            uploadDate: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 20))
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

    // --- 3. Seed Likes with Better Distribution---
    logger.info(`Seeding ${NUM_LIKES_TO_SEED} likes with improved distribution...`);
    let likesCreated = 0;

    // Create a map of users by type for more realistic matching
    const usersByType = {
      woman: createdUsers.filter(u => u.details?.iAm === 'woman').map(u => u._id.toString()),
      man: createdUsers.filter(u => u.details?.iAm === 'man').map(u => u._id.toString()),
      couple: createdUsers.filter(u => u.details?.iAm === 'couple').map(u => u._id.toString())
    };

    for (let i = 0; i < NUM_LIKES_TO_SEED; i++) {
      if (createdUserIds.length < 2) break;

      // Select a random sender
      const senderId = getRandomElement(createdUserIds);
      const sender = createdUsers.find(u => u._id.toString() === senderId);

      if (!sender || !sender.details || !sender.details.iAm || !sender.details.lookingFor) {
        continue; // Skip if sender details are missing
      }

      // Find users that match what the sender is looking for
      let potentialRecipients = [];

      sender.details.lookingFor.forEach(lookingFor => {
        if (lookingFor === 'women') {
          potentialRecipients = [...potentialRecipients, ...usersByType.woman];
        } else if (lookingFor === 'men') {
          potentialRecipients = [...potentialRecipients, ...usersByType.man];
        } else if (lookingFor === 'couples') {
          potentialRecipients = [...potentialRecipients, ...usersByType.couple];
        }
      });

      // Remove duplicates and the sender from potential recipients
      potentialRecipients = [...new Set(potentialRecipients)].filter(id => id !== senderId);

      if (potentialRecipients.length === 0) {
        continue; // Skip if no valid recipients
      }

      const recipientId = getRandomElement(potentialRecipients);

      try {
        const existingLike = await Like.findOne({ sender: senderId, recipient: recipientId });
        if (!existingLike) {
          const newLike = new Like({
            sender: senderId,
            recipient: recipientId,
            createdAt: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 30)), // Random time within last month
            updatedAt: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 15))
          });
          await newLike.save();
          likesCreated++;
        }
      } catch (error) {
        if (error.code !== 11000) {
          logger.error(`Error creating like: ${error.message}`);
        }
      }

      if (likesCreated > 0 && likesCreated % 100 === 0) {
        logger.info(`Seeded ${likesCreated} likes so far...`);
      }
    }

    logger.info(`Seeded ${likesCreated} unique likes.`);

    // --- 4. Seed Photo Requests with Better Distribution ---
    logger.info(`Seeding ${NUM_PHOTO_REQUESTS_TO_SEED} photo permission requests...`);
    let requestsCreated = 0;

    if (allPrivatePhotoIdsWithOwner.length > 0 && createdUserIds.length > 1) {
      for (let i = 0; i < NUM_PHOTO_REQUESTS_TO_SEED; i++) {
        if (allPrivatePhotoIdsWithOwner.length === 0) break;

        const randomPhotoIndex = getRandomInt(0, allPrivatePhotoIdsWithOwner.length - 1);
        const { photoId, ownerId } = allPrivatePhotoIdsWithOwner[randomPhotoIndex];

        // Get the owner details to match appropriate requesters
        const owner = createdUsers.find(u => u._id.toString() === ownerId);

        if (!owner || !owner.details || !owner.details.iAm) {
          continue; // Skip if owner details missing
        }

        // Find potential requesters based on what type the owner is and who might be interested
        let potentialRequesters = [];

        if (owner.details.iAm === 'woman') {
          // Women's photos might be requested by men, couples, and some women
          potentialRequesters = [
            ...usersByType.man,
            ...usersByType.couple,
            ...usersByType.woman.filter(() => Math.random() < 0.3) // Only some women request from women
          ];
        } else if (owner.details.iAm === 'man') {
          // Men's photos might be requested by women, couples, and some men
          potentialRequesters = [
            ...usersByType.woman,
            ...usersByType.couple,
            ...usersByType.man.filter(() => Math.random() < 0.3) // Only some men request from men
          ];
        } else { // couple
          // Couple photos might be requested by everyone
          potentialRequesters = [...createdUserIds];
        }

        // Remove duplicates and the owner from potential requesters
        potentialRequesters = [...new Set(potentialRequesters)].filter(id => id !== ownerId);

        if (potentialRequesters.length === 0) {
          continue; // Skip if no valid requesters
        }

        const requesterId = getRandomElement(potentialRequesters);

        try {
          const existingRequest = await PhotoPermission.findOne({
            photo: photoId,
            requestedBy: requesterId
          });

          if (!existingRequest) {
            // Determine a random status with appropriate weighting
            const statusOptions = ['pending', 'approved', 'rejected'];
            const statusWeights = [0.5, 0.3, 0.2]; // 50% pending, 30% approved, 20% rejected

            const randomValue = Math.random();
            let status;
            let cumulativeWeight = 0;

            for (let i = 0; i < statusOptions.length; i++) {
              cumulativeWeight += statusWeights[i];
              if (randomValue <= cumulativeWeight) {
                status = statusOptions[i];
                break;
              }
            }

            const newRequest = new PhotoPermission({
              photo: photoId,
              requestedBy: requesterId,
              photoOwnerId: ownerId,
              status,
              createdAt: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 20)),
              updatedAt: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 10))
            });

            await newRequest.save();
            requestsCreated++;
          }
        } catch (error) {
          if (error.code !== 11000) {
            logger.error(`Error creating photo permission request: ${error.message}`);
          }
        }

        if (requestsCreated > 0 && requestsCreated % 50 === 0) {
          logger.info(`Seeded ${requestsCreated} photo requests so far...`);
        }
      }

      logger.info(`Seeded ${requestsCreated} unique photo permission requests.`);
    } else {
      logger.warn('Skipping photo request seeding: Not enough users or no private photos found.');
    }

    logger.info('Enhanced database seeding completed successfully!');

  } catch (error) {
    logger.error('Database seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected.');
  }
};

// Run the seeding function
seedDatabase();
