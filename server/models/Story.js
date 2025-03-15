const mongoose = require("mongoose")
const Schema = mongoose.Schema

const StorySchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    mediaUrl: {
      type: String,
      required: true,
    },
    mediaType: {
      type: String,
      enum: ["image", "video"],
      required: true,
    },
    caption: {
      type: String,
      default: "",
    },
    viewers: [
      {
        type: Schema.Types.ObjectId,
        ref: "user",
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

// Virtual for checking if story is expired (24 hours)
StorySchema.virtual("isExpired").get(function () {
  const now = new Date()
  const createdAt = new Date(this.createdAt)
  const diff = now - createdAt
  return diff > 24 * 60 * 60 * 1000 // 24 hours in milliseconds
})

// Virtual for getting view count
StorySchema.virtual("viewCount").get(function () {
  return this.viewers.length
})

// Set virtuals to true in toJSON
StorySchema.set("toJSON", { virtuals: true })
StorySchema.set("toObject", { virtuals: true })

module.exports = mongoose.model("story", StorySchema)
