// server/routes/subscriptionRoutes.js
import express from "express"
import asyncHandler from "express-async-handler"
import { protect } from "../middleware/auth.js"
import { User } from "../models/index.js"
import logger from "../logger.js"
import config from "../config.js"

const router = express.Router()
const log = logger.child({ component: "SubscriptionRoutes" })

// Helpers ────────────────────────────────────────────────────────────────────────

/**
 * Load the current user from DB or send 404.
 */
async function getUserOr404(userId, res) {
  const user = await User.findById(userId)
  if (!user) {
    log.warn(`User not found: ${userId}`)
    res.status(404).json({ success: false, error: "User not found" })
    return null
  }
  return user
}

/**
 * Compute days between now and a future date.
 */
function daysUntil(date) {
  const ms = date - Date.now()
  return ms > 0 ? Math.ceil(ms / (1000 * 60 * 60 * 24)) : 0
}

/**
 * Compute hours between now and a future date.
 */
function hoursUntil(date) {
  const ms = date - Date.now()
  return ms > 0 ? Math.ceil(ms / (1000 * 60 * 60)) : 0
}

// ────────────────────────────────────────────────────────────────────────────────
// GET /api/subscription/status
// ────────────────────────────────────────────────────────────────────────────────
router.get(
  "/status",
  protect,
  asyncHandler(async (req, res) => {
    const user = await getUserOr404(req.user._id, res)
    if (!user) return

    // subscription expiry
    const expiry = user.subscriptionExpiry
    const daysRemaining = expiry ? daysUntil(new Date(expiry)) : 0

    // free-tier daily likes reset
    let likesResetHours = 0
    if (user.accountTier === "FREE" && user.dailyLikesReset) {
      likesResetHours = hoursUntil(new Date(user.dailyLikesReset))
    }

    // free-tier story cooldown (config or default 72h)
    let storyCreationHours = 0
    if (user.accountTier === "FREE" && user.lastStoryCreated) {
      const next = new Date(
        user.lastStoryCreated.getTime() + (config.STORY_COOLDOWN_HOURS || 72) * 3600_000
      )
      storyCreationHours = hoursUntil(next)
    }

    log.debug(`Status for ${user._id}: tier=${user.accountTier}, paid=${user.isPaid}`)

    return res.json({
      success: true,
      data: {
        accountTier:        user.accountTier,
        isPaid:             user.isPaid,
        subscriptionExpiry: user.subscriptionExpiry,
        daysRemaining,
        features: {
          canSendMessages:    user.canSendMessages(),
          canCreateStory:     user.canCreateStory(),
          dailyLikesRemaining:user.dailyLikesRemaining,
          likesResetHours,
          storyCreationHours,
        },
      },
    })
  })
)

// ────────────────────────────────────────────────────────────────────────────────
// POST /api/subscription/upgrade
// ────────────────────────────────────────────────────────────────────────────────
router.post(
  "/upgrade",
  protect,
  asyncHandler(async (req, res) => {
    const user = await getUserOr404(req.user._id, res)
    if (!user) return

    // already active?
    if (user.isPaid && user.subscriptionExpiry > Date.now()) {
      log.info(`Already subscribed: ${user._id}`)
      return res.status(400).json({
        success: false,
        error: "You already have an active subscription",
        code: "ALREADY_SUBSCRIBED",
        data: {
          accountTier: user.accountTier,
          subscriptionExpiry: user.subscriptionExpiry,
        },
      })
    }

    // extend by configured days (default 30)
    const days = config.SUBSCRIPTION_DAYS || 30
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + days)

    user.isPaid = true
    user.subscriptionExpiry = expiry
    user.accountTier = user.accountTier === "FREE" ? "PAID" : user.accountTier

    await user.save()
    log.info(`Upgraded ${user._id} until ${expiry.toISOString()}`)

    return res.json({
      success: true,
      message: "Subscription upgraded successfully",
      data: {
        accountTier:        user.accountTier,
        isPaid:             user.isPaid,
        subscriptionExpiry: user.subscriptionExpiry,
      },
    })
  })
)

// ────────────────────────────────────────────────────────────────────────────────
// POST /api/subscription/cancel
// ────────────────────────────────────────────────────────────────────────────────
router.post(
  "/cancel",
  protect,
  asyncHandler(async (req, res) => {
    const user = await getUserOr404(req.user._id, res)
    if (!user) return

    // must have a live subscription
    if (!user.isPaid || user.subscriptionExpiry <= Date.now()) {
      log.info(`No active subscription to cancel: ${user._id}`)
      return res.status(400).json({
        success: false,
        error: "You don't have an active subscription to cancel",
        code: "NO_ACTIVE_SUBSCRIPTION",
      })
    }

    // we simply let it expire at its current date
    log.info(`Canceled subscription for ${user._id}, expires at ${user.subscriptionExpiry}`)

    return res.json({
      success: true,
      message: "Subscription canceled; access remains until expiry date",
      data: {
        accountTier:        user.accountTier,
        isPaid:             user.isPaid,
        subscriptionExpiry: user.subscriptionExpiry,
      },
    })
  })
)

export default router
