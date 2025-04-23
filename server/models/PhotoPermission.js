// models/PhotoPermission.js
import mongoose from 'mongoose';
import logger from '../logger.js';

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

// -----------------------------
// PhotoPermission Schema
// -----------------------------
const PhotoPermissionSchema = new Schema({
  photo: {
    type: ObjectId,
    ref: 'User',
    required: [true, 'Photo ID is required'],
    index: true,
  },
  requestedBy: {
    type: ObjectId,
    ref: 'User',
    required: [true, 'Requesting user ID is required'],
    index: true,
  },
  photoOwnerId: {
    type: ObjectId,
    ref: 'User',
    required: [true, 'Photo owner ID is required'],
    index: true,
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'rejected'],
      message: 'Status must be pending, approved, or rejected',
    },
    default: 'pending',
    index: true,
  },
  message: {
    type: String,
    trim: true,
    maxlength: [200, 'Message cannot exceed 200 characters'],
  },
  respondedAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,       // adds createdAt & updatedAt
  toJSON:    { virtuals: true },
  toObject:  { virtuals: true },
});

// -------------------------------------
// Unique constraint for one request per photo/user
// -------------------------------------
PhotoPermissionSchema.index(
  { photo: 1, requestedBy: 1 },
  { unique: true, name: 'photo_requestedBy_unique' }
);

// --------------------------------------------------
// Pre-validate: prevent self‑requests
// --------------------------------------------------
PhotoPermissionSchema.pre('validate', function(next) {
  if (this.isNew && this.photoOwnerId.equals(this.requestedBy)) {
    const err = new MongooseError.ValidationError(this);
    err.addError('requestedBy', new MongooseError.ValidatorError({
      message: 'Cannot request permission for your own photo',
      path: 'requestedBy',
      value: this.requestedBy
    }));
    return next(err);
  }
  next();
});

// --------------------------------------------------
// Pre-save: cast IDs, stamp respondedAt & expiresAt
// --------------------------------------------------
PhotoPermissionSchema.pre('save', function(next) {
  try {
    // Safe-cast all ObjectId fields
    this.photo        = safeObjectId(this.photo,        'photo');
    this.requestedBy  = safeObjectId(this.requestedBy,  'requestedBy');
    this.photoOwnerId = safeObjectId(this.photoOwnerId, 'photoOwnerId');

    // If status has changed to approved or rejected
    if (this.isModified('status') && ['approved','rejected'].includes(this.status)) {
      this.respondedAt = new Date();

      if (this.status === 'approved') {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 30);
        this.expiresAt = expiry;
      } else {
        this.expiresAt = null;
      }
    }

    next();
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------
// Instance: check if permission expired
// --------------------------------------------------
PhotoPermissionSchema.methods.hasExpired = function() {
  return this.status === 'approved' &&
         this.expiresAt &&
         this.expiresAt < new Date();
};

// --------------------------------------------------
// Instance: approve request
// --------------------------------------------------
PhotoPermissionSchema.methods.approve = async function(expiryDays = 30) {
  this.status      = 'approved';
  this.respondedAt = new Date();

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + expiryDays);
  this.expiresAt = expiry;

  return this.save();
};

// --------------------------------------------------
// Instance: reject request
// --------------------------------------------------
PhotoPermissionSchema.methods.reject = async function(reason) {
  this.status      = 'rejected';
  this.respondedAt = new Date();
  this.expiresAt   = null;

  if (reason) this.message = reason;
  return this.save();
};

// --------------------------------------------------
// Static: list pending requests for a user’s private photos
// --------------------------------------------------
PhotoPermissionSchema.statics.getPendingForUser = async function(userId, options = {}) {
  const page  = Number(options.page)  || 1;
  const limit = Number(options.limit) || 20;
  const skip  = (page - 1) * limit;

  const ownerId = safeObjectId(userId, 'userId');
  const User    = mongoose.model('User');

  // Fetch only private photos
  const user = await User.findById(ownerId).select('photos.isPrivate photos.id');
  if (!user) throw new Error('User not found');

  const privateIds = user.photos
    .filter(p => p.isPrivate)
    .map(p => p.id);

  if (privateIds.length === 0) {
    return { data: [], pagination: { total: 0, page, pages: 0, limit } };
  }

  const query = {
    photo: { $in: privateIds },
    status: 'pending',
  };

  const [docs, total] = await Promise.all([
    this.find(query)
      .populate('requestedBy', 'nickname username photos avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    this.countDocuments(query),
  ]);

  return {
    data: docs,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    },
  };
};

export default model('PhotoPermission', PhotoPermissionSchema);
