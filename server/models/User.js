/**
 * User model - Production-ready with advanced security, validation, and performance optimizations
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import validator from 'validator';

const { Schema, model, Types, Error: MongooseError } = mongoose;
const { ObjectId } = Types;

// -----------------------------
// Helper: Safe ObjectId casting
// -----------------------------
function safeObjectId(value, fieldName) {
  if (!value) return null;
  if (value instanceof ObjectId) return value;
  if (ObjectId.isValid(value)) return new ObjectId(value);
  throw new MongooseError.CastError('ObjectId', value, fieldName);
}

// -------------------------
// Sub-schemas
// -------------------------
const photoSchema = new Schema({
  url:        { type: String, required: [true, 'Photo URL is required'] },
  isProfile:  { type: Boolean, default: false },
  privacy:    { 
    type:     String,
    enum:     ['public', 'private', 'friends_only'],
    default:  'private',
    required: true,
  },
  isDeleted:  { type: Boolean, default: false, index: true },
  uploadedAt: { type: Date, default: Date.now },
  metadata: {
    filename:    String,
    contentType: String,
    size:        Number,
    mimeType:    String,
    dimensions: {
      width:  Number,
      height: Number,
    },
  },
}, { timestamps: true });

const partnerInfoSchema = new Schema({
  nickname: String,
  gender:   { type: String, enum: ['male','female','non-binary','other'] },
  age:      { type: Number, min: [18, 'Partner must be at least 18 years old'] },
}, { _id: false });

// -------------------------
// Main User Schema
// -------------------------
const userSchema = new Schema({
  email: {
    type:      String,
    required:  [true, 'Email is required'],
    unique:    true,
    lowercase: true,
    validate:  [validator.isEmail, 'Please provide a valid email'],
    index:     true,
  },
  password: {
    type:      String,
    required:  [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select:    false,
  },
  username:        { type: String, trim: true, index: true },
  name:            { type: String, trim: true },
  nickname: {
    type:      String,
    required:  [true, 'Nickname is required'],
    trim:      true,
    minlength: [3,  'Nickname must be at least 3 characters'],
    maxlength: [30, 'Nickname cannot exceed 30 characters'],
    index:     true,
  },
  avatar:          { type: String, default: '' },
  profilePicture:  { type: String, default: '' },
  details: {
    age: {
      type: Number,
      min: [18,  'You must be at least 18 years old'],
      max: [120, 'Age cannot exceed 120'],
    },
    gender: {
      type:    String,
      enum:    { values: ['male','female','non-binary','other',''], message: 'Invalid gender' },
      default: '',
    },
    location: {
      type:      String,
      trim:      true,
      maxlength: [100, 'Location cannot exceed 100 characters'],
    },
    bio: {
      type:      String,
      trim:      true,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    interests: {
      type: [String],
      validate: {
        validator: arr => arr.length <= 10,
        message:   'Cannot have more than 10 interests',
      },
    },
    iAm: {
      type:    String,
      enum:    ['woman','man','couple',''],
      default: '',
    },
    lookingFor: {
      type:    [String],
      default: [],
      validate: {
        validator: arr => arr.length <= 3 && arr.every(i => ['women','men','couples'].includes(i)),
        message:   'Looking for must be women, men, or couples (max 3)',
      },
    },
    intoTags: {
      type: [String],
      default: [],
      validate: {
        validator: arr => arr.length <= 20,
        message:   'Cannot have more than 20 intoTags',
      },
    },
    turnOns: {
      type: [String],
      default: [],
      validate: {
        validator: arr => arr.length <= 20,
        message:   'Cannot have more than 20 turnOns',
      },
    },
    maritalStatus: {
      type:    String,
      enum:    {
        values: ['Single','Married','Divorced','Separated','Widowed','In a relationship',
                 "It's complicated",'Open relationship','Polyamorous',''],
        message: 'Invalid maritalStatus',
      },
      default: '',
    },
  },
  photos:               [photoSchema],
  isOnline:             { type: Boolean, default: false },
  lastActive:           { type: Date, default: Date.now },
  socketId:             { type: String, default: null },
  role:                 { type: String, enum: ['user','moderator','admin'], default: 'user' },
  isVerified:           { type: Boolean, default: false },
  verificationToken:    String,
  verificationTokenExpires: Date,
  passwordChangedAt:    Date,
  passwordResetToken:   String,
  passwordResetExpires: Date,
  refreshToken:         String,
  refreshTokenExpires:  Date,
  loginAttempts:        { type: Number, default: 0 },
  lockUntil:            Date,
  active:               { type: Boolean, default: true, select: false },
  version:              { type: Number, default: 1 },
  lastLoginIp:          String,
  accountTier: {
    type:    String,
    enum:    ['FREE','PAID','FEMALE','COUPLE'],
    default: 'FREE',
  },
  isPaid:               { type: Boolean, default: false },
  subscriptionExpiry:   Date,
  dailyLikesRemaining:  { type: Number, default: 3 },
  dailyLikesReset:      { type: Date, default: () => {
      const now = new Date();
      now.setHours(24,0,0,0);
      return now;
    }
  },
  lastStoryCreated:     Date,
  isCouple:             { type: Boolean, default: false },
  partnerInfo:          { type: partnerInfoSchema, default: null },
  settings: {
    notifications: {
      messages: { type: Boolean, default: true },
      calls:    { type: Boolean, default: true },
      stories:  { type: Boolean, default: true },
      likes:    { type: Boolean, default: true },
      comments: { type: Boolean, default: true },
    },
    privacy: {
      showOnlineStatus: { type: Boolean, default: true },
      showReadReceipts: { type: Boolean, default: true },
      showLastSeen:     { type: Boolean, default: true },
      allowStoryReplies: {
        type:    String,
        enum:    ['everyone','friends','none'],
        default: 'everyone',
      },
    },
    theme: {
      mode:  { type: String, enum: ['light','dark','system'], default: 'light' },
      color: { type: String, default: 'default' },
    },
  },
  blockedUsers: [{
    type: ObjectId,
    ref:  'User',
  }],
  createdByIp:         String,
  lastModifiedDate:    { type: Date, default: Date.now },
  refreshTokens: [{
    token:     { type: String, required: true },
    expiresAt: { type: Date,   required: true },
  }],
}, {
  timestamps:  true,
  toJSON:      { virtuals: true },
  toObject:    { virtuals: true },
});

// -------------------------
// Virtuals
// -------------------------
userSchema.virtual('age').get(function() {
  return this.details?.age ?? null;
});

userSchema.virtual('isSubscriptionActive').get(function() {
  return this.isPaid && this.subscriptionExpiry && this.subscriptionExpiry > new Date();
});

// -------------------------
// Indexes
// -------------------------
userSchema.index({ 'details.location': 'text', 'details.interests': 'text' });
userSchema.index({ isOnline: 1, lastActive: -1 });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ nickname: 1 });
userSchema.index({ accountTier: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastActive: -1 });
userSchema.index({ 'photos._id': 1 });
userSchema.index({ 'photos.isProfile': 1 });
userSchema.index({ 'photos.isDeleted': 1 });
userSchema.index({ 'details.age': 1, 'details.gender': 1 });

// -------------------------------------------------
// Pre-save: defaults, account tier, likes reset, cast IDs
// -------------------------------------------------
userSchema.pre('save', function(next) {
  try {
    // Username defaults
    if (!this.username) {
      this.username = this.email
        ? this.email.split('@')[0]
        : (this.nickname?.toLowerCase().replace(/\s+/g,'_') || `user_${this._id.toString().slice(-6)}`);
    }

    // Name default
    if (!this.name) {
      this.name = this.nickname || this.username;
    }

    // Profile picture fallback
    if (!this.profilePicture && this.avatar) {
      this.profilePicture = this.avatar;
    }

    // Ensure details object
    this.details = this.details || {};
    if (this.details.gender == null) {
      this.details.gender = '';
    }

    // Account tier logic
    if (this.isModified('details.gender') || this.isModified('isPaid') || this.isModified('isCouple')) {
      if (this.isCouple) {
        this.accountTier = 'COUPLE';
      } else if (this.details.gender === 'female') {
        this.accountTier = 'FEMALE';
      } else if (this.isPaid) {
        this.accountTier = 'PAID';
      } else {
        this.accountTier = 'FREE';
      }
    }

    // Daily likes reset
    const now = new Date();
    if (this.dailyLikesReset && now >= this.dailyLikesReset) {
      this.dailyLikesRemaining = this.accountTier === 'FREE' ? 3 : Infinity;
      const nextReset = new Date();
      nextReset.setHours(24,0,0,0);
      this.dailyLikesReset = nextReset;
    }

    // Update lastModifiedDate
    this.lastModifiedDate = Date.now();

    // Cast blockedUsers
    if (Array.isArray(this.blockedUsers)) {
      this.blockedUsers = this.blockedUsers.map(u => safeObjectId(u, 'blockedUsers'));
    }

    next();
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------
// Pre-save: hash password when it changes
// -------------------------------------------------
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    this.password = await bcrypt.hash(this.password, 12);
    if (!this.isNew) {
      // ensure tokens issued before password change are invalid
      this.passwordChangedAt = Date.now() - 1000;
      this.version = (this.version || 1) + 1;
    }
    next();
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------
// Pre-save: ensure only one photo is marked as profile
// -------------------------------------------------
userSchema.pre('save', function(next) {
  if (!this.isModified('photos')) return next();
  
  try {
    // Check if there are multiple photos marked as profile
    const profilePhotos = this.photos.filter(photo => photo.isProfile && !photo.isDeleted);
    
    if (profilePhotos.length > 1) {
      // Keep only the most recently modified photo as profile
      profilePhotos.sort((a, b) => b.updatedAt - a.updatedAt);
      
      // Mark only the first one as profile
      this.photos.forEach(photo => {
        if (photo.isProfile && !photo.isDeleted && photo._id.toString() !== profilePhotos[0]._id.toString()) {
          photo.isProfile = false;
        }
      });
    } else if (profilePhotos.length === 0 && this.photos.some(p => !p.isDeleted)) {
      // If no profile photo is set but there are non-deleted photos, set the most recent one as profile
      const availablePhotos = this.photos.filter(p => !p.isDeleted);
      if (availablePhotos.length > 0) {
        availablePhotos.sort((a, b) => b.uploadedAt - a.uploadedAt);
        availablePhotos[0].isProfile = true;
      }
    }
    
    next();
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------
// Pre-find: exclude inactive users by default
// -------------------------------------------------
userSchema.pre(/^find/, function(next) {
  this.where({ active: { $ne: false } });
  next();
});

// -------------------------------------------------
// Instance methods
// -------------------------------------------------
userSchema.methods.correctPassword = function(candidate, hashed) {
  return bcrypt.compare(candidate, hashed);
};

userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changed = Math.floor(this.passwordChangedAt.getTime() / 1000);
    return JWTTimestamp < changed;
  }
  return false;
};

userSchema.methods.createPasswordResetToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken   = crypto.createHash('sha256').update(token).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return token;
};

userSchema.methods.createVerificationToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.verificationToken   = crypto.createHash('sha256').update(token).digest('hex');
  this.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
  return token;
};

userSchema.methods.createRefreshToken = function() {
  const token = crypto.randomBytes(40).toString('hex');
  this.refreshToken   = crypto.createHash('sha256').update(token).digest('hex');
  this.refreshTokenExpires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  return token;
};

userSchema.methods.isLocked = function() {
  return this.lockUntil && this.lockUntil > Date.now();
};

userSchema.methods.incrementLoginAttempts = async function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    this.loginAttempts = 1;
    this.lockUntil = undefined;
  } else {
    this.loginAttempts += 1;
    if (this.loginAttempts >= 5) {
      this.lockUntil = Date.now() + 60 * 60 * 1000;
    }
  }
  await this.save();
};

userSchema.methods.canCreateStory = function() {
  if (this.accountTier === 'FREE') {
    if (!this.lastStoryCreated) return true;
    return Date.now() - this.lastStoryCreated.getTime() >= 72 * 60 * 60 * 1000;
  }
  return true;
};

userSchema.methods.canSendMessages = function() {
  return this.accountTier !== 'FREE';
};

userSchema.methods.hasBlocked = function(userId) {
  const uid = userId.toString();
  return this.blockedUsers.some(b => b.toString() === uid);
};

userSchema.methods.updatePassword = async function(newPass) {
  this.password = newPass;
  this.passwordChangedAt = Date.now();
  this.version = (this.version || 1) + 1;
  return this.save();
};

// -------------------------------------------------
// Photo Management Methods
// -------------------------------------------------
userSchema.methods.setProfilePhoto = async function(photoIdToSet) {
  console.log(`MODEL - setProfilePhoto: Attempting to set photo ${photoIdToSet} as profile`);
  console.log(`MODEL - setProfilePhoto: User has ${this.photos?.length || 0} photos`);
  console.log(`MODEL - setProfilePhoto: User ID: ${this._id}`);
  
  if (!this.photos || this.photos.length === 0) {
    console.error(`MODEL - setProfilePhoto: User has no photos`);
    throw new Error('User has no photos');
  }
  
  // Convert to string for comparison if it's an ObjectId
  const photoIdStr = photoIdToSet.toString();
  console.log(`MODEL - setProfilePhoto: Photo IDs available in user's photos array:`, this.photos.map(p => p._id.toString()));
  console.log(`MODEL - setProfilePhoto: Looking for photo ID: ${photoIdStr}, type: ${typeof photoIdToSet}`);
  
  // Detailed mongoose subdocument debugging
  console.log(`MODEL - setProfilePhoto: Are photos a proper MongooseArray? ${this.photos instanceof mongoose.Types.DocumentArray}`);
  
  // Find the photo to set as profile - try both methods
  let photoToSet = this.photos.id(photoIdToSet);
  console.log(`MODEL - setProfilePhoto: Result of this.photos.id() lookup: ${photoToSet ? 'Found' : 'Not found'}`);
  
  // If not found, try finding by string comparison
  if (!photoToSet) {
    console.log(`MODEL - setProfilePhoto: Photo not found with .id() method, trying alternative lookup`);
    photoToSet = this.photos.find(p => p._id.toString() === photoIdStr);
    console.log(`MODEL - setProfilePhoto: Result of alternative lookup: ${photoToSet ? 'Found' : 'Not found'}`);
    
    // More detailed comparison for debugging
    this.photos.forEach((photo, index) => {
      const photoId = photo._id.toString();
      console.log(`MODEL - setProfilePhoto: Comparing ${photoId} === ${photoIdStr}: ${photoId === photoIdStr}`);
    });
  }
  
  if (!photoToSet) {
    console.error(`MODEL - setProfilePhoto: Photo with ID ${photoIdToSet} not found in user's photos`);
    throw new Error(`Photo not found`);
  }
  
  if (photoToSet.isDeleted) {
    console.error(`MODEL - setProfilePhoto: Cannot set deleted photo as profile photo`);
    throw new Error('Cannot set deleted photo as profile photo');
  }
  
  // Reset all photos' isProfile flag
  this.photos.forEach(photo => {
    photo.isProfile = false;
  });
  
  // Set the selected photo as profile
  photoToSet.isProfile = true;
  
  // Update profilePicture field for backward compatibility
  this.profilePicture = photoToSet.url;
  
  console.log(`MODEL - setProfilePhoto: Successfully set photo ${photoIdToSet} as profile, saving changes`);
  return this.save();
};

userSchema.methods.softDeletePhoto = async function(photoIdToDelete) {
  // Find the photo to delete
  const photoToDelete = this.photos.id(photoIdToDelete);
  if (!photoToDelete) {
    throw new Error('Photo not found');
  }
  
  // Cannot delete a profile photo - user must set another one first
  if (photoToDelete.isProfile) {
    throw new Error('Cannot delete profile photo. Set another photo as profile first.');
  }
  
  // Mark the photo as deleted
  photoToDelete.isDeleted = true;
  
  return this.save();
};

userSchema.methods.updatePhotoPrivacy = async function(photoId, newPrivacy) {
  console.log(`MODEL - updatePhotoPrivacy: Attempting to update photo ${photoId} privacy to ${newPrivacy}`);
  console.log(`MODEL - updatePhotoPrivacy: User has ${this.photos?.length || 0} photos`);
  
  // Validate privacy value
  if (!['public', 'private', 'friends_only'].includes(newPrivacy)) {
    console.error(`MODEL - updatePhotoPrivacy: Invalid privacy value: ${newPrivacy}`);
    throw new Error('Invalid privacy setting. Must be public, private, or friends_only');
  }
  
  if (!this.photos || this.photos.length === 0) {
    console.error(`MODEL - updatePhotoPrivacy: User has no photos`);
    throw new Error('User has no photos');
  }
  
  // Convert to string for comparison if it's an ObjectId
  const photoIdStr = photoId.toString();
  console.log(`MODEL - updatePhotoPrivacy: Photo IDs available:`, this.photos.map(p => p._id.toString()));
  
  // Find the photo - try both methods
  let photo = this.photos.id(photoId);
  
  // If not found, try finding by string comparison
  if (!photo) {
    console.log(`MODEL - updatePhotoPrivacy: Photo not found with .id() method, trying alternative lookup`);
    photo = this.photos.find(p => p._id.toString() === photoIdStr);
  }
  
  if (!photo) {
    console.error(`MODEL - updatePhotoPrivacy: Photo with ID ${photoId} not found in user's photos`);
    throw new Error('Photo not found');
  }
  
  if (photo.isDeleted) {
    console.error(`MODEL - updatePhotoPrivacy: Cannot update privacy of deleted photo`);
    throw new Error('Cannot update privacy of deleted photo');
  }
  
  // Update privacy
  photo.privacy = newPrivacy;
  
  console.log(`MODEL - updatePhotoPrivacy: Successfully updated photo ${photoId} privacy to ${newPrivacy}, saving changes`);
  return this.save();
};

userSchema.methods.addPhoto = async function(photoData) {
  // Validate required fields
  if (!photoData.url) {
    throw new Error('Photo URL is required');
  }
  
  // Create new photo object
  const newPhoto = {
    url: photoData.url,
    privacy: photoData.privacy || 'private',
    uploadedAt: new Date(),
    metadata: photoData.metadata || {}
  };
  
  // Add to photos array
  this.photos.push(newPhoto);
  
  // If this is the first non-deleted photo or no profile photo exists, set it as profile
  const profilePhoto = this.photos.find(photo => photo.isProfile && !photo.isDeleted);
  if (!profilePhoto) {
    this.photos[this.photos.length - 1].isProfile = true;
    this.profilePicture = newPhoto.url; // Update profilePicture for backward compatibility
  }
  
  return this.save();
};

userSchema.methods.generatePasswordResetLink = function(baseUrl) {
  const token = this.createPasswordResetToken();
  return `${baseUrl}/reset-password?token=${token}`;
};

// -------------------------------------------------
// Static methods
// -------------------------------------------------
userSchema.statics.findByLocation = async function(loc, limit = 20) {
  try {
    return this.find({ 'details.location': { $regex: loc, $options: 'i' } })
      .select('nickname details.age details.gender details.location photos isOnline lastActive')
      .limit(limit);
  } catch (err) {
    logger.error(`findByLocation error: ${err.message}`);
    throw err;
  }
};

userSchema.statics.findByInterests = async function(interests, limit = 20) {
  try {
    const arr = Array.isArray(interests)
      ? interests
      : interests.split(',').map(i => i.trim());
    return this.find({ 'details.interests': { $in: arr } })
      .select('nickname details.age details.gender details.location details.interests photos isOnline lastActive')
      .limit(limit);
  } catch (err) {
    logger.error(`findByInterests error: ${err.message}`);
    throw err;
  }
};

userSchema.statics.findOnlineUsers = async function(limit = 20, skip = 0) {
  try {
    return this.find({ isOnline: true })
      .select('nickname details.age details.gender details.location photos isOnline lastActive')
      .sort({ lastActive: -1 })
      .skip(skip)
      .limit(limit);
  } catch (err) {
    logger.error(`findOnlineUsers error: ${err.message}`);
    throw err;
  }
};

export default model('User', userSchema);
