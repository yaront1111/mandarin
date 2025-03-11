// server/src/seedDatabase.js

/**
 * Database Seeding Script
 *
 * This script will populate your database with:
 * - 100 users with realistic profile data
 * - Profile information for each user
 * - Mock photos (references to placeholder images)
 * - Likes between users
 * - Matches based on mutual likes
 *
 * Usage:
 * 1. Ensure your server config is correct
 * 2. Run with: node server/src/seedDatabase.js
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const { sequelize, User, Profile, Photo, Like, Match, Message } = require('./models');
const { QueryTypes } = require('sequelize');

// Configuration
const TOTAL_USERS = 100;
const MIN_PHOTOS_PER_USER = 1;
const MAX_PHOTOS_PER_USER = 5;
const LIKES_PERCENTAGE = 0.3; // 30% of possible connections will be likes
const MESSAGE_CHANCE_PER_MATCH = 0.7; // 70% of matches will have messages
const MAX_MESSAGES_PER_MATCH = 10;

// Common data for generation
const maleFirstNames = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
  'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth',
  'Kevin', 'Brian', 'George', 'Timothy', 'Ronald', 'Jason', 'Edward', 'Jeffrey', 'Ryan', 'Jacob'
];

const femaleFirstNames = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen',
  'Lisa', 'Nancy', 'Betty', 'Sandra', 'Margaret', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle',
  'Carol', 'Amanda', 'Dorothy', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Laura', 'Sharon', 'Cynthia'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor',
  'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson',
  'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker', 'Hall', 'Allen', 'Young', 'Hernandez', 'King'
];

const interests = [
  'Reading', 'Cooking', 'Hiking', 'Photography', 'Traveling', 'Music', 'Movies', 'Gaming', 'Sports', 'Yoga',
  'Swimming', 'Dancing', 'Painting', 'Writing', 'Cycling', 'Running', 'Fishing', 'Camping', 'Gardening', 'Chess',
  'Tennis', 'Golf', 'Skiing', 'Surfing', 'Climbing', 'Meditation', 'Singing', 'Acting', 'Shopping', 'Podcasts'
];

const bioTemplates = [
  "Passionate about {interest1} and {interest2}. Looking for someone who enjoys the same things.",
  "Lover of {interest1}, {interest2}, and good conversation. Let's see where this goes!",
  "Work hard, play harder. Into {interest1} and {interest2} on weekends.",
  "Life's too short not to try {interest1}! Also enjoy {interest2} when I have free time.",
  "Exploring life through {interest1} and {interest2}. Want to join me?",
  "{interest1} enthusiast and {interest2} newbie. Looking for new experiences!",
  "Coffee addict with a passion for {interest1} and {interest2}.",
  "Just a simple person who enjoys {interest1} and {interest2}.",
  "Living life one {interest1} session at a time. Also into {interest2}!",
  "My friends say I'm obsessed with {interest1}, but I also love {interest2}."
];

const messageTemplates = [
  "Hey there! How's your day going?",
  "Hi! I noticed we both like {interest}. Have you been doing that for long?",
  "Hello! What's your favorite thing about {interest}?",
  "Nice to connect with you! What are you up to this weekend?",
  "Hey! Your photos are great. Is that {place} in your second pic?",
  "Hi there! What's your favorite movie?",
  "Hey, how long have you been in this area?",
  "Hello! Do you have any recommendations for good {interest} spots around here?",
  "Hi! What do you like to do for fun?",
  "Hey there! If you could travel anywhere right now, where would you go?"
];

const responseTemplates = [
  "Hey! I'm doing pretty well, thanks for asking. How about you?",
  "It's going well! Just finished some {interest} actually. Do you enjoy that too?",
  "Hi there! I've been into {interest} for about 3 years now. What about you?",
  "Hello! I'm actually planning to go {interest} this weekend. Any plans yourself?",
  "Thanks for the compliment! Yes, that's {place}. Have you been there?",
  "I'd have to say it's a tie between {movie1} and {movie2}. What's yours?",
  "I've been here for about 2 years now. Still discovering new places!",
  "For {interest}, you should definitely check out {place}. It's amazing!",
  "I'm really into {interest1} and {interest2} lately. What about you?",
  "Without a doubt, {place}! I've been dreaming about going there for years."
];

// Helper functions
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomElements(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Generate a random date of birth for someone between 18 and 50 years old
function getRandomBirthDate() {
  const now = new Date();
  const minAge = 18;
  const maxAge = 50;
  const minDate = new Date(now.getFullYear() - maxAge, now.getMonth(), now.getDate());
  const maxDate = new Date(now.getFullYear() - minAge, now.getMonth(), now.getDate());
  return getRandomDate(minDate, maxDate).toISOString().split('T')[0]; // YYYY-MM-DD
}

// Main seeding function
async function seedDatabase() {
  try {
    // Start transaction
    const t = await sequelize.transaction();

    try {
      console.log('Starting database seeding...');

      // Check if the lastActive column exists, add it if it doesn't
      const checkColumn = await sequelize.query(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_name='Users' AND column_name='lastActive'`,
        {
          type: QueryTypes.SELECT,
          transaction: t
        }
      );

      if (checkColumn.length === 0) {
        console.log('Adding lastActive column to Users table...');
        await sequelize.query(
          `ALTER TABLE "Users" ADD COLUMN "lastActive" TIMESTAMP WITH TIME ZONE`,
          { transaction: t }
        );
      }

      // Clear existing data (optional - uncomment if you want to start fresh)
      console.log('Clearing existing data...');
      await Message.destroy({ where: {}, transaction: t, force: true });
      await Match.destroy({ where: {}, transaction: t, force: true });
      await Like.destroy({ where: {}, transaction: t, force: true });
      await Photo.destroy({ where: {}, transaction: t, force: true });
      await Profile.destroy({ where: {}, transaction: t, force: true });
      await User.destroy({ where: {}, transaction: t, force: true });

      console.log('Creating users and profiles...');
      const users = [];
      const plainPassword = 'password123'; // Same password for all test users

      // Create users
      for (let i = 0; i < TOTAL_USERS; i++) {
        const gender = Math.random() > 0.5 ? 'male' : 'female';
        const firstName = gender === 'male'
          ? getRandomElement(maleFirstNames)
          : getRandomElement(femaleFirstNames);
        const lastName = getRandomElement(lastNames);
        const nickname = `${firstName.toLowerCase()}${getRandomInt(1, 999)}`;
        const birthDate = getRandomBirthDate();
        const email = `${nickname}@example.com`;

        // Looking for preferences
        const lookingFor = [];
        if (Math.random() > 0.5) lookingFor.push('dating');
        if (Math.random() > 0.5) lookingFor.push('sex');
        if (lookingFor.length === 0 || Math.random() > 0.7) lookingFor.push('all');

        // Create the user
        const user = await User.create({
          id: uuidv4(),
          email,
          password: plainPassword,
          firstName,
          lastName,
          nickname,
          birthDate,
          gender,
          lookingFor,
          role: 'user',
          accountStatus: 'active',
          lastActive: new Date(),
        }, { transaction: t });

        users.push(user);

        // Create profile for the user
        const userInterests = getRandomElements(interests, getRandomInt(3, 8));
        const bioTemplate = getRandomElement(bioTemplates);
        const bio = bioTemplate
          .replace('{interest1}', getRandomElement(userInterests))
          .replace('{interest2}', getRandomElement(userInterests));

        await Profile.create({
          id: uuidv4(),
          userId: user.id,
          bio,
          interests: userInterests,
        }, { transaction: t });

        // Create photos for the user
        const photoCount = getRandomInt(MIN_PHOTOS_PER_USER, MAX_PHOTOS_PER_USER);
        for (let j = 0; j < photoCount; j++) {
          // Using placeholder images
          const photoNumber = getRandomInt(1, 1000);
          const width = getRandomInt(300, 800);
          const height = getRandomInt(300, 800);
          const isPrivate = j === 0 ? false : Math.random() > 0.8; // First photo is always public

          await Photo.create({
            id: uuidv4(),
            userId: user.id,
            url: `https://picsum.photos/id/${photoNumber}/${width}/${height}`,
            isPrivate,
            caption: Math.random() > 0.5 ? `Photo ${j+1}` : null,
          }, { transaction: t });
        }
      }

      console.log('Creating likes between users...');
      // Generate likes between users
      const totalPossibleLikes = TOTAL_USERS * (TOTAL_USERS - 1);
      const likesToCreate = Math.floor(totalPossibleLikes * LIKES_PERCENTAGE);

      const createdLikes = new Set(); // Track created likes to avoid duplicates

      for (let i = 0; i < likesToCreate; i++) {
        let userId, targetId;

        // Ensure we don't create duplicates or self-likes
        do {
          userId = getRandomElement(users).id;
          targetId = getRandomElement(users).id;
        } while (userId === targetId || createdLikes.has(`${userId}-${targetId}`));

        createdLikes.add(`${userId}-${targetId}`);

        await Like.create({
          id: uuidv4(),
          userId,
          targetId
        }, { transaction: t });
      }

      console.log('Creating matches based on mutual likes...');
      // Find mutual likes and create matches
      const likes = await Like.findAll({ transaction: t });

      const likesByUser = {};
      likes.forEach(like => {
        if (!likesByUser[like.userId]) {
          likesByUser[like.userId] = new Set();
        }
        likesByUser[like.userId].add(like.targetId);
      });

      const matches = [];

      // Find mutual likes
      for (const userId in likesByUser) {
        for (const targetId of likesByUser[userId]) {
          if (likesByUser[targetId] && likesByUser[targetId].has(userId)) {
            // Ensure we don't create duplicate matches (A-B and B-A are the same match)
            const matchPair = [userId, targetId].sort().join('-');

            if (!matches.includes(matchPair)) {
              matches.push(matchPair);

              const matchId = uuidv4();

              // Create match in database
              await Match.create({
                id: matchId,
                userAId: userId,
                userBId: targetId
              }, { transaction: t });

              // Create messages for some matches
              if (Math.random() < MESSAGE_CHANCE_PER_MATCH) {
                const messageCount = getRandomInt(1, MAX_MESSAGES_PER_MATCH);

                // Generate a conversation with alternating messages
                const userAInterests = (await Profile.findOne({
                  where: { userId },
                  transaction: t
                }))?.interests || [];

                const userBInterests = (await Profile.findOne({
                  where: { userId: targetId },
                  transaction: t
                }))?.interests || [];

                const commonInterests = userAInterests.filter(i => userBInterests.includes(i));
                const randomInterest = getRandomElement(commonInterests || interests);

                // Create an opening message
                let firstMessage = getRandomElement(messageTemplates).replace('{interest}', randomInterest);

                await Message.create({
                  id: uuidv4(),
                  matchId,
                  senderId: Math.random() > 0.5 ? userId : targetId,
                  content: firstMessage,
                  messageType: 'text',
                  isRead: true,
                  createdAt: new Date(Date.now() - getRandomInt(1, 10) * 24 * 60 * 60 * 1000) // 1-10 days ago
                }, { transaction: t });

                // Create the rest of the conversation
                if (messageCount > 1) {
                  let lastSenderId = null;

                  for (let i = 1; i < messageCount; i++) {
                    const senderId = lastSenderId !== userId ? userId : targetId;
                    lastSenderId = senderId;

                    let template;
                    if (i === 1) {
                      // First response
                      template = getRandomElement(responseTemplates)
                        .replace('{interest}', randomInterest)
                        .replace('{place}', 'New York')
                        .replace('{movie1}', 'The Matrix')
                        .replace('{movie2}', 'Inception')
                        .replace('{interest1}', getRandomElement(interests))
                        .replace('{interest2}', getRandomElement(interests));
                    } else {
                      // Subsequent messages
                      if (Math.random() > 0.5) {
                        template = getRandomElement(messageTemplates)
                          .replace('{interest}', getRandomElement(interests))
                          .replace('{place}', 'Paris');
                      } else {
                        template = getRandomElement(responseTemplates)
                          .replace('{interest}', getRandomElement(interests))
                          .replace('{place}', 'Tokyo')
                          .replace('{movie1}', 'Pulp Fiction')
                          .replace('{movie2}', 'The Godfather')
                          .replace('{interest1}', getRandomElement(interests))
                          .replace('{interest2}', getRandomElement(interests));
                      }
                    }

                    // Each message is a bit more recent than the previous
                    const messageTime = new Date(Date.now() - getRandomInt(0, 7) * 24 * 60 * 60 * 1000 + i * 60 * 60 * 1000);

                    await Message.create({
                      id: uuidv4(),
                      matchId,
                      senderId,
                      content: template,
                      messageType: 'text',
                      isRead: Math.random() > 0.3, // Some messages are unread
                      createdAt: messageTime
                    }, { transaction: t });
                  }
                }
              }
            }
          }
        }
      }

      // Commit transaction
      await t.commit();
      console.log(`Successfully seeded database with ${TOTAL_USERS} users and ${matches.length} matches!`);
      console.log('Seed completed successfully.');

    } catch (error) {
      // Rollback transaction on error
      await t.rollback();
      console.error('Error in seeding process:', error);
      throw error;
    }
  } catch (error) {
    console.error('Transaction error:', error);
  } finally {
    // Close database connection
    await sequelize.close();
  }
}

// Run the seeding function
seedDatabase()
  .then(() => {
    console.log('Done! Exiting...');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
