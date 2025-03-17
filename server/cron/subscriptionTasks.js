const cron = require("node-cron")
const User = require("../models/User")
const logger = require("../logger")

// Reset daily likes at midnight
cron.schedule("0 0 * * *", async () => {
  try {
    logger.info("Running daily likes reset task")

    const result = await User.updateMany(
      { accountTier: "FREE" },
      {
        $set: {
          dailyLikesRemaining: 3,
          dailyLikesReset: new Date(new Date().setHours(24, 0, 0, 0)),
        },
      },
    )

    logger.info(`Reset daily likes for ${result.nModified} users`)
  } catch (error) {
    logger.error(`Error resetting daily likes: ${error.message}`)
  }
})

// Check for expired subscriptions daily
cron.schedule("0 1 * * *", async () => {
  try {
    logger.info("Running subscription expiry check")

    const now = new Date()

    const result = await User.updateMany(
      {
        isPaid: false,
        accountTier: "PAID",
        subscriptionExpiry: { $lt: now },
      },
      {
        $set: { accountTier: "FREE" },
      },
    )

    logger.info(`Updated ${result.nModified} expired subscriptions`)
  } catch (error) {
    logger.error(`Error checking subscription expiry: ${error.message}`)
  }
})

module.exports = { initSubscriptionTasks: () => logger.info("Subscription tasks initialized") }
