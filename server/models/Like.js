/**
 * Like model - Handles relationship likes between users
 *
 * This model stores "like" interactions between users with consistent ID handling.
 * It uses a compound index to ensure a user can only like another user once.
 */

import mongoose from 'mongoose';
import logger from '../logger.js';

const { Schema, model, Types, Error: MongooseError } = mongoose;
const { ObjectId } = Types;

// --------------------------
// Helper: Safe ObjectId cast
// --------------------------
function safeObjectId(id) {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  if (ObjectId.isValid(id)) return new ObjectId(id);
  return null;
}

// ---------------------
// Schema Declaration
// ---------------------
const likeSchema = new Schema({
  sender: {
    type: ObjectId,
    ref: 'User',
    required: [true, 'Sender is required'],
    index: true,
  },
  recipient: {
    type: ObjectId,
    ref: 'User',
    required: [true, 'Recipient is required'],
    index: true,
  },
  message: {
    type: String,
    maxlength: [200, 'Message cannot exceed 200 characters'],
    trim: true,
  },
  seen: {
    type: Boolean,
    default: false,
    index: true,
  },
  seenAt: {
    type: Date,
    default: null,
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// ---------------------
// Indexes
// ---------------------
likeSchema.index(
  { sender: 1, recipient: 1 },
  { unique: true, name: 'unique_sender_recipient_idx' }
);
likeSchema.index(
  { recipient: 1, createdAt: -1 },
  { name: 'recent_likes_by_recipient_idx' }
);

// -----------------------------------------
// Pre-validate: ensure IDs & no self-like
// -----------------------------------------
likeSchema.pre('validate', function(next) {
  if (!ObjectId.isValid(this.sender)) {
    return next(new MongooseError.CastError('ObjectId', this.sender, 'sender'));
  }
  if (!ObjectId.isValid(this.recipient)) {
    return next(new MongooseError.CastError('ObjectId', this.recipient, 'recipient'));
  }
  if (this.sender.toString() === this.recipient.toString()) {
    const err = new MongooseError.ValidationError(this);
    err.addError('recipient', new MongooseError.ValidatorError({
      message: 'Cannot like yourself',
      path: 'recipient',
      value: this.recipient
    }));
    return next(err);
  }
  next();
});

// ------------------------------------------------------
// Pre-save: normalize IDs & set seenAt when seen flips
// ------------------------------------------------------
likeSchema.pre('save', function(next) {
  // cast sender/recipient
  const s = safeObjectId(this.sender);
  const r = safeObjectId(this.recipient);
  if (!s || !r) {
    return next(new MongooseError.CastError('ObjectId', !s ? this.sender : this.recipient, !s ? 'sender' : 'recipient'));
  }
  this.sender = s;
  this.recipient = r;

  // if seen changed to true, stamp seenAt
  if (this.isModified('seen') && this.seen && !this.seenAt) {
    this.seenAt = new Date();
  }
  next();
});

// -----------------------------------------
// Pagination helper for statics
// -----------------------------------------
async function paginate(queryBuilder, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    queryBuilder.skip(skip).limit(limit).exec(),
    queryBuilder.model.countDocuments(queryBuilder.getQuery())
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
}

// -----------------------------------------
// Static Methods
// -----------------------------------------
likeSchema.statics.getLikesByRecipient = async function(userId, options = {}) {
  const { page = 1, limit = 20, sort = { createdAt: -1 }, populate = true } = options;
  const recipientId = safeObjectId(userId);
  if (!recipientId) throw new Error('Invalid user ID format');

  let q = this.find({ recipient: recipientId }).sort(sort);
  if (populate) {
    q = q.populate('sender', 'nickname username photos isOnline lastActive');
  }
  return paginate(q, page, limit);
};

likeSchema.statics.getLikesBySender = async function(userId, options = {}) {
  const { page = 1, limit = 20, sort = { createdAt: -1 }, populate = true } = options;
  const senderId = safeObjectId(userId);
  if (!senderId) throw new Error('Invalid user ID format');

  let q = this.find({ sender: senderId }).sort(sort);
  if (populate) {
    q = q.populate('recipient', 'nickname username photos isOnline lastActive');
  }
  return paginate(q, page, limit);
};

likeSchema.statics.getMatches = async function(userId, options = {}) {
  const { page = 1, limit = 20 } = options;
  const userObjectId = safeObjectId(userId);
  if (!userObjectId) throw new Error('Invalid user ID format');

  // find users this user liked
  const liked = await this.find({ sender: userObjectId }).select('recipient').lean();
  const likedIds = liked.map(l => l.recipient);

  // aggregate mutual likes
  const agg = this.aggregate([
    { $match: { sender: { $in: likedIds }, recipient: userObjectId } },
    {
      $lookup: {
        from: 'users',
        localField: 'sender',
        foreignField: '_id',
        as: 'senderUser'
      }
    },
    { $unwind: '$senderUser' },
    {
      $project: {
        _id: 1,
        sender: 1,
        createdAt: 1,
        'senderUser._id': 1,
        'senderUser.nickname': 1,
        'senderUser.username': 1,
        'senderUser.photos': 1,
        'senderUser.isOnline': 1,
        'senderUser.lastActive': 1,
      }
    },
    { $sort: { createdAt: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit }
  ]);

  const [data, countRes] = await Promise.all([
    agg.exec(),
    this.aggregate([
      { $match: { sender: { $in: likedIds }, recipient: userObjectId } },
      { $count: 'total' }
    ])
  ]);

  const total = countRes[0]?.total || 0;
  return { data, pagination: { total, page, pages: Math.ceil(total / limit), limit } };
};

likeSchema.statics.checkMatch = async function(userId1, userId2) {
  const u1 = safeObjectId(userId1);
  const u2 = safeObjectId(userId2);
  if (!u1 || !u2) throw new Error('Invalid user ID format');

  const [a, b] = await Promise.all([
    this.exists({ sender: u1, recipient: u2 }),
    this.exists({ sender: u2, recipient: u1 }),
  ]);
  return Boolean(a && b);
};

// -----------------------------------------
// Instance Methods
// -----------------------------------------
likeSchema.methods.markAsSeen = async function() {
  if (!this.seen) {
    this.seen = true;
    this.seenAt = new Date();
    await this.save();
  }
  return this;
};

likeSchema.methods.addMessage = async function(msg) {
  const trimmed = (msg || '').trim();
  if (!trimmed) throw new MongooseError.ValidationError('Message cannot be empty');
  if (trimmed.length > 200) {
    throw new MongooseError.ValidationError('Message cannot exceed 200 characters');
  }
  this.message = trimmed;
  return this.save();
};

// -----------------------------------------
// Virtual: isMatch
// -----------------------------------------
likeSchema.virtual('isMatch').get(function() {
  // returns a promise; use with `await likeDoc.isMatch`
  return this.constructor.checkMatch(this.sender, this.recipient)
    .catch(err => {
      logger.error(`Error in isMatch virtual: ${err.message}`);
      return false;
    });
});

// ---------------------
// Model Export
// ---------------------
const Like = model('Like', likeSchema);
export default Like;
