// models/Story.js - Enhanced with ES modules and improved structure
import mongoose from 'mongoose';
import logger from '../logger.js';

const { Schema, model } = mongoose;

// Define a reaction schema for story reactions
const ReactionSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['like', 'love', 'laugh', 'wow', 'sad', 'angry'],
    default: 'like'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

/**
 * Story schema - user-created content with various types (image, video, text)
 */
const StorySchema = new Schema({
  // User who created the story
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: [true, "User is required"],
    index: true
  },
  
  // Type of story
  type: {
    type: String,
    enum: {
      values: ["image", "video", "text"],
      message: "Story type must be image, video, or text"
    },
    required: [true, "Story type is required"],
    index: true
  },
  
  // Added for client-side compatibility
  mediaType: {
    type: String,
    enum: ["image", "video", "text"],
  },
  
  // Media URL for image/video stories
  media: {
    type: String,
  },
  
  // For consistency with client expectations
  mediaUrl: {
    type: String,
  },
  
  // Content for text stories
  content: {
    type: String,
    trim: true,
    validate: {
      validator: function(val) {
        // Text stories must have content
        if (this.type === 'text' && (!val || val.trim().length === 0)) {
          return false;
        }
        return true;
      },
      message: 'Text stories must have content'
    }
  },
  
  // Added for client-side compatibility
  text: {
    type: String,
  },
  
  // Background color (primarily for text stories)
  backgroundColor: {
    type: String,
    default: "#000000",
    validate: {
      validator: function(v) {
        return /^#([0-9A-F]{3}){1,2}$/i.test(v);
      },
      message: 'Background color must be a valid hex color code'
    }
  },
  
  // Added for client-side compatibility
  backgroundStyle: {
    type: String,
  },
  
  // Font style for text stories
  fontStyle: {
    type: String,
    default: "default",
    enum: {
      values: ["default", "serif", "sans-serif", "monospace", "cursive", "fantasy"],
      message: "Font style must be a valid option"
    }
  },
  
  // Store extra styles as an object
  extraStyles: {
    type: Schema.Types.Mixed,
    default: {},
  },
  
  // Duration in hours that the story should be visible
  duration: {
    type: Number,
    default: 24, // Duration in hours
    min: [1, "Duration must be at least 1 hour"],
    max: [72, "Duration cannot exceed 72 hours"]
  },
  
  // Users who have viewed the story
  viewers: [
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      viewedAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  
  // User reactions to the story
  reactions: [ReactionSchema],
  
  // When the story was created
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // When the story expires
  expiresAt: {
    type: Date,
    default: function() {
      const date = new Date(this.createdAt || Date.now());
      date.setHours(date.getHours() + (this.duration || 24));
      return date;
    },
    index: true
  },
  
  // Added field for dynamic expiration control
  expires: {
    type: Number,
    default: 86400, // 24 hours in seconds (default)
  },
  
  // Flag for highlighting premium content
  isPremium: {
    type: Boolean,
    default: false
  },
  
  // Cached user data for faster retrieval
  userData: {
    type: Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for determining if a story is expired
StorySchema.virtual('isExpired').get(function() {
  if (!this.createdAt) return true;

  const expiryTime = this.expiresAt || new Date(this.createdAt.getTime() + ((this.expires || this.duration * 3600) * 1000));
  return new Date() > expiryTime;
});

// Virtual for view count
StorySchema.virtual('viewCount').get(function() {
  return this.viewers ? this.viewers.length : 0;
});

// Virtual for reaction count
StorySchema.virtual('reactionCount').get(function() {
  return this.reactions ? this.reactions.length : 0;
});

// Middleware to ensure consistent data before saving
StorySchema.pre("save", function (next) {
  try {
    // Set expires value based on duration (in hours)
    this.expires = (this.duration || 24) * 3600;
    
    // Calculate expiration date
    const expiryDate = new Date(this.createdAt || Date.now());
    expiryDate.setHours(expiryDate.getHours() + (this.duration || 24));
    this.expiresAt = expiryDate;

    // Ensure mediaType matches type for consistency
    if (this.type && !this.mediaType) {
      this.mediaType = this.type;
    }

    // Ensure text and content are consistent
    if (this.content && !this.text && this.type === "text") {
      this.text = this.content;
    }

    if (this.text && !this.content && this.type === "text") {
      this.content = this.text;
    }

    // Ensure mediaUrl matches media
    if (this.media && !this.mediaUrl) {
      this.mediaUrl = this.media;
    }

    if (this.mediaUrl && !this.media) {
      this.media = this.mediaUrl;
    }

    // Ensure backgroundStyle matches backgroundColor
    if (this.backgroundColor && !this.backgroundStyle) {
      this.backgroundStyle = this.backgroundColor;
    }

    // Type-specific validations
    if ((this.type === "image" || this.type === "video") && !this.media && !this.mediaUrl) {
      return next(new Error("Media is required for image and video stories"));
    }

    if (this.type === "text" && !this.content && !this.text) {
      return next(new Error("Content is required for text stories"));
    }

    next();
  } catch (error) {
    logger.error(`Error in Story pre-save middleware: ${error.message}`);
    next(error);
  }
});

// Create TTL index on expiresAt for auto-deletion of expired stories
StorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Static method to find active stories by user
 * @param {ObjectId|String} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Active stories
 */
StorySchema.statics.findActiveByUser = async function(userId, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  
  try {
    const now = new Date();
    
    const query = {
      user: userId,
      expiresAt: { $gt: now }
    };
    
    const [stories, total] = await Promise.all([
      this.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'nickname username name profilePicture avatar'),
      this.countDocuments(query)
    ]);
    
    return {
      data: stories,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    };
  } catch (error) {
    logger.error(`Error in findActiveByUser: ${error.message}`);
    throw error;
  }
};

/**
 * Static method to find stories for a user's feed
 * @param {ObjectId|String} userId - Viewing user's ID
 * @param {Array} followingIds - List of user IDs the viewer follows
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Feed stories
 */
StorySchema.statics.findForFeed = async function(userId, followingIds = [], options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  
  try {
    const now = new Date();
    
    // Include stories from users being followed and premium stories
    const query = {
      expiresAt: { $gt: now },
      $or: [
        { user: { $in: followingIds } },
        { isPremium: true }
      ]
    };
    
    // Exclude stories the user has already viewed
    if (options.excludeViewed) {
      query['viewers.user'] = { $ne: userId };
    }
    
    const [stories, total] = await Promise.all([
      this.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'nickname username name profilePicture avatar'),
      this.countDocuments(query)
    ]);
    
    return {
      data: stories,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    };
  } catch (error) {
    logger.error(`Error in findForFeed: ${error.message}`);
    throw error;
  }
};

/**
 * Instance method to add a viewer
 * @param {ObjectId|String} userId - Viewing user's ID
 * @returns {Promise<Object>} Updated story
 */
StorySchema.methods.addViewer = async function(userId) {
  // Check if already viewed
  const alreadyViewed = this.viewers.some(v => 
    v.user && v.user.toString() === userId.toString()
  );
  
  if (!alreadyViewed) {
    this.viewers.push({
      user: userId,
      viewedAt: new Date()
    });
    
    return this.save();
  }
  
  return this;
};

/**
 * Instance method to add a reaction
 * @param {ObjectId|String} userId - User ID adding the reaction
 * @param {String} type - Reaction type
 * @returns {Promise<Object>} Updated story
 */
StorySchema.methods.addReaction = async function(userId, type = 'like') {
  // Check for existing reaction
  const existingIndex = this.reactions.findIndex(r => 
    r.user && r.user.toString() === userId.toString()
  );
  
  if (existingIndex >= 0) {
    // Update existing reaction
    this.reactions[existingIndex].type = type;
    this.reactions[existingIndex].updatedAt = new Date();
  } else {
    // Add new reaction
    this.reactions.push({
      user: userId,
      type,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  
  return this.save();
};

/**
 * Instance method to remove a reaction
 * @param {ObjectId|String} userId - User ID removing the reaction
 * @returns {Promise<Object>} Updated story
 */
StorySchema.methods.removeReaction = async function(userId) {
  this.reactions = this.reactions.filter(r => 
    !r.user || r.user.toString() !== userId.toString()
  );
  
  return this.save();
};

const Story = model("Story", StorySchema);

export default Story;
