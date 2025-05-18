// server/utils/photoPermissions.js

import mongoose from 'mongoose';
import { PhotoPermission, User } from '../models/index.js';
import logger from '../logger.js';
import { sendPhotoPermissionResponseNotification } from '../socket/notification.js';

/**
 * Photo Permission Utility Functions
 * Server-side utilities for managing photo access permissions
 */

/**
 * Create a photo permission request
 * @param {string} photoId - The ID of the photo
 * @param {string} requestedBy - The ID of the user requesting access
 * @param {string} photoOwnerId - The ID of the photo owner
 * @param {string} message - Optional message for the request
 * @returns {Promise<object>} The created permission
 */
export async function createPhotoPermissionRequest(photoId, requestedBy, photoOwnerId, message = null) {
  try {
    // Check if permission already exists
    const existingPermission = await PhotoPermission.findOne({
      photo: photoId,
      requestedBy,
      photoOwnerId
    });

    if (existingPermission) {
      if (existingPermission.status === 'pending') {
        return existingPermission;
      } else if (existingPermission.status === 'approved' && !existingPermission.hasExpired()) {
        throw new Error('Access already granted');
      } else if (existingPermission.status === 'rejected') {
        // Update existing rejected permission to pending
        existingPermission.status = 'pending';
        existingPermission.message = message;
        existingPermission.createdAt = new Date();
        return await existingPermission.save();
      }
    }

    // Create new permission request
    const permission = new PhotoPermission({
      photo: photoId,
      requestedBy,
      photoOwnerId,
      message,
      status: 'pending'
    });

    return await permission.save();
  } catch (error) {
    logger.error(`Error creating photo permission request: ${error.message}`);
    throw error;
  }
}

/**
 * Approve photo permission requests from a specific user
 * @param {string} ownerId - The ID of the photo owner
 * @param {string} requesterId - The ID of the requester
 * @param {number} expiryDays - Days until permission expires (default 30)
 * @returns {Promise<object>} Result with approved count
 */
export async function approveUserPhotoRequests(ownerId, requesterId, expiryDays = 30) {
  try {
    const permissions = await PhotoPermission.find({
      photoOwnerId: ownerId,
      requestedBy: requesterId,
      status: 'pending'
    });

    if (permissions.length === 0) {
      return { success: true, approvedCount: 0, message: 'No pending requests found' };
    }

    // Approve all pending permissions
    for (const permission of permissions) {
      await permission.approve(expiryDays);
    }

    return {
      success: true,
      approvedCount: permissions.length,
      permissions,
      message: `Approved ${permissions.length} photo access requests`
    };
  } catch (error) {
    logger.error(`Error approving photo requests: ${error.message}`);
    throw error;
  }
}

/**
 * Reject photo permission requests from a specific user
 * @param {string} ownerId - The ID of the photo owner
 * @param {string} requesterId - The ID of the requester
 * @param {string} reason - Optional reason for rejection
 * @returns {Promise<object>} Result with rejected count
 */
export async function rejectUserPhotoRequests(ownerId, requesterId, reason = null) {
  try {
    const permissions = await PhotoPermission.find({
      photoOwnerId: ownerId,
      requestedBy: requesterId,
      status: 'pending'
    });

    if (permissions.length === 0) {
      return { success: true, rejectedCount: 0, message: 'No pending requests found' };
    }

    // Reject all pending permissions
    for (const permission of permissions) {
      await permission.reject(reason);
    }

    return {
      success: true,
      rejectedCount: permissions.length,
      permissions,
      message: `Rejected ${permissions.length} photo access requests`
    };
  } catch (error) {
    logger.error(`Error rejecting photo requests: ${error.message}`);
    throw error;
  }
}

/**
 * Grant direct photo access to a user for all private photos
 * @param {string} ownerId - The ID of the photo owner
 * @param {string} granteeId - The ID of the user to grant access to
 * @param {string} message - Optional message for the grant
 * @returns {Promise<object>} Result with granted permissions
 */
export async function grantFullPhotoAccess(ownerId, granteeId, message = 'Access granted by photo owner') {
  try {
    // Validate inputs
    if (!ownerId || !granteeId) {
      throw new Error('Owner ID and grantee ID are required');
    }
    
    // Get owner's private photos
    const owner = await User.findById(ownerId).select('photos');
    if (!owner) {
      throw new Error('Owner not found');
    }

    const privatePhotos = owner.photos.filter(photo => 
      photo.privacy === 'private' && !photo.isDeleted
    );

    if (privatePhotos.length === 0) {
      return {
        success: true,
        grantedCount: 0,
        message: 'No private photos to grant access to'
      };
    }

    const permissions = [];
    let existingCount = 0;

    // Create or update permissions for each private photo
    for (const photo of privatePhotos) {
      const existingPermission = await PhotoPermission.findOne({
        photo: photo._id,
        requestedBy: granteeId,
        photoOwnerId: ownerId
      });

      if (existingPermission) {
        if (existingPermission.status !== 'approved') {
          await existingPermission.approve();
          permissions.push(existingPermission);
        } else {
          existingCount++;
        }
      } else {
        const newPermission = new PhotoPermission({
          photo: photo._id,
          requestedBy: granteeId,
          photoOwnerId: ownerId,
          message,
          status: 'approved',
          respondedAt: new Date()
        });
        await newPermission.save();
        permissions.push(newPermission);
      }
    }

    // Set expiry date for new permissions
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);
    for (const permission of permissions) {
      permission.expiresAt = expiry;
      await permission.save();
    }

    return {
      success: true,
      grantedCount: permissions.length,
      existingAccessCount: existingCount,
      totalPrivatePhotos: privatePhotos.length,
      permissions,
      userHasAccess: existingCount > 0 || permissions.length > 0,
      message: permissions.length > 0 
        ? `Granted access to ${permissions.length} private photos`
        : existingCount > 0
          ? `User already has access to all ${privatePhotos.length} private photos`
          : 'No private photos to grant access to'
    };
  } catch (error) {
    logger.error(`Error granting full photo access: ${error.message}`);
    throw error;
  }
}

/**
 * Revoke photo access from a user
 * @param {string} ownerId - The ID of the photo owner
 * @param {string} userId - The ID of the user to revoke access from
 * @returns {Promise<object>} Result with revoked count
 */
export async function revokePhotoAccess(ownerId, userId) {
  try {
    // Find all approved permissions
    const permissions = await PhotoPermission.find({
      photoOwnerId: ownerId,
      requestedBy: userId,
      status: 'approved'
    });

    if (permissions.length === 0) {
      return {
        success: true,
        revokedCount: 0,
        message: 'No active permissions found'
      };
    }

    // Revoke all permissions by setting status to rejected
    for (const permission of permissions) {
      permission.status = 'rejected';
      permission.respondedAt = new Date();
      permission.expiresAt = null;
      permission.message = 'Access revoked by photo owner';
      await permission.save();
    }

    return {
      success: true,
      revokedCount: permissions.length,
      message: `Revoked access to ${permissions.length} photos`
    };
  } catch (error) {
    logger.error(`Error revoking photo access: ${error.message}`);
    throw error;
  }
}

/**
 * Check user's photo access status
 * @param {string} viewerId - The ID of the viewer
 * @param {string} ownerId - The ID of the photo owner
 * @returns {Promise<object>} Access status information
 */
export async function checkPhotoAccess(viewerId, ownerId) {
  try {
    const owner = await User.findById(ownerId).select('photos');
    if (!owner) {
      return { hasAccess: false, error: 'Owner not found' };
    }

    const privatePhotos = owner.photos.filter(p => p.privacy === 'private' && !p.isDeleted);
    
    if (privatePhotos.length === 0) {
      return { hasAccess: true, reason: 'No private photos' };
    }

    const permissions = await PhotoPermission.find({
      photo: { $in: privatePhotos.map(p => p._id) },
      requestedBy: viewerId,
      status: 'approved'
    });

    const approvedPhotoIds = permissions.map(p => p.photo.toString());
    const approvedCount = approvedPhotoIds.length;
    const totalPrivate = privatePhotos.length;

    return {
      hasAccess: approvedCount === totalPrivate,
      partial: approvedCount > 0 && approvedCount < totalPrivate,
      none: approvedCount === 0,
      approvedCount,
      totalPrivate,
      approvedPhotoIds
    };
  } catch (error) {
    logger.error(`Error checking photo access: ${error.message}`);
    return { hasAccess: false, error: error.message };
  }
}

/**
 * Get pending photo permission counts by requester
 * @param {string} ownerId - The ID of the photo owner
 * @returns {Promise<object>} Map of requester IDs to pending counts
 */
export async function getPendingPhotoRequestCounts(ownerId) {
  try {
    const pendingRequests = await PhotoPermission.find({
      photoOwnerId: ownerId,
      status: 'pending'
    }).select('requestedBy photo');

    // Group by requester
    const counts = {};
    for (const request of pendingRequests) {
      const requesterId = request.requestedBy.toString();
      counts[requesterId] = (counts[requesterId] || 0) + 1;
    }

    return counts;
  } catch (error) {
    logger.error(`Error getting pending request counts: ${error.message}`);
    return {};
  }
}

/**
 * Clean up expired photo permissions
 * @returns {Promise<number>} Number of permissions cleaned up
 */
export async function cleanupExpiredPermissions() {
  try {
    const expiredPermissions = await PhotoPermission.find({
      status: 'approved',
      expiresAt: { $lt: new Date() }
    });

    let cleanedCount = 0;
    for (const permission of expiredPermissions) {
      permission.status = 'expired';
      await permission.save();
      cleanedCount++;
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired photo permissions`);
    }

    return cleanedCount;
  } catch (error) {
    logger.error(`Error cleaning up expired permissions: ${error.message}`);
    return 0;
  }
}

export default {
  createPhotoPermissionRequest,
  approveUserPhotoRequests,
  rejectUserPhotoRequests,
  grantFullPhotoAccess,
  revokePhotoAccess,
  checkPhotoAccess,
  getPendingPhotoRequestCounts,
  cleanupExpiredPermissions
};