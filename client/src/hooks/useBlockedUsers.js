// client/src/hooks/useBlockedUsers.js
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context';
import apiService from '../services/apiService';
import { logger } from '../utils';

const log = logger.create('useBlockedUsers');

/**
 * Hook for managing and checking blocked user status
 * @returns {Object} - Blocked users utilities
 */
export const useBlockedUsers = () => {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user, isAuthenticated } = useAuth();
  
  // Helper function to load blocked users from localStorage
  const loadFromLocalStorage = useCallback(() => {
    const storedBlockedUsers = localStorage.getItem('blockedUsers');
    let blockList = [];

    if (storedBlockedUsers) {
      try {
        blockList = JSON.parse(storedBlockedUsers) || [];
        log.debug(`Loaded ${blockList.length} blocked users from localStorage`);
      } catch (parseError) {
        log.warn('Error parsing blocked users from localStorage:', parseError);
        blockList = [];
      }
    }
    
    return blockList;
  }, []);

  /**
   * Fetch the list of blocked users from the server
   */
  const fetchBlockedUsers = useCallback(async () => {
    if (!isAuthenticated || !user?._id) {
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      // Check if we already know the endpoint is missing
      const isEndpointMissing = localStorage.getItem('blocked_users_endpoint_missing') === 'true';
      
      if (isEndpointMissing) {
        // Skip API call and use localStorage directly if we know endpoint is missing
        log.debug('Skipping blocked users API call - endpoint known to be missing');
        const blockList = loadFromLocalStorage();
        setBlockedUsers(blockList);
        setLoading(false);
        return blockList;
      }

      // First try to get blocked users from the API
      try {
        log.debug('Attempting to fetch blocked users from API...');
        const response = await apiService.get("/users/blocked", {}, { 
          timeout: 5000 // Add timeout to prevent long waits
        });

        if (response && response.success && Array.isArray(response.data)) {
          // Normalize all user IDs to ensure consistent format
          const normalizedBlockList = response.data.map(id => {
            // Ensure each ID is a properly formatted MongoDB ObjectId
            if (typeof id === 'object' && id._id) {
              return id._id;
            } else if (typeof id === 'object' && id.id) {
              return id.id;
            } else {
              // Convert to string and ensure it's a valid MongoDB ObjectId format
              return String(id).replace(/^ObjectId\(['"](.+)['"]\)$/, '$1');
            }
          }).filter(id => /^[0-9a-fA-F]{24}$/.test(id));

          log.debug(`Successfully loaded ${normalizedBlockList.length} blocked users from API`);

          // Also update localStorage for future fallback
          localStorage.setItem('blockedUsers', JSON.stringify(normalizedBlockList));
          // Reset the endpoint missing flag if we successfully called it
          localStorage.removeItem('blocked_users_endpoint_missing');

          setBlockedUsers(normalizedBlockList);
          setLoading(false);
          return normalizedBlockList;
        } else {
          throw new Error('Invalid response format from API');
        }
      } catch (apiError) {
        // API call failed, fall back to localStorage
        log.warn('Failed to fetch blocked users from API, using localStorage fallback:', apiError);
        
        // Set a flag to remember that this endpoint is missing so we don't try again
        if (apiError?.response?.status === 400 || apiError?.response?.status === 404) {
          log.info('Marking blocked users endpoint as missing for future reference');
          localStorage.setItem('blocked_users_endpoint_missing', 'true');
        }

        const blockList = loadFromLocalStorage();
        setBlockedUsers(blockList);
        setLoading(false);
        return blockList;
      }
    } catch (err) {
      log.error('Error fetching blocked users:', err);
      setError('Failed to load blocked users');
      setLoading(false);
      return [];
    }
  }, [isAuthenticated, user, loadFromLocalStorage]);
  
  /**
   * Check if a specific user is blocked
   * @param {string} userId - The user ID to check
   * @returns {boolean} - True if the user is blocked
   */
  const isUserBlocked = useCallback((userId) => {
    if (!userId) return false;
    // Since we're storing just an array of user IDs in localStorage
    return blockedUsers.includes(userId);
  }, [blockedUsers]);
  
  /**
   * Apply blocked status to a list of users or conversations
   * @param {Array} items - Array of users or conversations
   * @returns {Array} - Same array with isBlocked property added
   */
  const markBlockedUsers = useCallback((items) => {
    if (!Array.isArray(items)) return items;
    
    return items.map(item => {
      // Handle conversation objects with user property
      if (item?.user?._id) {
        return {
          ...item,
          user: {
            ...item.user,
            isBlocked: isUserBlocked(item.user._id)
          }
        };
      }
      
      // Handle direct user objects
      if (item?._id) {
        return {
          ...item,
          isBlocked: isUserBlocked(item._id)
        };
      }
      
      return item;
    });
  }, [isUserBlocked]);
  
  // Load blocked users on mount or when user changes
  useEffect(() => {
    if (isAuthenticated && user?._id) {
      fetchBlockedUsers();
    }
  }, [isAuthenticated, user, fetchBlockedUsers]);
  
  return {
    blockedUsers,
    isUserBlocked,
    markBlockedUsers,
    fetchBlockedUsers,
    loading,
    error
  };
};

export default useBlockedUsers;