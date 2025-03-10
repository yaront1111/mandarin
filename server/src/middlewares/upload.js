const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Configurable upload directory and max file size (default 10 MB)
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
const maxFileSize = process.env.MAX_FILE_SIZE ? parseInt(process.env.MAX_FILE_SIZE, 10) : 10 * 1024 * 1024;

// Ensure the upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Generate a unique filename: photo-<randomHex>-<timestamp>.<ext>
    crypto.randomBytes(16, (err, buffer) => {
      if (err) return cb(err);
      const uniqueName = buffer.toString('hex') + '-' + Date.now();
      cb(null, `photo-${uniqueName}${ext}`);
    });
  }
});

const fileFilter = (req, file, cb) => {
  // Only allow specific image MIME types
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedMimes.includes(file.mimetype)) {
    return cb(new Error('Only JPEG, PNG, GIF, and WEBP images are allowed'), false);
  }
  cb(null, true);
};

module.exports = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSize
  }
});
