// seedDb.js (Refactored for Better Data Quality)
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// --- Configuration ---
const MONGO_URI = 'mongodb://localhost:27017/mandarin';
const NUM_USERS = 50; // Reduced number of users
const MAX_PHOTOS_PER_USER = 5;
const NUM_LIKES_TO_SEED = 100;
const NUM_PHOTO_REQUESTS_TO_SEED = 50;
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
];

// Local file placeholders for testing
const placeholderImages = [
  '/uploads/seed/placeholder_1.jpg',
  '/uploads/seed/placeholder_2.png',
  '/uploads/seed/placeholder_3.png',
  '/uploads/seed/placeholder_4.png',
  '/uploads/seed/placeholder_8.png'
];

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
        lastActive: new Date(),
        photos: [],
        isVerified: true,
        active: true,
      };

      try {
        const newUser = new User(userData);
        const savedUser = await newUser.save();
        createdUserIds.push(savedUser._id.toString());
        createdUsers.push(savedUser);

        if ((i + 1) % 10 === 0) {
          logger.info(`Created ${i + 1} users so far...`);
        }
      } catch (error) {
        logger.error(`Error creating user ${nickname}: ${error.message}. Skipping user.`);
        if (error.code === 11000) {
          logger.warn(`Duplicate key error for user ${nickname}. Might be email/nickname collision.`);
        }
      }
    }

    logger.info(`Successfully created ${createdUserIds.length} users.`);
    if (createdUserIds.length === 0) {
      logger.error("No users were created. Aborting further seeding.");
      return;
    }

    // --- 2. Seed Photos with New Schema ---
    logger.info('Seeding photos for users with the new schema format...');
    const allPhotoIdsWithOwner = [];

    for (const user of createdUsers) {
      // Determine how many photos based on account tier
      let numPhotos;
      if (user.accountTier === 'PAID' || user.accountTier === 'FEMALE' || user.accountTier === 'COUPLE') {
        numPhotos = getRandomInt(2, MAX_PHOTOS_PER_USER);
      } else {
        numPhotos = getRandomInt(1, 2); // Free accounts get fewer photos
      }

      // Use local placeholder images for testing
      const userPhotos = [];

      for (let p = 0; p < numPhotos; p++) {
        const now = new Date();
        const isProfile = p === 0; // First photo is profile
        const privacy = p === 0 ? 'public' : getRandomElement(['private', 'public', 'friends_only']);
        
        const photoData = {
          url: getRandomElement(placeholderImages),
          isProfile: isProfile,
          privacy: privacy,
          isDeleted: false,
          uploadedAt: new Date(now - getRandomInt(0, 1000 * 60 * 60 * 24 * 10)),
          metadata: {
            filename: `photo_${crypto.randomBytes(4).toString('hex')}.jpg`,
            size: getRandomInt(50000, 500000),
            mimeType: 'image/jpeg',
            width: getRandomInt(800, 1200),
            height: getRandomInt(800, 1200)
          }
        };

        userPhotos.push(photoData);
      }

      if (userPhotos.length > 0) {
        try {
          // Update user with photos conforming to new schema
          const updatedUser = await User.findByIdAndUpdate(
            user._id,
            { $set: { photos: userPhotos } },
            { new: true }
          );

          if (updatedUser && updatedUser.photos) {
            // Record all photos for potential permissions
            updatedUser.photos.forEach((photo) => {
              if (photo._id) {
                allPhotoIdsWithOwner.push({
                  photoId: photo._id.toString(),
                  ownerId: updatedUser._id.toString(),
                  privacy: photo.privacy
                });
              }
            });
          }
        } catch(error) {
          logger.error(`Error adding photos for user ${user.nickname}: ${error.message}`);
        }
      }
    }

    logger.info(`Finished seeding photos. ${allPhotoIdsWithOwner.length} photos recorded.`);

    // --- 3. Seed Likes ---
    logger.info(`Seeding ${NUM_LIKES_TO_SEED} likes...`);
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

      if (!sender || !sender.details || !sender.details.lookingFor) {
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
            createdAt: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 10)),
            updatedAt: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 5))
          });
          await newLike.save();
          likesCreated++;
        }
      } catch (error) {
        if (error.code !== 11000) {
          logger.error(`Error creating like: ${error.message}`);
        }
      }
    }

    logger.info(`Seeded ${likesCreated} unique likes.`);

    // --- 4. Seed Photo Permission Requests ---
    logger.info(`Seeding ${NUM_PHOTO_REQUESTS_TO_SEED} photo permission requests...`);
    let requestsCreated = 0;

    // Get private photos for permission requests
    const privatePhotos = allPhotoIdsWithOwner.filter(p => p.privacy === 'private');

    if (privatePhotos.length > 0 && createdUserIds.length > 1) {
      for (let i = 0; i < NUM_PHOTO_REQUESTS_TO_SEED; i++) {
        if (privatePhotos.length === 0) break;

        const randomPhotoIndex = getRandomInt(0, privatePhotos.length - 1);
        const { photoId, ownerId } = privatePhotos[randomPhotoIndex];

        // Find potential requesters (anyone except the owner)
        const potentialRequesters = createdUserIds.filter(id => id !== ownerId);

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
            // Random status with appropriate weighting
            const status = getRandomElement(['pending', 'approved', 'rejected', 'pending', 'pending']); // More pending

            const newRequest = new PhotoPermission({
              photo: photoId,
              requestedBy: requesterId,
              photoOwnerId: ownerId,
              status,
              createdAt: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 10)),
              updatedAt: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 5))
            });

            await newRequest.save();
            requestsCreated++;
          }
        } catch (error) {
          if (error.code !== 11000) {
            logger.error(`Error creating photo permission request: ${error.message}`);
          }
        }
      }

      logger.info(`Seeded ${requestsCreated} unique photo permission requests.`);
    } else {
      logger.warn('Skipping photo request seeding: Not enough users or no private photos found.');
    }

    // Create one test user with fixed credentials
    try {
      // Delete the test user if it exists
      await User.deleteOne({ email: 'test@example.com' });
      
      // Create a new test user
      const testUser = new User({
        nickname: 'Test User',
        username: 'testuser',
        email: 'test@example.com',
        password: await bcrypt.hash('password123', SALT_ROUNDS),
        role: 'user',
        accountTier: 'PAID',
        details: {
          age: 30,
          gender: 'male',
          location: 'Tel Aviv',
          interests: ['Dating', 'Fitness', 'Music'],
          iAm: 'man',
          lookingFor: ['women', 'couples'],
          intoTags: ['Meetups', 'Online fun', 'Photography'],
          turnOns: ['Intelligence', 'Confidence', 'Creativity'],
          maritalStatus: 'Single',
          bio: 'This is a test user account with predictable login credentials.'
        },
        isOnline: true,
        lastActive: new Date(),
        isVerified: true,
        active: true,
      });
      
      // Add photos to test user with new schema format
      const testUserPhotos = [];
      for (let i = 0; i < 2; i++) {
        testUserPhotos.push({
          url: placeholderImages[i],
          isProfile: i === 0,
          privacy: i === 0 ? 'public' : 'private',
          isDeleted: false,
          uploadedAt: new Date(),
          metadata: {
            filename: `test_photo_${i}.jpg`,
            size: 123456,
            mimeType: 'image/jpeg',
            width: 1000,
            height: 1000
          }
        });
      }
      
      testUser.photos = testUserPhotos;
      await testUser.save();
      
      logger.info('Created test user with email: test@example.com and password: password123');
    } catch (error) {
      logger.error(`Error creating test user: ${error.message}`);
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