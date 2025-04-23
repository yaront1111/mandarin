// server/middleware/permissions.js
import { User } from "../models/index.js";
import logger from "../logger.js";

/**
 * Middleware to check if user can send messages (beyond winks)
 */
export const canSendMessages = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      logger.error("canSendMessages called without authenticated user");
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      logger.warn(`canSendMessages: user not found (${req.user.id})`);
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (!user.canSendMessages()) {
      logger.debug(`canSendMessages denied for ${user.id} (tier: ${user.accountTier})`);
      return res.status(403).json({
        success: false,
        error: "Free accounts can only send winks. Upgrade to send messages.",
        code: "UPGRADE_REQUIRED",
        subscriptionDetails: {
          accountTier: user.accountTier,
          canSendMessages: false,
        },
      });
    }

    next();
  } catch (err) {
    logger.error(`canSendMessages error: ${err.message}`, { stack: err.stack });
    return res.status(500).json({ success: false, error: "Server error checking permissions" });
  }
};

/**
 * Middleware to enforce story‑creation cooldown
 */
export const canCreateStory = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      logger.error("canCreateStory called without authenticated user");
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      logger.warn(`canCreateStory: user not found (${req.user.id})`);
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (!user.canCreateStory()) {
      const COOLDOWN_MS = 72 * 60 * 60 * 1000; // 72h
      const last = user.lastStoryCreated?.getTime() || 0;
      const elapsed = Date.now() - last;
      const remainingMs = Math.max(0, COOLDOWN_MS - elapsed);
      const hoursRemaining = Math.ceil(remainingMs / (1000 * 60 * 60));

      logger.debug(`canCreateStory denied for ${user.id}: ${hoursRemaining}h remaining`);
      return res.status(403).json({
        success: false,
        error: `Free accounts can only create one story every 72 hours. Try again in ${hoursRemaining} hours.`,
        code: "COOLDOWN_ACTIVE",
        cooldownDetails: {
          cooldownRemainingMs: remainingMs,
          hoursRemaining,
          nextAvailable: new Date(last + COOLDOWN_MS),
        },
      });
    }

    // flag for route to update lastStoryCreated after success
    req.updateLastStoryCreated = true;
    next();
  } catch (err) {
    logger.error(`canCreateStory error: ${err.message}`, { stack: err.stack });
    return res.status(500).json({ success: false, error: "Server error checking permissions" });
  }
};

/**
 * Middleware to enforce daily like limits
 */
export const canLikeUser = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      logger.error("canLikeUser called without authenticated user");
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      logger.warn(`canLikeUser: user not found (${req.user.id})`);
      return res.status(404).json({ success: false, error: "User not found" });
    }

    req.userObj = user; // expose full user to route if needed

    // Unlimited for PAID / FEMALE / COUPLE
    if (["PAID", "FEMALE", "COUPLE"].includes(user.accountTier)) {
      return next();
    }

    // FREE has dailyLikesRemaining
    if (user.dailyLikesRemaining <= 0) {
      const now = Date.now();
      const resetTime = user.dailyLikesReset?.getTime() || now;
      const hoursToReset = Math.max(0, Math.ceil((resetTime - now) / (1000 * 60 * 60)));

      logger.debug(
        `canLikeUser denied for ${user.id} (no likes left, resets in ${hoursToReset}h)`
      );
      return res.status(403).json({
        success: false,
        error: "You’ve reached your daily like limit. Upgrade for unlimited likes.",
        code: "DAILY_LIMIT_REACHED",
        likeDetails: {
          accountTier: user.accountTier,
          dailyLikesRemaining: 0,
          dailyLikesReset: user.dailyLikesReset,
          resetInHours: hoursToReset,
        },
      });
    }

    next();
  } catch (err) {
    logger.error(`canLikeUser error: ${err.message}`, { stack: err.stack });
    return res.status(500).json({ success: false, error: "Server error checking permissions" });
  }
};

/**
 * Middleware to block interactions between blocked users
 */
export const checkBlockStatus = async (req, res, next) => {
  try {
    const targetId = req.params.id || req.body.userId || req.body.recipientId;
    const meId = req.user?.id;
    if (!meId || !targetId) return next();

    const me = await User.findById(meId);
    if (!me) return next();

    // If I’ve blocked them
    if (me.hasBlocked?.(targetId)) {
      logger.debug(`Blocked interaction: ${meId} → ${targetId}`);
      return res.status(403).json({
        success: false,
        error: "You have blocked this user",
        code: "USER_BLOCKED",
      });
    }

    // If they’ve blocked me
    const them = await User.findById(targetId);
    if (them?.hasBlocked?.(meId)) {
      logger.debug(`Blocked interaction: ${targetId} → ${meId}`);
      return res.status(403).json({
        success: false,
        error: "You cannot interact with this user",
        code: "BLOCKED_BY_USER",
      });
    }

    next();
  } catch (err) {
    logger.error(`checkBlockStatus error: ${err.message}`, { stack: err.stack });
    // don’t block the flow on errors
    next();
  }
};
