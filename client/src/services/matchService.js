// src/services/matchService.js
import api from './api';

const matchService = {
  /**
   * Get all matches for the current user with pagination support
   * @param {Object} options - Pagination options
   * @param {Number} options.page - Page number (starting from 1)
   * @param {Number} options.limit - Number of items per page
   * @returns {Promise} - Promise resolving to matches data with pagination info
   */
  async getMatches(options = { page: 1, limit: 20 }) {
    try {
      const response = await api.get('/matches', {
        params: {
          page: options.page,
          limit: options.limit
        }
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching matches:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch matches');
    }
  },

  /**
   * Get mutual matches (people who liked you back)
   * @param {Object} options - Pagination options
   * @returns {Promise} - Promise resolving to mutual matches
   */
  async getMutualMatches(options = { page: 1, limit: 20 }) {
    try {
      const response = await api.get('/matches/mutual', {
        params: {
          page: options.page,
          limit: options.limit
        }
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching mutual matches:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch mutual matches');
    }
  },

  /**
   * Get potential matches for the discover page
   * @param {Object} filters - Optional filters for matching
   * @returns {Promise} - Promise resolving to potential matches
   */
  async getPotentialMatches(filters = {}) {
    try {
      const response = await api.get('/matches/potential', {
        params: filters
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching potential matches:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch potential matches');
    }
  },

  /**
   * Like a user profile
   * @param {String} targetId - ID of the user to like
   * @returns {Promise} - Promise resolving to like data, with match info if it's a mutual match
   */
  async likeUser(targetId) {
    try {
      const response = await api.post('/matches/like', { targetId });
      return response.data.data;
    } catch (error) {
      console.error('Error liking user:', error);
      throw new Error(error.response?.data?.message || 'Failed to like user');
    }
  },

  /**
   * Pass on a user profile (skip)
   * @param {String} targetId - ID of the user to pass
   * @returns {Promise}
   */
  async passUser(targetId) {
    try {
      const response = await api.post('/matches/pass', { targetId });
      return response.data.data;
    } catch (error) {
      console.error('Error passing user:', error);
      throw new Error(error.response?.data?.message || 'Failed to pass user');
    }
  },

  /**
   * Unmatch with a user
   * @param {String} matchId - ID of the match to remove
   * @returns {Promise}
   */
  async unmatch(matchId) {
    try {
      const response = await api.delete(`/matches/${matchId}`);
      return response.data;
    } catch (error) {
      console.error('Error unmatching user:', error);
      throw new Error(error.response?.data?.message || 'Failed to unmatch user');
    }
  },

  /**
   * Block a user
   * @param {String} userId - ID of the user to block
   * @returns {Promise}
   */
  async blockUser(userId) {
    try {
      const response = await api.post('/matches/block', { userId });
      return response.data;
    } catch (error) {
      console.error('Error blocking user:', error);
      throw new Error(error.response?.data?.message || 'Failed to block user');
    }
  },

  /**
   * Report a user
   * @param {String} userId - ID of the user to report
   * @param {String} reason - Reason for reporting
   * @param {String} details - Additional details
   * @returns {Promise}
   */
  async reportUser(userId, reason, details = '') {
    try {
      const response = await api.post('/matches/report', {
        userId,
        reason,
        details
      });
      return response.data;
    } catch (error) {
      console.error('Error reporting user:', error);
      throw new Error(error.response?.data?.message || 'Failed to report user');
    }
  },

  /**
   * Get user statistics (profile views, likes, matches, messages)
   * @returns {Promise} - Promise resolving to user stats
   */
  async getUserStats() {
    try {
      const response = await api.get('/users/stats');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching user stats:', error);
      // Return mock data if API is not implemented yet
      return {
        viewCount: 0,
        likeCount: 0,
        matchCount: 0,
        messageCount: 0,
        profileCompleteness: 0,
        responseRate: 0
      };
    }
  },

  /**
   * Get match filters
   * @returns {Promise} - Promise resolving to available match filters
   */
  async getMatchFilters() {
    try {
      const response = await api.get('/matches/filters');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching match filters:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch match filters');
    }
  },

  /**
   * Update match preferences
   * @param {Object} preferences - User's matching preferences
   * @returns {Promise}
   */
  async updateMatchPreferences(preferences) {
    try {
      const response = await api.put('/matches/preferences', preferences);
      return response.data;
    } catch (error) {
      console.error('Error updating match preferences:', error);
      throw new Error(error.response?.data?.message || 'Failed to update match preferences');
    }
  }
};

export default matchService;
