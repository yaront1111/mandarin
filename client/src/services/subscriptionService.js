// client/src/services/subscriptionService.js
import apiService from './apiService';
import { toast } from 'react-toastify';

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
      const response = await apiService.get('/subscription/status');
      return response;
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      throw error;
    }
  },

  /**
   * Upgrade user to paid subscription
   * @param {string} plan - Subscription plan ('monthly' or 'yearly')
   * @returns {Promise<Object>} Updated user data with subscription info
   */
  upgradeSubscription: async (plan) => {
    try {
      const response = await apiService.post('/subscription/upgrade', { plan });

      // If successful, return the updated user data
      if (response.success) {
        // In a real implementation with payment processor, handle payment confirmation here
        toast.success(`Successfully upgraded to ${plan} plan!`);
        return response;
      } else {
        throw new Error(response.error || 'Failed to upgrade subscription');
      }
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      toast.error(error.message || 'Failed to upgrade subscription');
      throw error;
    }
  },

  /**
   * Cancel subscription
   * @returns {Promise<Object>} Updated user data
   */
  cancelSubscription: async () => {
    try {
      const response = await apiService.post('/subscription/cancel');

      if (response.success) {
        toast.info(response.message || 'Subscription successfully canceled');
        return response;
      } else {
        throw new Error(response.error || 'Failed to cancel subscription');
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast.error(error.message || 'Failed to cancel subscription');
      throw error;
    }
  }
};

export default subscriptionService;
