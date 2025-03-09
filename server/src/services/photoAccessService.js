const { PhotoAccess } = require('../models');

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

  let record = await PhotoAccess.findOne({
    where: { ownerId, viewerId }
  });

  if (record) {
    return record; // Either pending, granted, or rejected
  }

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
 * - Throws error if not found or already processed.
 */
async function grantPhotoAccess({ ownerId, viewerId }) {
  const record = await PhotoAccess.findOne({
    where: { ownerId, viewerId, status: 'pending' }
  });

  if (!record) {
    const err = new Error('No pending request found to grant.');
    err.statusCode = 404;
    throw err;
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
    where: { ownerId, viewerId, status: 'pending' }
  });

  if (!record) {
    const err = new Error('No pending request found to reject.');
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
    // If you want to include the requesting user's data, do:
    // include: [{ model: User, as: 'viewer' }]
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

module.exports = {
  requestPhotoAccess,
  grantPhotoAccess,
  rejectPhotoAccess,
  getAccessRequests,
  hasAccessToPrivatePhotos
};
