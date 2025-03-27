// seedDb.js (Corrected for Enums)
import mongoose from 'mongoose';
import bcrypt from 'bcrypt'; // Ensure consistent bcrypt library (bcrypt or bcryptjs)
// import { faker } from '@faker-js/faker'; // Optional

// --- Configuration ---
const MONGO_URI = 'mongodb://localhost:27017/mandarin'; // IMPORTANT: Replace
const NUM_USERS = 300;
const MAX_PHOTOS_PER_USER = 5;
const NUM_LIKES_TO_SEED = 300;
const NUM_PHOTO_REQUESTS_TO_SEED = 150;
// Match salt rounds from User model (bcrypt default is often 10, bcryptjs uses 12 in model)
const SALT_ROUNDS = 12;

// --- Import Mongoose Models ---
import User from './models/User.js';
import Like from './models/Like.js';
import PhotoPermission from './models/PhotoPermission.js';
import logger from './logger.js';

// --- Helper Functions ---
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

// --- CORRECTED Data Arrays based on User.js model ---
const roles = ["user"]; // Correct Enum: ["user", "moderator", "admin"] - Defaulting to 'user'
const accountTiers = ["FREE", "PAID", "FEMALE", "COUPLE"]; // Correct Enum
const genders = ["male", "female", "non-binary", "other", ""]; // Correct Enum
const locations = ['Tel Aviv', 'Jerusalem', 'Haifa', 'Rishon LeZion', 'Petah Tikva', 'Ashdod', 'Netanya', 'Beersheba'];
const interests = ["Dating", "Casual", "Friendship", "Long-term", "Travel", "Outdoors", "Movies", "Music", "Fitness", "Food", "Art", "Gaming", "Reading", "Tech"];
const iAmOptions = ["woman", "man", "couple", ""]; // Correct Enum
const lookingForOptions = ["women", "men", "couples"]; // Correct Enum
// Assuming these tag fields are just arrays of strings and don't have strict enums in the model
const intoTagsOptions = ['Meetups', 'Forced bi', 'Kink', 'BDSM', 'Swinging', 'Group', 'Threesome', 'Chatting', 'Online fun'];
const turnOnsOptions = ['Dirty talk', 'Fit body', 'Intelligence', 'Humor', 'Confidence', 'Dominance', 'Submission', 'Uniforms'];
const maritalStatusOptions = ['Single', 'Married', 'Divorced', 'Widowed', 'In relationship', 'Other']; // Added Other as example

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

    // --- 1. Seed Users ---
    logger.info(`Seeding ${NUM_USERS} users...`);
    for (let i = 0; i < NUM_USERS; i++) {
      const plainPassword = 'password123';
      const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);

      const userDetails = {
        nickname: `User_${i + 1}`, // faker.internet.userName(),
        email: `user${i + 1}@example.com`, // faker.internet.email(),
        password: hashedPassword,
        role: getRandomElement(roles), // Using corrected 'roles' array
        accountTier: getRandomElement(accountTiers), // Using corrected 'accountTiers' array
        details: {
          age: getRandomInt(18, 65),
          gender: getRandomElement(genders), // Using corrected 'genders' array
          location: getRandomElement(locations),
          bio: `Bio for user ${i + 1}.`, // faker.lorem.paragraph(),
          interests: Array.from({ length: getRandomInt(1, 5) }, () => getRandomElement(interests)),
          iAm: getRandomElement(iAmOptions), // Using corrected 'iAmOptions' array
          // Generate 1 or 2 valid 'lookingFor' options
          lookingFor: Array.from({ length: getRandomInt(1, 2) }, () => getRandomElement(lookingForOptions)), // Using corrected 'lookingForOptions' array
          intoTags: Array.from({ length: getRandomInt(1, 4) }, () => getRandomElement(intoTagsOptions)),
          turnOns: Array.from({ length: getRandomInt(1, 4) }, () => getRandomElement(turnOnsOptions)),
          maritalStatus: getRandomElement(maritalStatusOptions) // Example
        },
        isOnline: Math.random() < 0.3,
        lastActive: new Date(Date.now() - getRandomInt(0, 1000 * 60 * 60 * 24 * 7)),
        photos: [],
        // Set verification flags if needed by your login logic
        isVerified: true, // Assuming seeded users should be verified
        active: true, // Assuming seeded users should be active
      };

      try {
        const newUser = new User(userDetails);
        const savedUser = await newUser.save();
        createdUserIds.push(savedUser._id.toString());
        createdUsers.push(savedUser);
      } catch (error) {
         logger.error(`Error creating user ${i + 1}: ${error.message}. Skipping user.`);
         if (error.code === 11000) {
            logger.warn(`Duplicate key error for user ${i + 1}. Might be email/nickname collision.`);
         }
         if (error.errors) { // Log specific validation errors
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

    // --- 2. Seed Photos ---
    logger.info('Seeding photos for users...');
    const allPrivatePhotoIdsWithOwner = [];
    // Define placeholder URLs based on 'iAm' field
    const photoMap = {
        woman: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500', // Example URL (ensure it's hotlinkable or replace)
        man: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500', // Example URL
        couple: 'https://images.pexels.com/photos/1194410/pexels-photo-1194410.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500', // Example URL
        default: 'https://images.pexels.com/photos/1072179/pexels-photo-1072179.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500' // Fallback/placeholder
    };

    for (const user of createdUsers) {
      const numPhotos = getRandomInt(1, MAX_PHOTOS_PER_USER); // Ensure at least 1 photo
      const photosToAdd = [];
      const userType = user.details?.iAm || 'default'; // Get 'iAm' or use default
      const profilePicUrl = photoMap[userType] || photoMap.default;

      // Add the profile picture first (public)
      photosToAdd.push({
        url: profilePicUrl,
        isPrivate: false, // Make profile picture public
        metadata: { uploadedBySeed: true, originalName: `${userType}_profile.jpg` }
      });

      // Add additional random photos (some private)
      for (let p = 1; p < numPhotos; p++) {
        const isPrivate = Math.random() < 0.4; // ~40% private
        const randomPlaceholderUrl = `/uploads/seed/placeholder_${getRandomInt(1, 10)}.jpg`; // Use placeholder for others

        const photoData = {
          url: randomPlaceholderUrl,
          isPrivate: isPrivate,
          metadata: { uploadedBySeed: true, originalName: `placeholder_${p + 1}.jpg` }
        };
        photosToAdd.push(photoData);
      }

      if (photosToAdd.length > 0) {
        try {
          // Update user directly
          const updatedUser = await User.findByIdAndUpdate(
             user._id,
             { $set: { photos: photosToAdd } },
             { new: true } // Get the updated document back
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
    logger.warn("NOTE: Photo URLs used are examples from Pexels. Ensure these are stable or replace with your own hosted images.");


    // --- 3. Seed Likes ---
    logger.info(`Seeding ${NUM_LIKES_TO_SEED} likes...`);
    let likesCreated = 0;
    for (let i = 0; i < NUM_LIKES_TO_SEED; i++) {
      if (createdUserIds.length < 2) break;
      let senderId = getRandomElement(createdUserIds);
      let recipientId = getRandomElement(createdUserIds);
      while (senderId === recipientId) { recipientId = getRandomElement(createdUserIds); }

      try {
        const existingLike = await Like.findOne({ sender: senderId, recipient: recipientId });
        if (!existingLike) {
          const newLike = new Like({ sender: senderId, recipient: recipientId });
          await newLike.save();
          likesCreated++;
        }
      } catch (error) {
        if (error.code !== 11000) { logger.error(`Error creating like: ${error.message}`); }
      }
       if (likesCreated > 0 && likesCreated % 100 === 0) logger.info(`Seeded ${likesCreated} likes so far...`); // Adjusted progress log condition
    }
    logger.info(`Seeded ${likesCreated} unique likes.`);


    // --- 4. Seed Photo Requests ---
    logger.info(`Seeding ${NUM_PHOTO_REQUESTS_TO_SEED} photo permission requests...`);
    let requestsCreated = 0;
    if (allPrivatePhotoIdsWithOwner.length > 0 && createdUserIds.length > 1) {
        for (let i = 0; i < NUM_PHOTO_REQUESTS_TO_SEED; i++) {
            if (allPrivatePhotoIdsWithOwner.length === 0) break; // Break if no private photos exist
            const randomPhotoIndex = getRandomInt(0, allPrivatePhotoIdsWithOwner.length - 1);
            const { photoId, ownerId } = allPrivatePhotoIdsWithOwner[randomPhotoIndex];

            let requesterId = getRandomElement(createdUserIds);
            while (requesterId === ownerId) {
                 requesterId = getRandomElement(createdUserIds);
                 if (createdUserIds.length === 1) break;
             }
             if (requesterId === ownerId) continue;

            try {
                 const existingRequest = await PhotoPermission.findOne({ photo: photoId, requestedBy: requesterId });
                 if (!existingRequest) {
                    const newRequest = new PhotoPermission({
                        photo: photoId,
                        requestedBy: requesterId,
                        photoOwnerId: ownerId, // Ensure this field exists in your PhotoPermission model
                        status: 'pending'
                    });
                    await newRequest.save();
                    requestsCreated++;
                 }
            } catch (error) {
                 if (error.code !== 11000) { logger.error(`Error creating photo permission request: ${error.message}`); }
            }
            if (requestsCreated > 0 && requestsCreated % 50 === 0) logger.info(`Seeded ${requestsCreated} photo requests so far...`); // Adjusted progress log condition
        }
        logger.info(`Seeded ${requestsCreated} unique photo permission requests.`);
    } else {
        logger.warn('Skipping photo request seeding: Not enough users or no private photos found.');
    }


    logger.info('Database seeding completed successfully!');

  } catch (error) {
    logger.error('Database seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected.');
  }
};

// Run the seeding function
seedDatabase();
