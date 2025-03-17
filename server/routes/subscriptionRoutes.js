const express = require("express")
const router = express.Router()
const { protect, asyncHandler } = require("../middleware/auth")
const User = require("../models/User")
const logger = require("../logger")

/**
 * @route   GET /api/subscription/status
 * @desc    Get user's subscription status
 * @access  Private
 */
router.get(
  "/status",
  protect,
  asyncHandler(async (req, res) => {
    try {
      const user = await User.findById(req.user._id)

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        })
      }

      // Calculate story cooldown if applicable
      let storyCooldown = null
      if (user.accountTier === "FREE" && user.lastStoryCreated) {
        const cooldownPeriod = 72 * 60 * 60 * 1000 // 72 hours in milliseconds
        const timeSinceLastStory = Date.now() - new Date(user.lastStoryCreated).getTime()
        const timeRemaining = cooldownPeriod - timeSinceLastStory

        if (timeRemaining > 0) {
          storyCooldown = Math.ceil(timeRemaining / (60 * 60 * 1000)) // hours remaining
        }
      }

      res.status(200).json({
        success: true,
        data: {
          accountTier: user.accountTier,
          isPaid: user.isPaid,
          subscriptionExpiry: user.subscriptionExpiry,
          dailyLikesRemaining: user.dailyLikesRemaining,
          dailyLikesReset: user.dailyLikesReset,
          lastStoryCreated: user.lastStoryCreated,
          storyCooldown,
          canSendMessages: user.accountTier !== "FREE",
          canCreateStory: user.canCreateStory(),
          maxDailyLikes: user.getMaxDailyLikes(),
        },
      })
    } catch (err) {
      logger.error(`Error fetching subscription status: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error",
      })
    }
  }),
)

/**
 * @route   POST /api/subscription/upgrade
 * @desc    Upgrade user to paid account
 * @access  Private
 */
router.post(
  "/upgrade",
  protect,
  asyncHandler(async (req, res) => {
    try {
      const { plan } = req.body

      if (!plan || !["monthly", "yearly"].includes(plan)) {
        return res.status(400).json({
          success: false,
          error: "Valid plan (monthly or yearly) is required",
        })
      }

      const user = await User.findById(req.user._id)

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        })
      }

      // Set subscription expiry date
      const now = new Date()
      const expiryDate = new Date()
      if (plan === "monthly") {
        expiryDate.setMonth(expiryDate.getMonth() + 1)
      } else {
        expiryDate.setFullYear(expiryDate.getFullYear() + 1)
      }

      // Update user account
      user.isPaid = true
      user.accountTier = "PAID"
      user.subscriptionExpiry = expiryDate

      await user.save()

      res.status(200).json({
        success: true,
        message: `Successfully upgraded to ${plan} plan`,
        data: {
          accountTier: user.accountTier,
          isPaid: user.isPaid,
          subscriptionExpiry: user.subscriptionExpiry,
        },
      })
    } catch (err) {
      logger.error(`Error upgrading subscription: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error",
      })
    }
  }),
)

/**
 * @route   POST /api/subscription/cancel
 * @desc    Cancel user's subscription
 * @access  Private
 */
router.post(
  "/cancel",
  protect,
  asyncHandler(async (req, res) => {
    try {
      const user = await User.findById(req.user._id)

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        })
      }

      // User will remain premium until subscription expiry
      user.isPaid = false

      // Only change account tier if it's not FEMALE or COUPLE
      if (user.accountTier === "PAID") {
        // Account tier will change to FREE after expiry
        // For now, we'll keep it as PAID until expiry
      }

      await user.save()

      res.status(200).json({
        success: true,
        message: "Subscription canceled. Premium access will remain until expiry date.",
        data: {
          accountTier: user.accountTier,
          isPaid: user.isPaid,
          subscriptionExpiry: user.subscriptionExpiry,
        },
      })
    } catch (err) {
      logger.error(`Error canceling subscription: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error",
      })
    }
  }),
)

module.exports = router
