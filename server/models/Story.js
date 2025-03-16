const mongoose = require("mongoose")
const Schema = mongoose.Schema

const StorySchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: {
    type: String,
    enum: ["image", "video", "text"],
    required: true,
  },
  // Added for client-side compatibility
  mediaType: {
    type: String,
    enum: ["image", "video", "text"],
  },
  media: {
    type: String,
  },
  // For consistency with client expectations
  mediaUrl: {
    type: String,
  },
  content: {
    type: String,
  },
  // Added for client-side compatibility
  text: {
    type: String,
  },
  backgroundColor: {
    type: String,
    default: "#000000",
  },
  // Added for client-side compatibility
  backgroundStyle: {
    type: String,
  },
  fontStyle: {
    type: String,
    default: "default",
  },
  // Store extra styles as an object
  extraStyles: {
    type: mongoose.Schema.Types.Mixed,
  },
  duration: {
    type: Number,
    default: 24, // Duration in hours
  },
  viewers: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
    // Dynamic expiration based on duration field (converted to seconds)
    // This ensures stories expire at the right time based on user selection
    get: function() {
      return this.createdAt;
    },
    set: function(val) {
      this.expires = Math.floor(this.duration || 24) * 3600;
      return val;
    }
  },
  // Added field for dynamic expiration control
  expires: {
    type: Number,
    default: 86400, // 24 hours in seconds (default)
  },
})

// Virtual for determining if a story is expired
StorySchema.virtual('isExpired').get(function() {
  if (!this.createdAt) return true;

  const expiresInSeconds = this.expires || (this.duration * 3600) || 86400;
  const expiryTime = new Date(this.createdAt.getTime() + (expiresInSeconds * 1000));
  return new Date() > expiryTime;
});

// Middleware to set the expiration time based on duration
StorySchema.pre("save", function (next) {
  // Set expires value based on duration (in hours)
  this.expires = (this.duration || 24) * 3600;

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
    return next(new Error("Media is required for image and video stories"))
  }

  if (this.type === "text" && !this.content && !this.text) {
    return next(new Error("Content is required for text stories"))
  }

  next()
})

// Create TTL index on createdAt with dynamic expiration
StorySchema.index({ createdAt: 1 }, {
  expireAfterSeconds: 0
});

module.exports = mongoose.model("Story", StorySchema)
