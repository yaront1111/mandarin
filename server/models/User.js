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
  isPrivate:  { type: Boolean, default: false },
  metadata: {
    contentType: String,
    size:        Number,
    dimensions: {
      width:  Number,
      height: Number,
    },
  },
}, { timestamps: true, id: false });

const partnerInfoSchema = new Schema({
  nickname: String,
  gender:   { type: String, enum: ['male','female','non-binary','other'] },
  age:      { type: Number, min: [18, 'Partner must be at least 18 years old'] },
}, { id: false });

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
userSchema.index({ email: 1, nickname: 1 });
userSchema.index({ accountTier: 1 });
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
        : (this.nickname?.toLowerCase().replace(/\s+/g,'_') || `user_${this.id.toString().slice(-6)}`);
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
