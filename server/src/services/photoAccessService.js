// src/services/photoAccessService.js
const { PhotoAccess, User } = require('../models');
const { Op } = require('sequelize');

/**
 * Requests access to private photos:
 * - If a request already exists, returns it.
 * - Otherwise creates a new record with status='pending'.
 */
async function requestPhotoAccess({ ownerId, viewerId, message }) {
  // Avoid requesting your own photos
  if (ownerId === viewerId) {
    const err = new Error('Cannot request access to your own photos.');
    err.statusCode = 400;
    throw err;
  }

  // Check if owner exists
  const ownerExists = await User.findByPk(ownerId);
  if (!ownerExists) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  let record = await PhotoAccess.findOne({
    where: { ownerId, viewerId }
  });

  if (record) {
    // If already granted, just return it
    if (record.status === 'granted') {
      return record;
    }
    
    // If previously rejected, update to pending
    if (record.status === 'rejected') {
      record.status = 'pending';
      record.message = message || '';
      await record.save();
      return record;
    }
    
    // Otherwise it's pending, just return it
    return record;
  }

  // Create new request
  record = await PhotoAccess.create({
    ownerId,
    viewerId,
    status: 'pending',
    message: message || ''
  });

  return record;
}

/**
 * Grants private photo access:
 * - Updates existing record if status='pending'.
 * - Creates a new record if none exists.
 */
async function grantPhotoAccess({ ownerId, viewerId }) {
  let record = await PhotoAccess.findOne({
    where: { ownerId, viewerId }
  });

  if (!record) {
    // Create and grant directly if no request exists
    record = await PhotoAccess.create({
      ownerId,
      viewerId,
      status: 'granted',
      message: 'Access granted directly'
    });
    return record;
  }

  record.status = 'granted';
  await record.save();
  return record;
}

/**
 * Rejects private photo access.
 */
async function rejectPhotoAccess({ ownerId, viewerId }) {
  const record = await PhotoAccess.findOne({
    where: { ownerId, viewerId }
  });

  if (!record) {
    const err = new Error('No access request found to reject.');
    err.statusCode = 404;
    throw err;
  }

  record.status = 'rejected';
  await record.save();
  return record;
}

/**
 * Fetches all "pending" requests for the current owner.
 */
async function getAccessRequests(ownerId) {
  return PhotoAccess.findAll({
    where: { ownerId, status: 'pending' },
    include: [
      {
        model: User,
        as: 'viewer',
        attributes: ['id', 'firstName', 'nickname', 'avatar']
      }
    ],
    order: [['createdAt', 'DESC']]
  });
}

/**
 * Get a list of users who have access to the owner's private photos
 */
async function getAccessPermissions(ownerId) {
  return PhotoAccess.findAll({
    where: { ownerId, status: 'granted' },
    include: [
      {
        model: User,
        as: 'viewer',
        attributes: ['id', 'firstName', 'nickname', 'avatar']
      }
    ],
    order: [['updatedAt', 'DESC']]
  });
}

/**
 * Checks if viewer has been granted access to owner's private photos.
 */
async function hasAccessToPrivatePhotos(ownerId, viewerId) {
  if (ownerId === viewerId) {
    return true; // your own photos
  }

  const record = await PhotoAccess.findOne({
    where: { ownerId, viewerId, status: 'granted' }
  });

  return !!record;
}

/**
 * Revoke previously granted access
 */
async function revokePhotoAccess({ ownerId, viewerId }) {
  const record = await PhotoAccess.findOne({
    where: { ownerId, viewerId, status: 'granted' }
  });

  if (!record) {
    const err = new Error('No granted access found to revoke.');
    err.statusCode = 404;
    throw err;
  }

  await record.destroy();
  return { success: true, message: 'Access revoked successfully' };
}

module.exports = {
  requestPhotoAccess,
  grantPhotoAccess,
  rejectPhotoAccess,
  revokePhotoAccess,
  getAccessRequests,
  getAccessPermissions,
  hasAccessToPrivatePhotos
};
