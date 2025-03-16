const mongoose = require("mongoose")
const Schema = mongoose.Schema

const StorySchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mediaUrl: {
      type: String,
      required: true,
    },
    mediaType: {
      type: String,
      enum: ["image", "video", "text"],
      required: true,
    },
    caption: {
      type: String,
      default: "",
    },
    // Text content for text stories
    text: {
      type: String,
      default: "",
    },
    // Styling options for text stories
    backgroundStyle: {
      type: String,
      default: "",
    },
    fontStyle: {
      type: String,
      default: "",
    },
    extraStyles: {
      type: Object,
      default: {},
    },
    // Duration in hours that the story should be available
    duration: {
      type: Number,
      default: 24,
    },
    viewers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Optional metadata for the story
    metadata: {
      location: String,
      tags: [String],
      filter: String,
    },
  },
  { timestamps: true },
)

// Method to add a viewer to the story
StorySchema.methods.addViewer = async function (userId) {
  if (!this.viewers.includes(userId)) {
    this.viewers.push(userId)
    await this.save()
  }
  return this
}

// Virtual for checking if story is expired (based on duration)
StorySchema.virtual("isExpired").get(function () {
  const now = new Date()
  const createdAt = new Date(this.createdAt)
  const durationMs = (this.duration || 24) * 60 * 60 * 1000  // Convert hours to milliseconds
  const diff = now - createdAt
  return diff > durationMs
})

// Virtual for getting view count
StorySchema.virtual("viewCount").get(function () {
  return this.viewers.length
})

// Set virtuals to true in toJSON
StorySchema.set("toJSON", { virtuals: true })
StorySchema.set("toObject", { virtuals: true })

module.exports = mongoose.model("story", StorySchema)
