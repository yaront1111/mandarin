// src/services/matchService.js
import api from './api';

/**
 * Get all matches for the current user with pagination support
 * @param {Object} options - Pagination options
 * @param {Number} options.page - Page number (starting from 1)
 * @param {Number} options.limit - Number of items per page
 * @returns {Promise} - Promise resolving to matches data with pagination info
 */
export const getMatches = async (options = { page: 1, limit: 20 }) => {
  try {
    const response = await api.get('api/matches', {
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
};

/**
 * Get mutual matches (people who liked you back)
 * @param {Object} options - Pagination options
 * @returns {Promise} - Promise resolving to mutual matches
 */
export const getMutualMatches = async (options = { page: 1, limit: 20 }) => {
  try {
    const response = await api.get('api/matches/mutual', {
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
};

/**
 * Get potential matches for the discover page
 * @param {Object} filters - Optional filters for matching
 * @returns {Promise} - Promise resolving to potential matches
 */
export const getPotentialMatches = async (filters = {}) => {
  try {
    const response = await api.get('api/matches/potential', {
      params: filters
    });
    return response.data.data;
  } catch (error) {
    console.error('Error fetching potential matches:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch potential matches');
  }
};

/**
 * Like a user profile
 * @param {String} targetId - ID of the user to like
 * @returns {Promise} - Promise resolving to like data, with match info if it's a mutual match
 */
export const likeUser = async (targetId) => {
  try {
    const response = await api.post('api/matches/like', { targetId });
    return response.data.data;
  } catch (error) {
    console.error('Error liking user:', error);
    throw new Error(error.response?.data?.message || 'Failed to like user');
  }
};

/**
 * Send a wink to a user
 * @param {String} targetId - ID of the user to wink
 * @returns {Promise} - Promise resolving to sent wink data
 */
export const sendWink = async (targetId) => {
  try {
    const response = await api.post('api/matches/wink', { targetId });
    return response.data.data;
  } catch (error) {
    console.error('Error sending wink:', error);
    throw new Error(error.response?.data?.message || 'Failed to send wink');
  }
};

/**
 * Get received winks
 * @param {Object} options - Pagination options
 * @returns {Promise} - Promise resolving to received winks
 */
export const getReceivedWinks = async (options = { page: 1, limit: 20 }) => {
  try {
    const response = await api.get('api/matches/winks/received', {
      params: {
        page: options.page,
        limit: options.limit
      }
    });
    return response.data.data;
  } catch (error) {
    console.error('Error fetching received winks:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch received winks');
  }
};

/**
 * Mark a wink as read
 * @param {String} winkId - ID of the wink to mark as read
 * @returns {Promise} - Promise resolving to success status
 */
export const markWinkAsRead = async (winkId) => {
  try {
    const response = await api.post(`api/matches/winks/${winkId}/read`);
    return response.data;
  } catch (error) {
    console.error('Error marking wink as read:', error);
    throw new Error(error.response?.data?.message || 'Failed to mark wink as read');
  }
};

/**
 * Pass on a user profile (skip)
 * @param {String} targetId - ID of the user to pass
 * @returns {Promise}
 */
export const passUser = async (targetId) => {
  try {
    const response = await api.post('api/matches/pass', { targetId });
    return response.data.data;
  } catch (error) {
    console.error('Error passing user:', error);
    throw new Error(error.response?.data?.message || 'Failed to pass user');
  }
};

/**
 * Unmatch with a user
 * @param {String} matchId - ID of the match to remove
 * @returns {Promise}
 */
export const unmatch = async (matchId) => {
  try {
    const response = await api.delete(`api/matches/${matchId}`);
    return response.data;
  } catch (error) {
    console.error('Error unmatching user:', error);
    throw new Error(error.response?.data?.message || 'Failed to unmatch user');
  }
};

/**
 * Block a user
 * @param {String} userId - ID of the user to block
 * @returns {Promise}
 */
export const blockUser = async (userId) => {
  try {
    const response = await api.post('api/matches/block', { userId });
    return response.data;
  } catch (error) {
    console.error('Error blocking user:', error);
    throw new Error(error.response?.data?.message || 'Failed to block user');
  }
};

/**
 * Report a user
 * @param {String} userId - ID of the user to report
 * @param {String} reason - Reason for reporting
 * @param {String} details - Additional details
 * @returns {Promise}
 */
export const reportUser = async (userId, reason, details = '') => {
  try {
    const response = await api.post('api/matches/report', {
      userId,
      reason,
      details
    });
    return response.data;
  } catch (error) {
    console.error('Error reporting user:', error);
    throw new Error(error.response?.data?.message || 'Failed to report user');
  }
};

/**
 * Get user statistics (profile views, likes, matches, messages)
 * @returns {Promise} - Promise resolving to user stats
 */
export const getUserStats = async () => {
  try {
    const response = await api.get('api/users/stats');
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
      responseRate: 0,
      dailyLikesRemaining: 3
    };
  }
};

// Export the service object AFTER all functions are defined
const matchService = {
  getMatches,
  getMutualMatches,
  getPotentialMatches,
  likeUser,
  sendWink,
  getReceivedWinks,
  markWinkAsRead,
  passUser,
  unmatch,
  blockUser,
  reportUser,
  getUserStats
};

export default matchService;
