// src/services/photoAccessService.js
const { Photo, PhotoAccess } = require('../models');
const { NotFoundError, ForbiddenError } = require('../utils/errors');
// If you have a notification system or socket for alerts
// const notificationService = require('./notificationService');
const { Op } = require('sequelize');

exports.requestPhotoAccess = async (requesterId, photoId) => {
  const photo = await Photo.findByPk(photoId);
  if (!photo) throw new NotFoundError('Photo');

  if (!photo.isPrivate) {
    return { success: true, message: 'Photo is public, no need to request access.' };
  }

  // Check if there's an existing record
  const existing = await PhotoAccess.findOne({
    where: {
      photoId,
      grantedToId: requesterId,
      status: {
        [Op.in]: ['pending', 'approved']
      }
    }
  });
  if (existing) {
    if (existing.status === 'approved') {
      return { success: true, message: 'Already have access' };
    }
    return { success: true, message: 'Request is already pending' };
  }

  // Create request
  const accessRequest = await PhotoAccess.create({
    photoId,
    grantedToId: requesterId,
    grantedById: photo.userId,
    status: 'pending'
  });

  //Optionally notify the photo owner
  await notificationService.createNotification(
    photo.userId,
    'PHOTO_REQUEST',
    `User ${requesterId} requested access to your private photo`,
    accessRequest.id
  );

  return { success: true, data: accessRequest };
};

exports.respondToRequest = async (ownerId, accessId, approve) => {
  const access = await PhotoAccess.findByPk(accessId);
  if (!access) throw new NotFoundError('Access request not found');

  const photo = await Photo.findByPk(access.photoId);
  if (!photo || photo.userId !== ownerId) {
    throw new ForbiddenError('You are not the owner of this photo');
  }

  access.status = approve ? 'approved' : 'denied';
  if (approve) {
    // Optionally set expiration
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7); // 7 day expiry
    access.expiresAt = expiryDate;
  }
  await access.save();

  // Notify requester if you have a system
  // ...

  return { success: true, data: access };
};

exports.checkAccess = async (userId, photoId) => {
  // Photo owner always has access
  const photo = await Photo.findByPk(photoId);
  if (!photo) throw new NotFoundError('Photo');

  if (photo.userId === userId) return true;
  if (!photo.isPrivate) return true;

  // Otherwise check PhotoAccess
  const pa = await PhotoAccess.findOne({
    where: {
      photoId,
      grantedToId: userId,
      status: 'approved',
      [Op.or]: [
        { expiresAt: null },
        { expiresAt: { [Op.gt]: new Date() } }
      ]
    }
  });
  return !!pa; // Boolean
};

exports.revokeAccess = async (ownerId, accessId) => {
  const access = await PhotoAccess.findByPk(accessId);
  if (!access) throw new NotFoundError('No such access record');

  const photo = await Photo.findByPk(access.photoId);
  if (!photo || photo.userId !== ownerId) {
    throw new ForbiddenError('Not authorized to revoke');
  }

  access.status = 'revoked';
  await access.save();

  return { success: true, data: access };
};
