// server/middleware/permissions.js
const { User } = require("../models")
const logger = require("../logger")

/**
 * Middleware to check if user can send messages (not just winks)
 */
const canSendMessages = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      })
    }

    if (!user.canSendMessages()) {
      return res.status(403).json({
        success: false,
        error: "Free accounts can only send winks. Upgrade to send messages.",
      })
    }

    next()
  } catch (err) {
    logger.error(`Error checking message permissions: ${err.message}`)
    return res.status(500).json({
      success: false,
      error: "Server error",
    })
  }
}

/**
 * Middleware to check if user can create a story
 */
const canCreateStory = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      })
    }

    if (!user.canCreateStory()) {
      // Calculate time remaining in cooldown
      const cooldownPeriod = 72 * 60 * 60 * 1000 // 72 hours in milliseconds
      const timeSinceLastStory = Date.now() - user.lastStoryCreated.getTime()
      const timeRemaining = cooldownPeriod - timeSinceLastStory

      const hoursRemaining = Math.ceil(timeRemaining / (60 * 60 * 1000))

      return res.status(403).json({
        success: false,
        error: `Free accounts can only create 1 story every 72 hours. Please try again in ${hoursRemaining} hours.`,
        cooldownRemaining: timeRemaining,
      })
    }

    // If we get here, user can create a story
    // Update lastStoryCreated timestamp after successful story creation
    req.updateLastStoryCreated = true

    next()
  } catch (err) {
    logger.error(`Error checking story creation permissions: ${err.message}`)
    return res.status(500).json({
      success: false,
      error: "Server error",
    })
  }
}

/**
 * Middleware to check if user can like another user
 * Free users have a daily limit, premium users have unlimited likes
 */
exports.canLikeUser = async (req, res, next) => {
  try {
    // Get the full user object with account tier info
    const user = await User.findById(req.user._id)

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      })
    }

    // Store the user object for use in the route handler
    req.userObj = user

    // Premium users can always like
    if (user.accountTier === "PREMIUM") {
      return next()
    }

    // Free users have a daily limit
    if (user.accountTier === "FREE") {
      // Check if they've reached their daily limit
      if (user.dailyLikesRemaining <= 0) {
        return res.status(403).json({
          success: false,
          error: "You have reached your daily like limit. Upgrade to premium for unlimited likes!",
        })
      }
    }

    next()
  } catch (err) {
    logger.error(`Error in canLikeUser middleware: ${err.message}`)
    res.status(500).json({
      success: false,
      error: "Server error",
    })
  }
}

module.exports = {
  canSendMessages,
  canCreateStory,
  canLikeUser: exports.canLikeUser,
}
