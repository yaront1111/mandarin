// server/middleware/upload.js
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileTypeFromBuffer } from "file-type";
import config from "../config.js";
import logger from "../logger.js";

// Base upload directory (configurable via FILE_UPLOAD_PATH, default "uploads")
const BASE_UPLOAD_DIR = path.resolve(process.cwd(), config.FILE_UPLOAD_PATH || "uploads");

// Named subdirectories for organization
const DIRECTORIES = {
  images: path.join(BASE_UPLOAD_DIR, "images"),
  photos: path.join(BASE_UPLOAD_DIR, "photos"),
  videos: path.join(BASE_UPLOAD_DIR, "videos"),
  messages: path.join(BASE_UPLOAD_DIR, "messages"),
  profiles: path.join(BASE_UPLOAD_DIR, "profiles"),
  stories: path.join(BASE_UPLOAD_DIR, "stories"),
  temp: path.join(BASE_UPLOAD_DIR, "temp"),
  deleted: path.join(BASE_UPLOAD_DIR, "deleted"),
};

// Ensure base + all subdirectories exist
[BASE_UPLOAD_DIR, ...Object.values(DIRECTORIES)].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Created upload directory: ${dir}`);
  }
});

/**
 * Generate a secure, unique filename from the original name.
 */
const generateSecureFilename = (originalname) => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString("hex");
  const ext = path.extname(originalname).toLowerCase();
  const base = path
    .basename(originalname, ext)
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase();
  return `${timestamp}-${random}-${base}${ext}`;
};

/**
 * Determine which subdirectory to use for a given request & file.
 */
const getUploadDirectory = (req, file) => {
  const url = (req.originalUrl || "").toLowerCase();

  // Route-based overrides
  if (url.includes("/stories") || file.fieldname === "media") {
    return DIRECTORIES.stories;
  }
  if (url.includes("/profiles") || url.includes("/avatar")) {
    return DIRECTORIES.profiles;
  }
  if (url.includes("/messages")) {
    return DIRECTORIES.messages;
  }
  if (url.includes("/photos")) {
    return DIRECTORIES.photos;
  }
  if (url.includes("/videos") || file.mimetype.startsWith("video/")) {
    return DIRECTORIES.videos;
  }
  if (file.mimetype.startsWith("image/")) {
    return DIRECTORIES.images;
  }

  // Fallback
  return DIRECTORIES.temp;
};

/**
 * Multer storage engine: saves to dynamically chosen directory with secure filenames.
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const uploadPath = getUploadDirectory(req, file);
      fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (err) {
      logger.error(`upload.destination error: ${err.message}`);
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    try {
      const name = generateSecureFilename(file.originalname);
      cb(null, name);
    } catch (err) {
      logger.error(`upload.filename error: ${err.message}`);
      cb(err);
    }
  },
});

/**
 * First‑pass file filter: checks MIME type and extension.
 */
const fileFilter = (req, file, cb) => {
  const allowed = {
    images: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    videos: ["video/mp4", "video/quicktime", "video/webm"],
    docs: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  };

  const isImage = allowed.images.includes(file.mimetype);
  const isVideo = allowed.videos.includes(file.mimetype);
  const isDoc = allowed.docs.includes(file.mimetype);

  if (!isImage && !isVideo && !isDoc) {
    logger.warn(`Rejected upload: unsupported MIME ${file.mimetype}`);
    return cb(new Error("Only images, videos, or PDFs/DOCs are allowed"), false);
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const validExts = [
    ...[".jpg", ".jpeg", ".png", ".gif", ".webp"],
    ...[".mp4", ".mov", ".webm"],
    ...[".pdf", ".doc", ".docx"],
  ];
  if (!validExts.includes(ext)) {
    logger.warn(`Rejected upload: bad extension ${ext}`);
    return cb(new Error("File extension does not match its MIME type"), false);
  }

  cb(null, true);
};

/**
 * After multer saves the file, verify actual contents match declared type.
 */
const validateFileContents = async (file) => {
  try {
    const buffer = fs.readFileSync(file.path);
    const type = await fileTypeFromBuffer(buffer);
    if (!type) {
      logger.warn(`validateFileContents: could not determine type for ${file.originalname}`);
      return false;
    }
    // JPEG edge-case: allow both image/jpg & image/jpeg
    const mimeMatch =
      file.mimetype === type.mime ||
      (file.mimetype.startsWith("image/jp") && type.mime === "image/jpeg");
    if (!mimeMatch) {
      logger.warn(`validateFileContents: mismatch (${file.mimetype} vs ${type.mime})`);
      return false;
    }
    return true;
  } catch (err) {
    logger.error(`validateFileContents error: ${err.message}`);
    return false;
  }
};

/**
 * When a file fails validation, move it to the "deleted" folder (soft delete).
 */
const softDeleteFile = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return false;
    const name = path.basename(filePath);
    const dest = path.join(
      DIRECTORIES.deleted,
      `${Date.now()}-${name}`
    );
    fs.renameSync(filePath, dest);
    logger.info(`Soft-deleted invalid file: ${filePath} → ${dest}`);
    return true;
  } catch (err) {
    logger.error(`softDeleteFile error: ${err.message}`);
    return false;
  }
};

/**
 * Express middleware to run deep validation and clean up invalid files.
 */
const validateUpload = async (req, res, next) => {
  if (!req.file) return next();

  const ok = await validateFileContents(req.file);
  if (!ok) {
    softDeleteFile(req.file.path);
    return res.status(400).json({
      success: false,
      error: "Uploaded file appears corrupted or its contents don’t match its type.",
    });
  }

  // Attach a public URL for convenience
  const sub = path.basename(path.dirname(req.file.path));
  req.file.url = `/uploads/${sub}/${req.file.filename}`;
  logger.debug(`Upload validated, URL set to ${req.file.url}`);

  next();
};

// Core multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.MAX_FILE_SIZE || 10 * 1024 * 1024,
    files: 1,
  },
});

/**
 * Factory: single‑file upload + post‑validation
 */
const makeUploader = (fieldName) => [upload.single(fieldName), validateUpload];

// Export pre‑configured middlewares
export const uploadImage = makeUploader("image");
export const uploadVideo = makeUploader("video");
export const uploadFile = makeUploader("file");
export const uploadProfilePicture = makeUploader("profilePicture");
export const uploadPhoto = makeUploader("photo");
export const uploadStory = makeUploader("media");

// Export utilities if you need them elsewhere
export { softDeleteFile, DIRECTORIES };

// Default export for custom setups
export default upload;
