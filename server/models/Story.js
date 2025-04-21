// models/Story.js
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

// -------------------------------------
// Helper: simple pagination for queries
// -------------------------------------
async function paginate(query, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    query.skip(skip).limit(limit).lean().exec(),
    query.model.countDocuments(query.getQuery()),
  ]);
  return {
    data: docs,
    pagination: { total, page, pages: Math.ceil(total / limit), limit },
  };
}

// -------------------------
// Sub-Schemas
// -------------------------
const ReactionSchema = new Schema({
  user:    { type: ObjectId, ref: 'User', required: true, index: true },
  type:    { type: String, enum: ['like','love','laugh','wow','sad','angry'], default: 'like' },
  createdAt:{ type: Date, default: Date.now },
  updatedAt:{ type: Date, default: Date.now },
}, { _id: false });

const ViewerSchema = new Schema({
  user:     { type: ObjectId, ref: 'User', required: true, index: true },
  viewedAt: { type: Date, default: Date.now },
}, { _id: false });

// -------------------------
// Main Story Schema
// -------------------------
const StorySchema = new Schema({
  user: {
    type: ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    index: true,
  },
  type: {
    type: String,
    enum: ['image','video','text'],
    required: [true, 'Story type is required'],
    index: true,
  },
  media:    { type: String, trim: true },
  mediaUrl: { type: String, trim: true },
  mediaType:{ type: String, enum: ['image','video','text'] },
  content:  { type: String, trim: true },
  text:     { type: String, trim: true },
  backgroundColor: { type: String, default: '#000000' },
  backgroundStyle: { type: String, trim: true },
  fontStyle:       { type: String, trim: true },
  extraStyles:     { type: Schema.Types.Mixed, default: {} },
  duration: {
    type: Number,
    default: 24,
    min: [1, 'Duration must be at least 1 hour'],
    max: [72, 'Duration cannot exceed 72 hours'],
  },
  viewers:   [ViewerSchema],
  reactions: [ReactionSchema],
  expiresAt: { type: Date, index: true },
  isPremium: { type: Boolean, default: false },
  userData:  { type: Schema.Types.Mixed, default: null },
}, {
  timestamps: true,
  toJSON:    { virtuals: true },
  toObject:  { virtuals: true },
});

// -------------------------
// Virtuals
// -------------------------
StorySchema.virtual('isExpired').get(function() {
  return this.expiresAt ? new Date() > this.expiresAt : true;
});

StorySchema.virtual('viewCount').get(function() {
  return this.viewers?.length || 0;
});

StorySchema.virtual('reactionCount').get(function() {
  return this.reactions?.length || 0;
});

// -------------------------
// Indexes
// -------------------------
StorySchema.index({ user: 1, expiresAt: 1 });
StorySchema.index({ 'viewers.user': 1, expiresAt: 1 });
StorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// -------------------------------------------------
// Pre-save: cast IDs, normalize fields, set expiresAt
// -------------------------------------------------
StorySchema.pre('save', function(next) {
  try {
    // Cast user ID
    this.user = safeObjectId(this.user, 'user');

    // Normalize media vs mediaUrl
    if (this.media && !this.mediaUrl) this.mediaUrl = this.media;
    if (this.mediaUrl && !this.media) this.media = this.mediaUrl;

    // Normalize content vs text
    if (this.content && !this.text) this.text = this.content;
    if (this.text && !this.content) this.content = this.text;

    // Ensure mediaType
    if (!this.mediaType) {
      this.mediaType = this.type;
    }

    // Validate required fields per type
    if ((this.type === 'image' || this.type === 'video') && !this.media) {
      throw new MongooseError.ValidationError(`Media is required for ${this.type} stories`);
    }
    if (this.type === 'text' && !this.content) {
      throw new MongooseError.ValidationError('Content is required for text stories');
    }

    // Calculate expiresAt based on duration
    const base = this.createdAt || new Date();
    const exp  = new Date(base);
    exp.setHours(exp.getHours() + (this.duration || 24));
    this.expiresAt = exp;

    next();
  } catch (err) {
    logger.error(`Story pre-save error: ${err.message}`);
    next(err);
  }
});

// ---------------------------------
// Static: find active stories by user
// ---------------------------------
StorySchema.statics.findActiveByUser = async function(userId, opts = {}) {
  try {
    const userObj = safeObjectId(userId, 'userId');
    const now     = new Date();
    const query   = this.find({ user: userObj, expiresAt: { $gt: now } }).sort({ createdAt: -1 });
    return paginate(query, opts);
  } catch (err) {
    logger.error(`findActiveByUser error: ${err.message}`);
    throw err;
  }
};

// ---------------------------------
// Static: find all active stories
// ---------------------------------
StorySchema.statics.findAllActive = async function(opts = {}) {
  try {
    const now   = new Date();
    const query = this.find({ expiresAt: { $gt: now } }).sort({ createdAt: -1 });
    return paginate(query, opts);
  } catch (err) {
    logger.error(`findAllActive error: ${err.message}`);
    throw err;
  }
};

// ---------------------------------
// Instance: add a viewer
// ---------------------------------
StorySchema.methods.addViewer = async function(userId) {
  const uid = safeObjectId(userId, 'viewer.user');
  if (!this.viewers.some(v => v.user.equals(uid))) {
    this.viewers.push({ user: uid, viewedAt: new Date() });
    return this.save();
  }
  return this;
};

// ---------------------------------
// Instance: add or update reaction
// ---------------------------------
StorySchema.methods.addReaction = async function(userId, type = 'like') {
  const uid = safeObjectId(userId, 'reaction.user');
  const idx = this.reactions.findIndex(r => r.user.equals(uid));
  if (idx >= 0) {
    this.reactions[idx].type = type;
    this.reactions[idx].updatedAt = new Date();
  } else {
    this.reactions.push({ user: uid, type, createdAt: new Date(), updatedAt: new Date() });
  }
  return this.save();
};

// ---------------------------------
// Instance: remove a reaction
// ---------------------------------
StorySchema.methods.removeReaction = async function(userId) {
  const uid = safeObjectId(userId, 'reaction.user');
  this.reactions = this.reactions.filter(r => !r.user.equals(uid));
  return this.save();
};

// ---------------------------------
// Instance: check if viewed by user
// ---------------------------------
StorySchema.methods.isViewedBy = function(userId) {
  const uid = safeObjectId(userId, 'isViewedBy.user');
  return this.viewers.some(v => v.user.equals(uid));
};

// -------------------------
// Export Model
// -------------------------
export default model('Story', StorySchema);
