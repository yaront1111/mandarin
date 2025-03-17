// Upgraded User.js model with improved security, validation, and tier system
const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const crypto = require("crypto")
const validator = require("validator")

const photoSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, "Photo URL is required"],
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    metadata: {
      contentType: String,
      size: Number,
      dimensions: {
        width: Number,
        height: Number,
      },
    },
  },
  { timestamps: true },
)

const partnerInfoSchema = new mongoose.Schema({
  nickname: String,
  gender: {
    type: String,
    enum: ["male", "female", "non-binary", "other"],
  },
  age: {
    type: Number,
    min: [18, "Partner must be at least 18 years old"],
  },
})

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, "Please provide a valid email"],
      index: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    username: {
      type: String,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
    },
    nickname: {
      type: String,
      required: [true, "Nickname is required"],
      trim: true,
      minlength: [3, "Nickname must be at least 3 characters"],
      maxlength: [30, "Nickname cannot exceed 30 characters"],
      index: true,
    },
    avatar: {
      type: String,
      default: "",
    },
    profilePicture: {
      type: String,
      default: "",
    },
    details: {
      age: {
        type: Number,
        min: [18, "You must be at least 18 years old"],
        max: [120, "Age cannot exceed 120"],
      },
      gender: {
        type: String,
        enum: {
          values: ["male", "female", "non-binary", "other", ""],
          message: "Gender must be male, female, non-binary, other, or empty",
        },
        default: "",
      },
      location: {
        type: String,
        trim: true,
        maxlength: [100, "Location cannot exceed 100 characters"],
      },
      bio: {
        type: String,
        trim: true,
        maxlength: [500, "Bio cannot exceed 500 characters"],
      },
      interests: {
        type: [String],
        validate: {
          validator: (interests) => interests.length <= 10,
          message: "Cannot have more than 10 interests",
        },
      },
    },
    photos: [photoSchema],
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    socketId: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["user", "moderator", "admin"],
      default: "user",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: String,
    verificationTokenExpires: Date,
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    refreshToken: String,
    refreshTokenExpires: Date,
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,
    active: {
      type: Boolean,
      default: true,
      select: false,
    },
    // Account tier system fields
    accountTier: {
      type: String,
      enum: ["FREE", "PAID", "FEMALE", "COUPLE"],
      default: "FREE",
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    subscriptionExpiry: {
      type: Date,
      default: null,
    },
    dailyLikesRemaining: {
      type: Number,
      default: 3, // Free male users get 3 likes per day
    },
    dailyLikesReset: {
      type: Date,
      default: () => new Date(new Date().setHours(0, 0, 0, 0) + 24 * 60 * 60 * 1000), // Next day at midnight
    },
    lastStoryCreated: {
      type: Date,
      default: null,
    },
    isCouple: {
      type: Boolean,
      default: false,
    },
    partnerInfo: {
      type: partnerInfoSchema,
      default: null,
    },
    settings: {
      notifications: {
        messages: { type: Boolean, default: true },
        calls: { type: Boolean, default: true },
        stories: { type: Boolean, default: true },
        likes: { type: Boolean, default: true },
        comments: { type: Boolean, default: true },
      },
      privacy: {
        showOnlineStatus: { type: Boolean, default: true },
        showReadReceipts: { type: Boolean, default: true },
        showLastSeen: { type: Boolean, default: true },
        allowStoryReplies: { type: String, default: "everyone", enum: ["everyone", "friends", "none"] },
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Virtual field for age calculation
userSchema.virtual("age").get(function () {
  return this.details && this.details.age ? this.details.age : null
})

// Index for efficient queries
userSchema.index({ "details.location": "text", "details.interests": "text" })
userSchema.index({ isOnline: 1, lastActive: -1 })
userSchema.index({ email: 1, nickname: 1 })

// Pre-save middleware to ensure username is set
userSchema.pre("save", async function (next) {
  // Generate username if not set
  if (!this.username) {
    if (this.email) {
      this.username = this.email.split("@")[0]
    } else if (this.nickname) {
      this.username = this.nickname.toLowerCase().replace(/\s+/g, "_")
    } else {
      this.username = `user_${this._id.toString().slice(-6)}`
    }
  }

  // If name is not set, use nickname or username
  if (!this.name) {
    this.name = this.nickname || this.username
  }

  // If profilePicture is not set but avatar is, use avatar
  if (!this.profilePicture && this.avatar) {
    this.profilePicture = this.avatar
  }

  // Ensure details object exists
  if (!this.details) {
    this.details = {}
  }

  // Handle gender validation
  if (this.details.gender === undefined || this.details.gender === null) {
    this.details.gender = ""
  }

  // Set account tier based on gender and payment status
  if (this.isModified("details.gender") || this.isModified("isPaid") || this.isModified("isCouple")) {
    this.setAccountTier()
  }

  // Reset daily likes if needed
  const now = new Date()
  if (this.dailyLikesReset && now >= this.dailyLikesReset) {
    this.dailyLikesRemaining = this.getMaxDailyLikes()
    this.dailyLikesReset = new Date(new Date().setHours(0, 0, 0, 0) + 24 * 60 * 60 * 1000) // Next day at midnight
  }

  next()
})

// Method to set account tier based on gender and payment status
userSchema.methods.setAccountTier = function () {
  if (this.isCouple) {
    this.accountTier = "COUPLE"
  } else if (this.details.gender === "female") {
    this.accountTier = "FEMALE"
  } else if (this.isPaid) {
    this.accountTier = "PAID"
  } else {
    this.accountTier = "FREE"
  }
}

// Method to get max daily likes based on account tier
userSchema.methods.getMaxDailyLikes = function () {
  switch (this.accountTier) {
    case "FREE":
      return 3
    case "PAID":
    case "FEMALE":
    case "COUPLE":
      return Number.POSITIVE_INFINITY // Unlimited likes
    default:
      return 3
  }
}

// Method to check if user can create a story
userSchema.methods.canCreateStory = function () {
  if (this.accountTier === "FREE") {
    // Free male users can only create 1 story per 72 hours
    if (!this.lastStoryCreated) return true

    const cooldownPeriod = 72 * 60 * 60 * 1000 // 72 hours in milliseconds
    const timeSinceLastStory = Date.now() - this.lastStoryCreated.getTime()
    return timeSinceLastStory >= cooldownPeriod
  }

  // All other account types can create stories without restrictions
  return true
}

// Method to check if user can send messages (not just winks)
userSchema.methods.canSendMessages = function () {
  return this.accountTier !== "FREE" // Only free male users are restricted
}

// Pre-save middleware to hash password
userSchema.pre("save", async function (next) {
  // Only hash the password if it's modified
  if (!this.isModified("password")) return next()

  try {
    // Hash password with cost factor of 12
    this.password = await bcrypt.hash(this.password, 12)

    // Update passwordChangedAt field
    if (this.isModified("password") && !this.isNew) {
      this.passwordChangedAt = Date.now() - 1000 // Subtract 1 second to ensure token is created after password change
    }

    next()
  } catch (error) {
    next(error)
  }
})

// Pre-find middleware to exclude inactive users
userSchema.pre(/^find/, function (next) {
  // 'this' refers to the current query
  this.find({ active: { $ne: false } })
  next()
})

// Method to check if password is correct
userSchema.methods.correctPassword = async (candidatePassword, userPassword) =>
  await bcrypt.compare(candidatePassword, userPassword)

// Method to check if password was changed after token was issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = Number.parseInt(this.passwordChangedAt.getTime() / 1000, 10)
    return JWTTimestamp < changedTimestamp
  }
  return false
}

// Method to create password reset token
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex")

  this.passwordResetToken = crypto.createHash("sha256").update(resetToken).digest("hex")
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000 // 10 minutes

  return resetToken
}

// Method to create email verification token
userSchema.methods.createVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString("hex")

  this.verificationToken = crypto.createHash("sha256").update(verificationToken).digest("hex")
  this.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000 // 24 hours

  return verificationToken
}

// Method to create refresh token
userSchema.methods.createRefreshToken = function () {
  const refreshToken = crypto.randomBytes(40).toString("hex")

  this.refreshToken = crypto.createHash("sha256").update(refreshToken).digest("hex")
  this.refreshTokenExpires = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days

  return refreshToken
}

// Method to check if account is locked
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now()
}

// Method to increment login attempts
userSchema.methods.incrementLoginAttempts = async function () {
  // Reset login attempts if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    this.loginAttempts = 1
    this.lockUntil = undefined
  } else {
    // Increment login attempts
    this.loginAttempts += 1

    // Lock account if max attempts reached
    if (this.loginAttempts >= 5) {
      this.lockUntil = Date.now() + 60 * 60 * 1000 // 1 hour
    }
  }

  await this.save()
}

const User = mongoose.model("User", userSchema)

module.exports = User
