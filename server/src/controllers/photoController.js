const { Photo } = require('../models');
const { catchAsync } = require('../utils/helpers');
const photoAccessService = require('../services/photoAccessService');

/**
 * Helper function to convert relative photo URLs to absolute URLs
 * @param {Object} req - Express request object
 * @param {string} photoUrl - The relative photo URL
 * @returns {string} The absolute photo URL
 */
const getFullPhotoUrl = (req, photoUrl) => {
  // If it's already a full URL (starts with http), return as is
  if (photoUrl.startsWith('http')) {
    return photoUrl;
  }

  // Otherwise, construct URL with our hostname
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const normalizedPhotoUrl = photoUrl.startsWith('/') ? photoUrl : `/${photoUrl}`;
  return `${baseUrl}${normalizedPhotoUrl}`;
};

/**
 * Transform a photo object or array to include full URLs
 * @param {Object} req - Express request object
 * @param {Object|Array} photos - Photo object or array of photo objects
 * @returns {Object|Array} Transformed photo(s) with full URLs
 */
const transformPhotoUrls = (req, photos) => {
  const transform = (photo) => {
    // If it's a Sequelize model, convert to plain object
    const photoData = photo.toJSON ? photo.toJSON() : { ...photo };
    if (photoData.url) {
      photoData.url = getFullPhotoUrl(req, photoData.url);
    }
    return photoData;
  };

  // Handle both single photo and arrays of photos
  if (Array.isArray(photos)) {
    return photos.map(photo => transform(photo));
  }

  return transform(photos);
};

/**
 * POST /photos
 * Upload a new photo
 */
exports.uploadPhoto = catchAsync(async (req, res) => {
  if (!req.file) {
    const err = new Error('No file uploaded');
    err.statusCode = 400;
    throw err;
  }

  const newPhoto = await Photo.create({
    userId: req.user.id,
    url: `/uploads/${req.file.filename}`,
    caption: req.body.caption || '',
    isPrivate: req.body.isPrivate === 'true'
  });

  // Transform the URL to absolute before sending response
  const photoWithFullUrl = transformPhotoUrls(req, newPhoto);

  res.status(201).json({
    success: true,
    data: photoWithFullUrl
  });
});

/**
 * GET /photos/:userId
 * If userId == req.user.id, show all photos (owner).
 * Otherwise, show only public or "granted" private photos.
 */
exports.getUserPhotos = catchAsync(async (req, res) => {
  const userId = req.params.userId; // Photos belong to userId
  const viewerId = req.user.id;     // The one requesting

  let photos;
  if (viewerId === userId) {
    // The owner can see all their own photos
    photos = await Photo.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']]
    });
  } else {
    // Check if viewer has access
    const canViewPrivate = await photoAccessService.hasAccessToPrivatePhotos(
      userId,
      viewerId
    );

    if (canViewPrivate) {
      // Show all photos
      photos = await Photo.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']]
      });
    } else {
      // Show only public
      photos = await Photo.findAll({
        where: { userId, isPrivate: false },
        order: [['createdAt', 'DESC']]
      });
    }
  }

  // Transform all photo URLs to absolute URLs
  const photosWithFullUrls = transformPhotoUrls(req, photos);

  res.json({ success: true, data: photosWithFullUrls });
});

/**
 * DELETE /photos/:id
 * Delete the photo if you own it.
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

/**
 * POST /photos/request-access
 * Viewer requests access to owner's private photos.
 */
exports.requestPhotoAccess = catchAsync(async (req, res) => {
  const { userId, message } = req.body;
  const viewerId = req.user.id;

  if (userId === viewerId) {
    const err = new Error('Cannot request access to your own photos');
    err.statusCode = 400;
    throw err;
  }

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

  if (!viewerId) {
    const err = new Error('Viewer ID is required');
    err.statusCode = 400;
    throw err;
  }

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

  if (!viewerId) {
    const err = new Error('Viewer ID is required');
    err.statusCode = 400;
    throw err;
  }

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

  // Transform all photo URLs to absolute URLs
  const photosWithFullUrls = transformPhotoUrls(req, photos);

  res.json({ success: true, data: photosWithFullUrls });
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

  // Transform URL to absolute before sending response
  const photoWithFullUrl = transformPhotoUrls(req, photo);

  res.json({
    success: true,
    data: photoWithFullUrl
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

  // Update the order of each photo in the database
  for (let i = 0; i < photoOrder.length; i++) {
    const photoId = photoOrder[i];
    await Photo.update(
      { order: i },
      { where: { id: photoId, userId } }
    );
  }

  res.json({
    success: true,
    message: 'Photo order updated successfully'
  });
});

/**
 * GET /photos/access-permissions
 * Get a list of users who have access to the current user's private photos
 */
exports.getPhotoAccessPermissions = catchAsync(async (req, res) => {
  const ownerId = req.user.id;

  const permissions = await photoAccessService.getAccessPermissions(ownerId);

  res.json({
    success: true,
    data: permissions
  });
});
