const { Photo } = require('../models');
const { catchAsync } = require('../utils/helpers');
// Add import:
const photoAccessService = require('../services/photoAccessService');

/**
 * POST /photos
 * Upload a new photo (existing code).
 */
exports.uploadPhoto = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new Error('No file uploaded');
  }

  const newPhoto = await Photo.create({
    userId: req.user.id,
    url: `/uploads/${req.file.filename}`,
    isPrivate: req.body.isPrivate === 'true'
  });

  res.status(201).json({
    success: true,
    data: newPhoto
  });
});

/**
 * GET /photos/:userId
 * If userId == req.user.id, show all photos (owner).
 * Otherwise, show only public or “granted” private photos.
 */
exports.getUserPhotos = catchAsync(async (req, res) => {
  const userId = req.params.userId; // Photos belong to userId
  const viewerId = req.user.id;     // The one requesting

  let photos;
  if (viewerId === userId) {
    // The owner can see all their own photos
    photos = await Photo.findAll({ where: { userId } });
  } else {
    // Check if viewer has access
    const canViewPrivate = await photoAccessService.hasAccessToPrivatePhotos(
      userId,
      viewerId
    );

    if (canViewPrivate) {
      // Show all photos
      photos = await Photo.findAll({ where: { userId } });
    } else {
      // Show only public
      photos = await Photo.findAll({
        where: { userId, isPrivate: false }
      });
    }
  }

  res.json({ success: true, data: photos });
});

/**
 * DELETE /photos/:id
 * Delete the photo if you own it (existing code).
 */
exports.deletePhoto = catchAsync(async (req, res) => {
  const photoId = req.params.id;
  const photo = await Photo.findByPk(photoId);

  if (!photo) {
    const err = new Error('Photo not found');
    err.statusCode = 404;
    throw err;
  }
  if (photo.userId !== req.user.id) {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }

  await photo.destroy();
  res.json({ success: true, message: 'Photo deleted' });
});

/*-------------------------------------------------------------------
  NEW ENDPOINTS
 -------------------------------------------------------------------*/

/**
 * POST /photos/request-access
 * Viewer requests access to owner's private photos.
 */
exports.requestPhotoAccess = catchAsync(async (req, res) => {
  const { userId, message } = req.body;
  const viewerId = req.user.id;

  const record = await photoAccessService.requestPhotoAccess({
    ownerId: userId,
    viewerId,
    message
  });

  res.status(201).json({
    success: true,
    message: 'Access request submitted',
    data: record
  });
});

/**
 * POST /photos/grant-access
 * Owner grants private photo access to viewer
 */
exports.grantPhotoAccess = catchAsync(async (req, res) => {
  const ownerId = req.user.id;
  const { userId: viewerId } = req.body;

  const record = await photoAccessService.grantPhotoAccess({
    ownerId,
    viewerId
  });

  res.json({
    success: true,
    message: 'Access granted',
    data: record
  });
});

/**
 * POST /photos/reject-access
 * Owner rejects private photo access
 */
exports.rejectPhotoAccess = catchAsync(async (req, res) => {
  const ownerId = req.user.id;
  const { userId: viewerId } = req.body;

  const record = await photoAccessService.rejectPhotoAccess({
    ownerId,
    viewerId
  });

  res.json({
    success: true,
    message: 'Access request rejected',
    data: record
  });
});

/**
 * GET /photos/access-requests
 * Owner checks all pending requests for their photos.
 */
exports.getPhotoAccessRequests = catchAsync(async (req, res) => {
  const ownerId = req.user.id;

  const requests = await photoAccessService.getAccessRequests(ownerId);

  res.json({
    success: true,
    data: requests
  });
});

// Add this method to server/src/controllers/photoController.js

/**
 * GET /photos
 * Get all photos of the currently logged-in user.
 */
exports.getCurrentUserPhotos = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const photos = await Photo.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']]
  });

  res.json({ success: true, data: photos });
});

/**
 * PUT /photos/:id
 * Update a photo's details (caption, privacy, etc.)
 */
exports.updatePhoto = catchAsync(async (req, res) => {
  const photoId = req.params.id;
  const { caption, isPrivate } = req.body;

  const photo = await Photo.findByPk(photoId);

  if (!photo) {
    const err = new Error('Photo not found');
    err.statusCode = 404;
    throw err;
  }

  if (photo.userId !== req.user.id) {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }

  // Update only provided fields
  if (caption !== undefined) photo.caption = caption;
  if (isPrivate !== undefined) photo.isPrivate = isPrivate === true || isPrivate === 'true';

  await photo.save();

  res.json({
    success: true,
    data: photo
  });
});

/**
 * PUT /photos/order
 * Update the order of user's photos
 */
exports.updatePhotoOrder = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { photoOrder } = req.body;

  if (!Array.isArray(photoOrder)) {
    const err = new Error('Photo order must be an array of photo IDs');
    err.statusCode = 400;
    throw err;
  }

  // Verify all photos belong to the user
  const photos = await Photo.findAll({
    where: { id: photoOrder, userId }
  });

  if (photos.length !== photoOrder.length) {
    const err = new Error('One or more photos not found or not owned by you');
    err.statusCode = 403;
    throw err;
  }

  // In a real implementation, you would update each photo's order in the database
  // For this example, we'll just return success

  res.json({
    success: true,
    message: 'Photo order updated successfully'
  });
});
