// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../logger');

// Photo Schema (sub-document)
const PhotoSchema = new mongoose.Schema({
  url: {
    type: String,
    required: [true, 'Photo URL is required'],
    trim: true
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0  // 0 is default for profile photo
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  metadata: {
    contentType: String,
    size: Number, // in bytes
    dimensions: {
      width: Number,
      height: Number
    }
  }
}, { _id: true });

// Settings Schema (sub-document)
const SettingsSchema = new mongoose.Schema({
  notifications: {
    email: {
      enabled: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false },
      messages: { type: Boolean, default: true },
      matches: { type: Boolean, default: true }
    },
    push: {
      enabled: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      matches: { type: Boolean, default: true },
      likes: { type: Boolean, default: true }
    }
  },
  privacy: {
    profileVisibility: {
      type: String,
      enum: ['public', 'matches', 'private'],
      default: 'public'
    },
    showDistance: { type: Boolean, default: true },
    showLastActive: { type: Boolean, default: true }
  },
  account: {
    hideProfile: { type: Boolean, default: false },
    deactivated: { type: Boolean, default: false },
    deactivatedReason: { type: String },
    deactivatedAt: { type: Date }
  },
  preferences: {
    ageMin: { type: Number, default: 18 },
    ageMax: { type: Number, default: 99 },
    distance: { type: Number, default: 100 }, // km
    interestedIn: {
      type: [String],
      enum: ['Male', 'Female', 'Other'],
      default: ['Male', 'Female', 'Other']
    }
  }
});

// User Schema
const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      'Please provide a valid email'
    ],
    index: true
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    maxlength: [100, 'Password cannot exceed 100 characters'],
    select: false
  },
  nickname: {
    type: String,
    required: [true, 'Please add a nickname'],
    unique: true,
    trim: true,
    minlength: [3, 'Nickname must be at least 3 characters'],
    maxlength: [50, 'Nickname cannot be more than 50 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Nickname can only contain letters, numbers, and underscores'],
    index: true
  },
  details: {
    age: {
      type: Number,
      min: [18, 'Age must be at least 18'],
      max: [120, 'Age cannot exceed 120'],
      required: [true, 'Age is required'],
      index: true
    },
    gender: {
      type: String,
      enum: {
        values: ['Male', 'Female', 'Other'],
        message: 'Gender must be Male, Female, or Other'
      },
      required: [true, 'Gender is required'],
      index: true
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
      maxlength: [100, 'Location cannot exceed 100 characters'],
      index: true
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point']
      },
      coordinates: {
        type: [Number],
        validate: {
          validator: function(v) {
            return v.length === 2 &&
              v[0] >= -180 && v[0] <= 180 &&
              v[1] >= -90 && v[1] <= 90;
          },
          message: "Coordinates must be valid [longitude, latitude] pairs"
        }
      }
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, 'Bio cannot be more than 500 characters']
    },
    interests: {
      type: [String],
      validate: {
        validator: function(v) {
          return Array.isArray(v) && v.length <= 10;
        },
        message: "Cannot have more than 10 interests"
      },
      default: []
    },
    lookingFor: {
      type: [String],
      validate: {
        validator: function(v) {
          return Array.isArray(v) && v.length <= 5;
        },
        message: "Cannot have more than 5 relationship goals"
      },
      default: []
    },
    socialLinks: {
      instagram: {
        type: String,
        trim: true,
        match: [/^[a-zA-Z0-9_.]+$/, 'Invalid Instagram username']
      },
      facebook: {
        type: String,
        trim: true
      },
      twitter: {
        type: String,
        trim: true,
        match: [/^[a-zA-Z0-9_]+$/, 'Invalid Twitter username']
      }
    }
  },
  photos: [PhotoSchema],
  isOnline: {
    type: Boolean,
    default: false,
    index: true
  },
  lastActive: {
    type: Date,
    default: Date.now,
    index: true
  },
  role: {
    type: String,
    enum: ['user', 'premium', 'admin', 'moderator'],
    default: 'user'
  },
  settings: {
    type: SettingsSchema,
    default: () => ({})
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  verification: {
    emailToken: String,
    emailTokenExpire: Date,
    profileVerified: {
      type: Boolean,
      default: false
    },
    profileVerificationSubmitted: {
      type: Boolean,
      default: false
    }
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  refreshToken: String,
  blocked: {
    users: [{
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }],
    blockedBy: [{
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }]
  },
  reports: [{
    reportedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: ['inappropriate', 'spam', 'harassment', 'fake', 'other'],
      required: true
    },
    details: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
      default: 'pending'
    }
  }],
  stats: {
    profileViews: {
      type: Number,
      default: 0
    },
    likesReceived: {
      type: Number,
      default: 0
    },
    likesSent: {
      type: Number,
      default: 0
    },
    matches: {
      type: Number,
      default: 0
    },
    messagesSent: {
      type: Number,
      default: 0
    },
    messagesReceived: {
      type: Number,
      default: 0
    },
    lastProfileUpdate: {
      type: Date,
      default: Date.now
    }
  },
  lastLogin: {
    time: Date,
    ip: String,
    userAgent: String
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  accountLocked: {
    type: Boolean,
    default: false
  },
  accountLockedUntil: Date,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create indexes for efficient querying
UserSchema.index({ 'details.age': 1, 'details.gender': 1 }); // For matching
UserSchema.index({ 'details.coordinates': '2dsphere' }); // For geo queries
UserSchema.index({ email: 1, nickname: 1 }, { unique: true }); // Compound index for unique fields
UserSchema.index({ 'stats.profileViews': -1 }); // For popular profiles
UserSchema.index({ isOnline: 1, lastActive: -1 }); // For active user filtering

// Add virtual property for profile completion percentage
UserSchema.virtual('profileCompletionPercentage').get(function() {
  let totalFields = 8; // Count of essential profile fields
  let completedFields = 0;

  if (this.details) {
    if (this.details.age) completedFields++;
    if (this.details.gender) completedFields++;
    if (this.details.location) completedFields++;
    if (this.details.bio && this.details.bio.length > 10) completedFields++;
    if (this.details.interests && this.details.interests.length > 0) completedFields++;
    if (this.details.lookingFor && this.details.lookingFor.length > 0) completedFields++;
  }

  if (this.photos && this.photos.length > 0) completedFields++;
  if (this.emailVerified) completedFields++;

  return Math.round((completedFields / totalFields) * 100);
});

// Virtual for profile photo url
UserSchema.virtual('profilePhotoUrl').get(function() {
  if (this.photos && this.photos.length > 0) {
    // Find the photo with order 0 (profile photo) or fallback to first photo
    const profilePhoto = this.photos.find(p => p.order === 0) || this.photos[0];
    return profilePhoto.url;
  }
  return null;
});

// Check if user has photo permissions
UserSchema.methods.hasPhotoPermission = function(photoId, userId) {
  const photo = this.photos.id(photoId);
  if (!photo) return false;
  if (!photo.isPrivate) return true;

  // Check permissions collection (this would ideally use a virtual or populate)
  // This is a placeholder - you would implement the actual permission check based on your data structure
  return false;
};

// Encrypt password using bcrypt
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    logger.error(`Error hashing password: ${err.message}`);
    next(err);
  }
});

// Update lastProfileUpdate timestamp when profile details change
UserSchema.pre('save', function(next) {
  if (this.isModified('details') || this.isModified('photos')) {
    this.stats.lastProfileUpdate = Date.now();
  }
  next();
});

// Generate and sign JWT token
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    {
      id: this._id,
      role: this.role,
      version: this.updatedAt // Include update timestamp for token invalidation
    },
    config.JWT_SECRET,
    {
      expiresIn: config.JWT_EXPIRE
    }
  );
};

// Generate refresh token
UserSchema.methods.generateRefreshToken = function() {
  // Create refresh token with longer expiry
  const refreshToken = crypto.randomBytes(20).toString('hex');

  // Save hashed version of refresh token
  this.refreshToken = crypto
    .createHash('sha256')
    .update(refreshToken)
    .digest('hex');

  return refreshToken;
};

// Match password
UserSchema.methods.matchPassword = async function(enteredPassword) {
  try {
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (err) {
    logger.error(`Error comparing passwords: ${err.message}`);
    return false;
  }
};

// Generate email verification token
UserSchema.methods.generateEmailVerificationToken = function() {
  // Generate token
  const verificationToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to emailToken field
  this.verification.emailToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  // Set expiry
  this.verification.emailTokenExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  return verificationToken;
};

// Generate password reset token
UserSchema.methods.generatePasswordResetToken = function() {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expiry
  this.resetPasswordExpire = Date.now() + 1 * 60 * 60 * 1000; // 1 hour

  return resetToken;
};

// Check if user has completed profile
UserSchema.methods.hasCompletedProfile = function() {
  return this.profileCompletionPercentage >= 80;
};

// Check if user has been inactive for a specified period
UserSchema.methods.isInactiveSince = function(days) {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);
  return this.lastActive < threshold;
};

// Method to safely return user data without sensitive fields
UserSchema.methods.getSafeInfo = function() {
  const userObject = this.toObject();

  // Remove sensitive data
  delete userObject.password;
  delete userObject.resetPasswordToken;
  delete userObject.resetPasswordExpire;
  delete userObject.refreshToken;
  delete userObject.verification;
  delete userObject.failedLoginAttempts;

  // Remove private settings for other users
  if (!this._isSelfView) {
    delete userObject.settings;
    delete userObject.email;
    delete userObject.stats;
    delete userObject.blocked;
    delete userObject.reports;

    // Remove private photos
    if (userObject.photos) {
      userObject.photos = userObject.photos.filter(photo => !photo.isPrivate);
    }
  }

  return userObject;
};

// Method to check if user is blocked by another user
UserSchema.methods.isBlockedBy = function(userId) {
  return this.blocked.blockedBy.some(id => id.toString() === userId.toString());
};

// Method to check if user has blocked another user
UserSchema.methods.hasBlocked = function(userId) {
  return this.blocked.users.some(id => id.toString() === userId.toString());
};

// Track login attempt
UserSchema.methods.trackLoginAttempt = async function(success, ip, userAgent) {
  if (success) {
    // Reset failed attempts on successful login
    this.failedLoginAttempts = 0;
    this.accountLocked = false;
    this.accountLockedUntil = undefined;

    // Update last login info
    this.lastLogin = {
      time: new Date(),
      ip,
      userAgent
    };
  } else {
    // Increment failed attempts
    this.failedLoginAttempts += 1;

    // Lock account after X failed attempts
    if (this.failedLoginAttempts >= 5) {
      this.accountLocked = true;

      // Lock for progressively longer periods
      const lockMinutes = Math.min(30, Math.pow(2, this.failedLoginAttempts - 5)); // 1, 2, 4, 8, 16, 30 minutes
      this.accountLockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000);

      logger.warn(`Account locked for ${lockMinutes} minutes due to failed login attempts: ${this.email}`);
    }
  }

  await this.save();
};

// Add a method to increment message stats
UserSchema.methods.incrementMessageStats = async function(isSender) {
  const field = isSender ? 'stats.messagesSent' : 'stats.messagesReceived';
  const update = { $inc: { [field]: 1 } };

  try {
    await mongoose.model('User').findByIdAndUpdate(this._id, update);
  } catch (err) {
    logger.error(`Error incrementing message stats: ${err.message}`);
  }
};

module.exports = mongoose.model('User', UserSchema);
