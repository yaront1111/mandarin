/**
 * Direct Database Fix Script
 *
 * This script fixes issues with user data by directly updating the MongoDB collections,
 * bypassing Mongoose validation completely.
 * Run this script with: node direct-db-fix.js
 */

const mongoose = require("mongoose")
const config = require("./config")
const logger = require("./logger")

// Connect to MongoDB
mongoose
  .connect(config.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    logger.info("MongoDB connected for direct database fix")
    fixDatabaseDirectly()
  })
  .catch((err) => {
    logger.error(`MongoDB connection error: ${err.message}`)
    process.exit(1)
  })

async function fixDatabaseDirectly() {
  try {
    logger.info("Starting direct database fix...")

    // Get direct access to collections
    const db = mongoose.connection.db
    const usersCollection = db.collection("users")
    const storiesCollection = db.collection("stories")

    // 1. Fix users without nicknames or usernames
    const usersToFix = await usersCollection
      .find({
        $or: [
          { nickname: { $exists: false } },
          { nickname: null },
          { nickname: "" },
          { username: { $exists: false } },
          { username: null },
          { username: "" },
        ],
      })
      .toArray()

    logger.info(`Found ${usersToFix.length} users with missing nickname or username`)

    for (const user of usersToFix) {
      // Generate nickname and username if needed
      let nickname = user.nickname
      let username = user.username

      if (!nickname) {
        if (user.name) {
          nickname = user.name
        } else if (user.email) {
          nickname = user.email.split("@")[0]
        } else if (username) {
          nickname = username
        } else {
          nickname = `User ${user._id.toString().slice(-6)}`
        }
      }

      if (!username) {
        if (user.email) {
          username = user.email.split("@")[0]
        } else if (nickname) {
          username = nickname.toLowerCase().replace(/\s+/g, "_")
        } else {
          username = `user_${user._id.toString().slice(-6)}`
        }
      }

      // Update the user directly in the database
      await usersCollection.updateOne(
        { _id: user._id },
        {
          $set: {
            username: username,
            nickname: nickname,
            name: user.name || nickname,
          },
        },
      )

      logger.info(`Fixed user ${user._id}: nickname=${nickname}, username=${username}`)
    }

    // 2. Fix users with empty profilePicture and avatar
    const usersWithoutPics = await usersCollection
      .find({
        $or: [
          { profilePicture: { $exists: false } },
          { profilePicture: "" },
          { avatar: { $exists: false } },
          { avatar: "" },
        ],
      })
      .toArray()

    logger.info(`Found ${usersWithoutPics.length} users without profile pictures`)

    for (const user of usersWithoutPics) {
      // Generate a placeholder avatar URL
      const placeholderUrl = `/api/avatar/${user._id.toString()}`

      await usersCollection.updateOne(
        { _id: user._id },
        {
          $set: {
            profilePicture: user.profilePicture || placeholderUrl,
            avatar: user.avatar || placeholderUrl,
          },
        },
      )

      logger.info(`Fixed user ${user._id} profile pictures`)
    }

    // 3. Fix stories with missing user references
    const storiesWithoutUser = await storiesCollection.find({ user: { $exists: false } }).toArray()
    logger.info(`Found ${storiesWithoutUser.length} stories without user reference`)

    // Delete stories without user reference as they can't be fixed
    if (storiesWithoutUser.length > 0) {
      await storiesCollection.deleteMany({ user: { $exists: false } })
      logger.info(`Deleted ${storiesWithoutUser.length} stories without user reference`)
    }

    // 4. Fix stories with invalid user references
    logger.info("Fixing stories with invalid user references...")
    const allStories = await storiesCollection.find().toArray()
    let invalidUserCount = 0

    for (const story of allStories) {
      // Check if user exists
      const userExists = await usersCollection.findOne({ _id: story.user })

      if (!userExists) {
        invalidUserCount++
        // Delete story with invalid user reference
        await storiesCollection.deleteOne({ _id: story._id })
      }
    }

    logger.info(`Deleted ${invalidUserCount} stories with invalid user references`)

    // 5. Fix duplicate stories
    logger.info("Fixing duplicate stories...")
    const storyGroups = {}
    const allValidStories = await storiesCollection.find().toArray()

    // Group stories by user and content hash
    for (const story of allValidStories) {
      const userId = story.user.toString()
      const contentHash = story.type + (story.media || "") + (story.content || "")
      const key = `${userId}:${contentHash}`

      if (!storyGroups[key]) {
        storyGroups[key] = []
      }

      storyGroups[key].push(story)
    }

    // Find and delete duplicates
    let duplicatesDeleted = 0
    for (const key in storyGroups) {
      const group = storyGroups[key]
      if (group.length > 1) {
        // Sort by creation date (newest first)
        group.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

        // Keep the newest one, delete the rest
        for (let i = 1; i < group.length; i++) {
          await storiesCollection.deleteOne({ _id: group[i]._id })
          duplicatesDeleted++
        }
      }
    }

    logger.info(`Deleted ${duplicatesDeleted} duplicate stories`)

    // 6. Add userData to stories for faster access
    logger.info("Adding userData to stories for faster access...")
    const storiesNeedingUserData = await storiesCollection.find().toArray()
    let storiesUpdated = 0

    for (const story of storiesNeedingUserData) {
      const user = await usersCollection.findOne({ _id: story.user })
      if (user) {
        // Create userData object with essential user info
        const userData = {
          _id: user._id,
          nickname: user.nickname,
          username: user.username,
          name: user.name,
          profilePicture: user.profilePicture || user.avatar || `/api/avatar/${user._id.toString()}`,
          avatar: user.avatar || user.profilePicture || `/api/avatar/${user._id.toString()}`,
        }

        // Update the story with userData
        await storiesCollection.updateOne({ _id: story._id }, { $set: { userData: userData } })

        storiesUpdated++
      }
    }

    logger.info(`Updated ${storiesUpdated} stories with userData`)

    logger.info("Database fix completed successfully!")
    process.exit(0)
  } catch (error) {
    logger.error(`Error fixing database: ${error.message}`)
    process.exit(1)
  }
}
