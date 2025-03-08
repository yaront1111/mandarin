const { Photo } = require('../models');
const { catchAsync } = require('../utils/helpers');

exports.uploadPhoto = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new Error('No file uploaded');
  }

  // For example, storing local path; for production, store the S3 link or similar
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

exports.getUserPhotos = catchAsync(async (req, res) => {
  const userId = req.params.userId;
  const photos = await Photo.findAll({ where: { userId } });
  res.json({ success: true, data: photos });
});

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
