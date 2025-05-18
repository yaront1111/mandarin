// client/src/utils/photoPermissions.js

import { toast } from 'react-toastify';
import apiService from '../services/apiService';
import permissionClient from '../services/PermissionClient';
import logger from './logger';

const log = logger.create('PhotoPermissions');

/**
 * Photo Permission Utility Functions
 * Handles photo access requests, approvals, and management
 */

/**
 * Request access to a private photo
 * @param {string} ownerId - The ID of the photo owner
 * @param {string} photoId - The ID of the photo
 * @returns {Promise<object>} The permission request response
 */
export async function requestPhotoAccess(ownerId, photoId) {
  try {
    
    // Use the permission client for socket-based requests
    const response = await permissionClient.requestPhotoPermission(ownerId, photoId);
    
    toast.success('Photo access request sent');
    return response;
  } catch (error) {
    log.error('Failed to request photo access:', error);
    toast.error('Failed to send photo access request');
    throw error;
  }
}

/**
 * Approve multiple photo requests from a specific user
 * @param {string} userId - The ID of the user whose requests to approve
 * @returns {Promise<object>} The approval response
 */
export async function approvePhotoRequests(userId) {
  try {
    
    const response = await apiService.put(`/users/respond-photo-access/${userId}`, {
      status: 'approved'
    });
    
    if (response.success) {
      toast.success(`Approved ${response.updatedCount} photo access requests`);
    }
    
    return response;
  } catch (error) {
    log.error('Failed to approve photo requests:', error);
    toast.error('Failed to approve photo access requests');
    throw error;
  }
}

/**
 * Reject multiple photo requests from a specific user
 * @param {string} userId - The ID of the user whose requests to reject
 * @param {string} reason - Optional reason for rejection
 * @returns {Promise<object>} The rejection response
 */
export async function rejectPhotoRequests(userId, reason) {
  try {
    
    const response = await apiService.put(`/users/respond-photo-access/${userId}`, {
      status: 'rejected',
      message: reason
    });
    
    if (response.success) {
      toast.success(`Rejected ${response.updatedCount} photo access requests`);
    }
    
    return response;
  } catch (error) {
    log.error('Failed to reject photo requests:', error);
    toast.error('Failed to reject photo access requests');
    throw error;
  }
}

/**
 * Grant photo access to a user (without a specific request)
 * @param {string} userId - The ID of the user to grant access to
 * @param {string} message - Optional message for the grant
 * @returns {Promise<object>} The grant response
 */
export async function grantPhotoAccess(userId, message) {
  try {
    
    const response = await apiService.post(`/users/grant-photo-access/${userId}`, {
      message: message || 'Photo access granted'
    });
    
    if (response.success) {
      const grantedCount = response.data?.grantedCount || response.grantedCount || 0;
      if (grantedCount === 0) {
        // User already has access
        if (response.totalPrivatePhotos && response.message?.includes('already has access to all')) {
          toast.info(`User already has access to all ${response.totalPrivatePhotos} of your private photos`);
        } else if (response.existingAccessCount && response.totalPrivatePhotos) {
          toast.info(`User already has access to ${response.existingAccessCount} of your ${response.totalPrivatePhotos} private photos`);
        } else {
          toast.info(response.message || 'Photo access already granted');
        }
      } else {
        toast.success(`Granted access to ${grantedCount} private photos`);
      }
    }
    
    return response;
  } catch (error) {
    log.error('Failed to grant photo access:', error.response?.data || error);
    const errorMessage = error.response?.data?.error || error.message || 'Failed to grant photo access';
    toast.error(errorMessage);
    throw error;
  }
}

/**
 * Revoke photo access from a user
 * @param {string} userId - The ID of the user to revoke access from
 * @returns {Promise<object>} The revoke response
 */
export async function revokePhotoAccess(userId) {
  try {
    
    const response = await apiService.delete(`/users/revoke-photo-access/${userId}`);
    
    if (response.success) {
      toast.success(response.message || 'Photo access revoked');
    }
    
    return response;
  } catch (error) {
    log.error('Failed to revoke photo access:', error.response?.data || error);
    const errorMessage = error.response?.data?.error || error.message || 'Failed to revoke photo access';
    toast.error(errorMessage);
    throw error;
  }
}

/**
 * Get pending photo permission requests count
 * @returns {Promise<number>} The count of pending requests
 */
export async function getPendingRequestsCount() {
  try {
    const response = await apiService.get('/users/photos/permissions/pending/count');
    return response.pendingCount || 0;
  } catch (error) {
    log.error('Failed to get pending requests count:', error);
    return 0;
  }
}

/**
 * Check if user has photo access
 * @param {object} user - The user object to check
 * @returns {boolean} Whether the user has photo access
 */
export function hasPhotoAccess(user) {
  return user?.photoAccess === true || user?.photoAccess?.approved === true;
}

/**
 * Get photo access status from conversation
 * @param {object} conversation - The conversation object
 * @returns {object} Photo access status info
 */
export function getPhotoAccessStatus(conversation) {
  const user = conversation?.user;
  const pendingRequests = conversation?.pendingPhotoRequests || 0;
  const hasAccess = hasPhotoAccess(user);
  
  return {
    hasAccess,
    pendingRequests,
    canGrant: true, // Always allow attempting to grant
    canRevoke: true, // Always allow attempting to revoke
    isRestricted: !hasAccess && user?.photos?.some(p => p.privacy === 'private')
  };
}

/**
 * Handle photo access toggle (grant or revoke)
 * @param {object} conversation - The conversation object
 * @param {object} currentUser - The current user object
 * @returns {Promise<object>} The updated conversation data
 */
export async function togglePhotoAccess(conversation, currentUser) {
  const userId = conversation?.user?._id;
  const status = getPhotoAccessStatus(conversation);
  
  try {
    if (conversation?.pendingPhotoRequests > 0) {
      // Approve pending requests
      return await approvePhotoRequests(userId);
    } else if (status.hasAccess) {
      // Revoke access
      return await revokePhotoAccess(userId);
    } else {
      // Grant access
      const message = `${currentUser.nickname || 'User'} has granted you access to their private photos`;
      return await grantPhotoAccess(userId, message);
    }
  } catch (error) {
    log.error('Failed to toggle photo access:', error);
    throw error;
  }
}

export default {
  requestPhotoAccess,
  approvePhotoRequests,
  rejectPhotoRequests,
  grantPhotoAccess,
  revokePhotoAccess,
  getPendingRequestsCount,
  hasPhotoAccess,
  getPhotoAccessStatus,
  togglePhotoAccess
};