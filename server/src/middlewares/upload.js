const multer = require('multer');
const path = require('path');

// Example local storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Make sure this folder exists
  },
  filename: (req, file, cb) => {
    // e.g. photo-USERID-timestamp.ext
    const ext = path.extname(file.originalname);
    cb(null, `photo-${Date.now()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only images are allowed'), false);
  }
  cb(null, true);
};

module.exports = multer({ storage, fileFilter });
