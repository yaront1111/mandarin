// client/src/services/subscriptionService.jsx
import apiService from "./apiService.jsx";
import { toast } from "react-toastify";
import logger from "../utils/logger.js";

// Create a named logger for this service
const log = logger.create("SubscriptionService");

// Default subscription data for fallback
const DEFAULT_SUBSCRIPTION_STATUS = {
  accountTier: "FREE",
  isPaid: false,
  dailyLikesRemaining: 3,
  canSendMessages: false,
  canCreateStory: true,
};

/**
 * Service to handle subscription-related operations
 */
const subscriptionService = {
  /**
   * Get user's subscription status
   * @returns {Promise<Object>} Subscription status data
   */
  getSubscriptionStatus: async () => {
    try {
      log.debug("Fetching subscription status");
      const response = await apiService.get("/subscription/status");
      log.debug("Subscription status received", { tier: response?.data?.accountTier });
      return response;
    } catch (error) {
      log.error("Error fetching subscription status", error);

      // Return a default response to prevent UI errors
      return {
        success: true,
        data: DEFAULT_SUBSCRIPTION_STATUS,
      };
    }
  },

  /**
   * Upgrade user to paid subscription
   * @param {string} plan - Subscription plan ('monthly' or 'yearly')
   * @returns {Promise<Object>} Updated user data with subscription info
   */
  upgradeSubscription: async (plan) => {
    try {
      if (!plan || !["monthly", "yearly"].includes(plan)) {
        throw new Error("Invalid subscription plan. Please choose monthly or yearly.");
      }

      log.info(`Upgrading subscription to ${plan} plan`);
      const response = await apiService.post("/subscription/upgrade", { plan });

      // If successful, return the updated user data
      if (response.success) {
        log.info("Subscription upgrade successful", { plan });
        toast.success(`Successfully upgraded to ${plan} plan!`);
        return response;
      } else {
        log.warn("Subscription upgrade failed", { error: response.error });
        throw new Error(response.error || "Failed to upgrade subscription");
      }
    } catch (error) {
      log.error("Error upgrading subscription", error);
      toast.error(error.message || "Failed to upgrade subscription");
      throw error;
    }
  },

  /**
   * Cancel subscription
   * @returns {Promise<Object>} Updated user data
   */
  cancelSubscription: async () => {
    try {
      log.info("Canceling subscription");
      const response = await apiService.post("/subscription/cancel");

      if (response.success) {
        log.info("Subscription cancellation successful");
        toast.info(response.message || "Subscription successfully canceled");
        return response;
      } else {
        log.warn("Subscription cancellation failed", { error: response.error });
        throw new Error(response.error || "Failed to cancel subscription");
      }
    } catch (error) {
      log.error("Error canceling subscription", error);
      toast.error(error.message || "Failed to cancel subscription");
      throw error;
    }
  },

  /**
   * Check if user can perform a premium action
   * @param {string} actionType - Type of action ('message', 'like', 'story')
   * @returns {Promise<Object>} Whether the action is allowed and related data
   */
  checkActionPermission: async (actionType) => {
    try {
      const validActions = ["message", "like", "story"];
      if (!validActions.includes(actionType)) {
        log.warn(`Invalid action type requested: ${actionType}`);
        throw new Error("Invalid action type");
      }

      log.debug(`Checking permission for action: ${actionType}`);
      const status = await subscriptionService.getSubscriptionStatus();

      if (!status.success) {
        log.warn("Could not verify subscription status");
        throw new Error("Could not verify subscription status");
      }

      const { data } = status;

      // Check permissions based on action type
      let result;
      switch (actionType) {
        case "message":
          result = {
            allowed: data.canSendMessages,
            reason: data.canSendMessages ? null : "Messaging requires a premium account",
          };
          break;
        case "like":
          result = {
            allowed: data.accountTier !== "FREE" || data.dailyLikesRemaining > 0,
            reason: data.dailyLikesRemaining > 0 ? null : "You have used all your daily likes",
            remaining: data.dailyLikesRemaining,
          };
          break;
        case "story":
          result = {
            allowed: data.canCreateStory,
            reason: data.canCreateStory ? null : `Story creation available in ${data.storyCooldown} hours`,
            cooldown: data.storyCooldown,
          };
          break;
        default:
          result = { allowed: false, reason: "Unknown action type" };
      }

      log.debug(`Permission check result for ${actionType}:`, { allowed: result.allowed });
      return result;
    } catch (error) {
      log.error(`Error checking permission for ${actionType}`, error);
      return { 
        allowed: false, 
        reason: error.message || "Could not verify permissions" 
      };
    }
  },
};

export default subscriptionService;
