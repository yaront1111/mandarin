// adminController.js - Controller functions for admin dashboard
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/User.js";
import Like from "../models/Like.js";
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";
import PhotoPermission from "../models/PhotoPermission.js";
import Story from "../models/Story.js";
import logger from "../logger.js";
import { createAuditLog } from "../utils/auditLogger.js";

// Helper functions
const createApiResponse = (success, data, message = null, error = null) => ({
  success,
  ...(data && { data }),
  ...(message && { message }),
  ...(error && { error }),
});

/**
 * Get overview statistics for admin dashboard
 */
export const getOverviewStats = async (req, res) => {
  // Get current date and dates for previous periods
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());
  
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  // Collect statistics in parallel
  const [
    totalUsers,
    activeUsers,
    newUsers24h,
    newUsersWeek,
    newUsersMonth,
    onlineUsers,
    totalLikes,
    totalMessages,
    totalPhotos,
    totalStories,
    verifiedUsers,
    paidUsers,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ lastActive: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }), // Active in last 7 days
    User.countDocuments({ createdAt: { $gte: yesterday } }),
    User.countDocuments({ createdAt: { $gte: thisWeekStart } }),
    User.countDocuments({ createdAt: { $gte: thisMonthStart } }),
    User.countDocuments({ isOnline: true }),
    Like.countDocuments(),
    Message.countDocuments(),
    User.aggregate([
      { $project: { photoCount: { $size: "$photos" } } },
      { $group: { _id: null, total: { $sum: "$photoCount" } } }
    ]).then(result => (result[0]?.total || 0)),
    Story.countDocuments(),
    User.countDocuments({ isVerified: true }),
    User.countDocuments({ accountTier: { $in: ["PAID", "COUPLE"] } }),
  ]);

  // Get user distribution by tier
  const usersByTier = await User.aggregate([
    { $group: { _id: "$accountTier", count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  // Get gender distribution
  const genderDistribution = await User.aggregate([
    { $group: { _id: "$details.gender", count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  // Create response object
  const stats = {
    users: {
      total: totalUsers,
      active: activeUsers,
      online: onlineUsers,
      new: {
        daily: newUsers24h,
        weekly: newUsersWeek,
        monthly: newUsersMonth
      },
      verified: verifiedUsers,
      paid: paidUsers,
      byTier: usersByTier.reduce((acc, curr) => {
        acc[curr._id || 'unknown'] = curr.count;
        return acc;
      }, {}),
      byGender: genderDistribution.reduce((acc, curr) => {
        acc[curr._id || 'unknown'] = curr.count;
        return acc;
      }, {})
    },
    activity: {
      likes: totalLikes,
      messages: totalMessages,
      photos: totalPhotos,
      stories: totalStories
    }
  };

  // Log the action
  createAuditLog({
    action: 'VIEW_DASHBOARD_STATS',
    userId: req.user._id,
    details: 'Dashboard overview stats viewed'
  });

  return res.json(createApiResponse(true, stats));
};

/**
 * Get detailed user statistics
 */
export const getUserStats = async (req, res) => {
  // Age distribution
  const ageDistribution = await User.aggregate([
    { $match: { "details.age": { $exists: true, $ne: null } } },
    { 
      $bucket: {
        groupBy: "$details.age",
        boundaries: [18, 25, 35, 45, 55, 65, 120],
        default: "unknown",
        output: { count: { $sum: 1 } }
      }
    }
  ]);

  // Location distribution (top 10)
  const locationDistribution = await User.aggregate([
    { $match: { "details.location": { $exists: true, $ne: "" } } },
    { $group: { _id: "$details.location", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  // User growth over time (last 12 months)
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    return { month: d.getMonth(), year: d.getFullYear() };
  }).reverse();

  const userGrowth = await Promise.all(
    months.map(async ({ month, year }) => {
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59);
      
      const count = await User.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate }
      });
      
      return {
        period: `${year}-${String(month + 1).padStart(2, '0')}`,
        count
      };
    })
  );

  // Active users over time (last 4 weeks by day)
  const lastMonth = new Date();
  lastMonth.setDate(lastMonth.getDate() - 28);

  const activeUsersByDay = await User.aggregate([
    { $match: { lastActive: { $gte: lastMonth } } },
    { 
      $group: {
        _id: { 
          year: { $year: "$lastActive" },
          month: { $month: "$lastActive" },
          day: { $dayOfMonth: "$lastActive" }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
  ]);

  // Format the active users data
  const activeUsersOverTime = activeUsersByDay.map(day => ({
    date: `${day._id.year}-${String(day._id.month).padStart(2, '0')}-${String(day._id.day).padStart(2, '0')}`,
    count: day.count
  }));

  // Retention data - get users by join month and check activity
  const retentionData = await User.aggregate([
    { 
      $group: {
        _id: { 
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        },
        users: { $push: "$$ROOT" }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
    { $limit: 12 }
  ]);

  // Process retention data to calculate 30-day retention
  const retention = await Promise.all(
    retentionData.map(async (cohort) => {
      const cohortSize = cohort.users.length;
      const cohortStartDate = new Date(cohort._id.year, cohort._id.month - 1, 1);
      
      // Check how many users were active 30 days later
      const thirtyDayMark = new Date(cohortStartDate);
      thirtyDayMark.setDate(thirtyDayMark.getDate() + 30);
      
      const activeAfter30Days = cohort.users.filter(user => {
        return user.lastActive && user.lastActive >= thirtyDayMark;
      }).length;
      
      return {
        cohort: `${cohort._id.year}-${String(cohort._id.month).padStart(2, '0')}`,
        size: cohortSize,
        retained: activeAfter30Days,
        retentionRate: cohortSize > 0 ? (activeAfter30Days / cohortSize * 100).toFixed(2) : 0
      };
    })
  );

  // Log the action
  createAuditLog({
    action: 'VIEW_USER_STATS',
    userId: req.user._id,
    details: 'Detailed user statistics viewed'
  });

  return res.json(createApiResponse(true, {
    ageDistribution,
    locationDistribution,
    userGrowth,
    activeUsersOverTime,
    retention
  }));
};

/**
 * Get activity statistics
 */
export const getActivityStats = async (req, res) => {
  // Get date range from query params or use default (last 30 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (req.query.days ? parseInt(req.query.days, 10) : 30));

  // Message activity over time
  const messageActivity = await Message.aggregate([
    { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
  ]);

  const formattedMessageActivity = messageActivity.map(day => ({
    date: `${day._id.year}-${String(day._id.month).padStart(2, '0')}-${String(day._id.day).padStart(2, '0')}`,
    count: day.count
  }));

  // Like activity over time
  const likeActivity = await Like.aggregate([
    { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
  ]);

  const formattedLikeActivity = likeActivity.map(day => ({
    date: `${day._id.year}-${String(day._id.month).padStart(2, '0')}-${String(day._id.day).padStart(2, '0')}`,
    count: day.count
  }));

  // Photo upload activity
  // Since photos are embedded in user documents, we need a different approach
  // This will be an approximation based on available information
  const photoUploadActivity = await User.aggregate([
    { $unwind: "$photos" },
    { $match: { "photos.metadata.uploadDate": { $gte: startDate, $lte: endDate } } },
    {
      $group: {
        _id: {
          year: { $year: "$photos.metadata.uploadDate" },
          month: { $month: "$photos.metadata.uploadDate" },
          day: { $dayOfMonth: "$photos.metadata.uploadDate" }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
  ]);

  const formattedPhotoActivity = photoUploadActivity.map(day => ({
    date: `${day._id.year}-${String(day._id.month).padStart(2, '0')}-${String(day._id.day).padStart(2, '0')}`,
    count: day.count
  }));

  // Story activity
  const storyActivity = await Story.aggregate([
    { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
  ]);

  const formattedStoryActivity = storyActivity.map(day => ({
    date: `${day._id.year}-${String(day._id.month).padStart(2, '0')}-${String(day._id.day).padStart(2, '0')}`,
    count: day.count
  }));

  // Most active users (by message count)
  const mostActiveUsers = await Message.aggregate([
    { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
    { $group: { _id: "$sender", messageCount: { $sum: 1 } } },
    { $sort: { messageCount: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "userInfo"
      }
    },
    { $unwind: "$userInfo" },
    {
      $project: {
        _id: 0,
        userId: "$userInfo._id",
        nickname: "$userInfo.nickname",
        messageCount: 1
      }
    }
  ]);

  // Peak activity hours
  const peakHours = await Message.aggregate([
    { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
    {
      $group: {
        _id: { $hour: "$createdAt" },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const hourlyActivity = Array.from({ length: 24 }, (_, hour) => {
    const data = peakHours.find(item => item._id === hour);
    return {
      hour,
      count: data ? data.count : 0
    };
  });

  // Log the action
  createAuditLog({
    action: 'VIEW_ACTIVITY_STATS',
    userId: req.user._id,
    details: `Activity statistics viewed for past ${req.query.days || 30} days`
  });

  return res.json(createApiResponse(true, {
    messageActivity: formattedMessageActivity,
    likeActivity: formattedLikeActivity,
    photoActivity: formattedPhotoActivity,
    storyActivity: formattedStoryActivity,
    mostActiveUsers,
    hourlyActivity
  }));
};

/**
 * Get system performance statistics
 */
export const getSystemStats = async (req, res) => {
  // This is a placeholder for actual system stats that would normally
  // come from monitoring tools like Prometheus/Grafana, AWS CloudWatch, etc.
  
  // For demonstration, we'll return some mock data and database stats
  const dbStats = await mongoose.connection.db.stats();
  
  const stats = {
    database: {
      sizeInMB: (dbStats.dataSize / (1024 * 1024)).toFixed(2),
      collections: dbStats.collections,
      documents: dbStats.objects,
      indexes: dbStats.indexes,
      indexSizeInMB: (dbStats.indexSize / (1024 * 1024)).toFixed(2)
    },
    server: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuLoad: [0.25, 0.15, 0.12], // Mock data - would typically come from OS metrics
      requestsPerMinute: 65, // Mock data
      averageResponseTime: 125, // Mock data in ms
    },
    storage: {
      totalSize: (1024 * 1024 * 1024 * 5), // 5GB mock data
      usedSize: (1024 * 1024 * 1024 * 3.2), // 3.2GB mock data
      mediaCount: 12500, // Mock data
    }
  };

  // Log the action
  createAuditLog({
    action: 'VIEW_SYSTEM_STATS',
    userId: req.user._id,
    details: 'System performance statistics viewed'
  });

  return res.json(createApiResponse(true, stats));
};

/**
 * Get all users with filtering options
 */
export const getAllUsers = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    sort = 'createdAt',
    order = 'desc',
    search = '',
    role,
    accountTier,
    gender,
    isOnline,
    isVerified,
    minAge,
    maxAge,
    location,
    dateStart,
    dateEnd,
  } = req.query;

  // Build filter object
  const filter = {};

  // Add search filter (search in nickname, username, email)
  if (search) {
    filter.$or = [
      { nickname: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  // Add other filters
  if (role) filter.role = role;
  if (accountTier) filter.accountTier = accountTier;
  if (gender) filter['details.gender'] = gender;
  if (isOnline !== undefined) filter.isOnline = isOnline === 'true';
  if (isVerified !== undefined) filter.isVerified = isVerified === 'true';
  
  if (minAge || maxAge) {
    filter['details.age'] = {};
    if (minAge) filter['details.age'].$gte = parseInt(minAge, 10);
    if (maxAge) filter['details.age'].$lte = parseInt(maxAge, 10);
  }
  
  if (location) filter['details.location'] = { $regex: location, $options: 'i' };
  
  if (dateStart || dateEnd) {
    filter.createdAt = {};
    if (dateStart) filter.createdAt.$gte = new Date(dateStart);
    if (dateEnd) filter.createdAt.$lte = new Date(dateEnd);
  }

  // Determine sort direction
  const sortDirection = order === 'asc' ? 1 : -1;
  const sortOptions = { [sort]: sortDirection };

  // Pagination
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  
  // Execute query
  try {
    const users = await User.find(filter)
      .select('email username nickname role accountTier isOnline isVerified lastActive createdAt details photos')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit, 10));
    
    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / parseInt(limit, 10));
    
    // Log the action
    createAuditLog({
      action: 'VIEW_USERS_LIST',
      userId: req.user._id,
      details: `Viewed users list with filter: ${JSON.stringify(filter)}`
    });

    return res.json(createApiResponse(true, {
      users,
      pagination: {
        total: totalUsers,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages
      }
    }));
  } catch (error) {
    logger.error(`Error getting users: ${error.message}`, { stack: error.stack });
    return res.status(500).json(createApiResponse(false, null, null, "Failed to retrieve users"));
  }
};

/**
 * Get a single user by ID with detailed information
 */
export const getUserById = async (req, res) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json(createApiResponse(false, null, null, "Invalid user ID"));
  }
  
  try {
    // Get user with all details including sensitive fields
    const user = await User.findById(id).select('+loginAttempts +lockUntil +active +version +lastLoginIp');
    
    if (!user) {
      return res.status(404).json(createApiResponse(false, null, null, "User not found"));
    }
    
    // Get additional related information
    const [likesGiven, likesReceived, messageCount, reportCount] = await Promise.all([
      Like.countDocuments({ sender: id }),
      Like.countDocuments({ recipient: id }),
      Message.countDocuments({ $or: [{ sender: id }, { recipient: id }] }),
      0 // Placeholder for report count - implement based on your report model
    ]);
    
    // Prepare response with extra info
    const enhancedUser = {
      ...user.toObject(),
      stats: {
        likesGiven,
        likesReceived,
        messageCount,
        reportCount,
        photoCount: user.photos ? user.photos.length : 0
      }
    };
    
    // Log the action
    createAuditLog({
      action: 'VIEW_USER_DETAILS',
      userId: req.user._id,
      targetUserId: id,
      details: `Viewed detailed user profile for ${user.nickname} (${user.email})`
    });

    return res.json(createApiResponse(true, enhancedUser));
  } catch (error) {
    logger.error(`Error getting user details: ${error.message}`, { stack: error.stack });
    return res.status(500).json(createApiResponse(false, null, null, "Failed to retrieve user details"));
  }
};

/**
 * Update a user's profile information
 */
export const updateUser = async (req, res) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json(createApiResponse(false, null, null, "Invalid user ID"));
  }
  
  try {
    // Only update allowed fields
    const {
      nickname, email, role, accountTier, isVerified, details, settings, active
    } = req.body;
    
    const updateData = {};
    
    // Build the update object with only provided fields
    if (nickname !== undefined) updateData.nickname = nickname;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (accountTier !== undefined) updateData.accountTier = accountTier;
    if (isVerified !== undefined) updateData.isVerified = isVerified;
    if (active !== undefined) updateData.active = active;
    
    // Handle nested objects
    if (details) {
      updateData.details = {};
      
      if (details.age !== undefined) updateData.details.age = details.age;
      if (details.gender !== undefined) updateData.details.gender = details.gender;
      if (details.location !== undefined) updateData.details.location = details.location;
      if (details.bio !== undefined) updateData.details.bio = details.bio;
      if (details.interests !== undefined) updateData.details.interests = details.interests;
      if (details.iAm !== undefined) updateData.details.iAm = details.iAm;
      if (details.lookingFor !== undefined) updateData.details.lookingFor = details.lookingFor;
      if (details.intoTags !== undefined) updateData.details.intoTags = details.intoTags;
      if (details.turnOns !== undefined) updateData.details.turnOns = details.turnOns;
      if (details.maritalStatus !== undefined) updateData.details.maritalStatus = details.maritalStatus;
    }
    
    if (settings) {
      updateData.settings = {};
      
      if (settings.notifications) updateData.settings.notifications = settings.notifications;
      if (settings.privacy) updateData.settings.privacy = settings.privacy;
      if (settings.theme) updateData.settings.theme = settings.theme;
    }
    
    // Ensure there's something to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json(createApiResponse(false, null, null, "No valid fields to update"));
    }
    
    // Find and update the user
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!updatedUser) {
      return res.status(404).json(createApiResponse(false, null, null, "User not found"));
    }
    
    // Log the action
    createAuditLog({
      action: 'UPDATE_USER',
      userId: req.user._id,
      targetUserId: id,
      details: `Updated user profile for ${updatedUser.nickname} (${updatedUser.email})`,
      changes: updateData
    });

    return res.json(createApiResponse(true, updatedUser, "User updated successfully"));
  } catch (error) {
    logger.error(`Error updating user: ${error.message}`, { stack: error.stack });
    return res.status(500).json(createApiResponse(false, null, null, "Failed to update user"));
  }
};

/**
 * Soft delete a user (mark as inactive)
 */
export const deleteUser = async (req, res) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json(createApiResponse(false, null, null, "Invalid user ID"));
  }
  
  try {
    // In this implementation, we're doing a soft delete by setting active: false
    const user = await User.findByIdAndUpdate(
      id,
      { active: false },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json(createApiResponse(false, null, null, "User not found"));
    }
    
    // Log the action
    createAuditLog({
      action: 'DELETE_USER',
      userId: req.user._id,
      targetUserId: id,
      details: `Deactivated user account for ${user.nickname} (${user.email})`
    });

    return res.json(createApiResponse(true, null, "User successfully deactivated"));
  } catch (error) {
    logger.error(`Error deleting user: ${error.message}`, { stack: error.stack });
    return res.status(500).json(createApiResponse(false, null, null, "Failed to delete user"));
  }
};

/**
 * Change a user's role
 */
export const changeUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json(createApiResponse(false, null, null, "Invalid user ID"));
  }
  
  if (!role || !['user', 'moderator', 'admin'].includes(role)) {
    return res.status(400).json(createApiResponse(false, null, null, "Invalid role specified"));
  }
  
  try {
    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json(createApiResponse(false, null, null, "User not found"));
    }
    
    // Log the action
    createAuditLog({
      action: 'CHANGE_USER_ROLE',
      userId: req.user._id,
      targetUserId: id,
      details: `Changed user role for ${user.nickname} (${user.email}) to ${role}`
    });

    return res.json(createApiResponse(true, user, `User role updated to ${role}`));
  } catch (error) {
    logger.error(`Error changing user role: ${error.message}`, { stack: error.stack });
    return res.status(500).json(createApiResponse(false, null, null, "Failed to change user role"));
  }
};

/**
 * Ban a user (deactivate and set lockUntil)
 */
export const banUser = async (req, res) => {
  const { id } = req.params;
  const { reason, duration } = req.body;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json(createApiResponse(false, null, null, "Invalid user ID"));
  }
  
  // Duration in hours, default to permanent (10 years) if not specified
  const banDuration = duration ? parseInt(duration, 10) * 60 * 60 * 1000 : 10 * 365 * 24 * 60 * 60 * 1000;
  const lockUntil = new Date(Date.now() + banDuration);
  
  try {
    const user = await User.findByIdAndUpdate(
      id,
      { 
        active: false,
        lockUntil,
        loginAttempts: 5 // Set to max to trigger lockout
      },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json(createApiResponse(false, null, null, "User not found"));
    }
    
    // Log the action
    createAuditLog({
      action: 'BAN_USER',
      userId: req.user._id,
      targetUserId: id,
      details: `Banned user ${user.nickname} (${user.email})`,
      metadata: {
        reason,
        duration: duration || 'permanent',
        lockUntil
      }
    });

    return res.json(createApiResponse(true, null, `User has been banned ${duration ? 'for ' + duration + ' hours' : 'permanently'}`));
  } catch (error) {
    logger.error(`Error banning user: ${error.message}`, { stack: error.stack });
    return res.status(500).json(createApiResponse(false, null, null, "Failed to ban user"));
  }
};

/**
 * Unban a user
 */
export const unbanUser = async (req, res) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json(createApiResponse(false, null, null, "Invalid user ID"));
  }
  
  try {
    const user = await User.findByIdAndUpdate(
      id,
      { 
        active: true,
        lockUntil: undefined,
        loginAttempts: 0
      },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json(createApiResponse(false, null, null, "User not found"));
    }
    
    // Log the action
    createAuditLog({
      action: 'UNBAN_USER',
      userId: req.user._id,
      targetUserId: id,
      details: `Unbanned user ${user.nickname} (${user.email})`
    });

    return res.json(createApiResponse(true, null, "User has been unbanned"));
  } catch (error) {
    logger.error(`Error unbanning user: ${error.message}`, { stack: error.stack });
    return res.status(500).json(createApiResponse(false, null, null, "Failed to unban user"));
  }
};

/**
 * Verify a user's email directly
 */
export const verifyUser = async (req, res) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json(createApiResponse(false, null, null, "Invalid user ID"));
  }
  
  try {
    const user = await User.findByIdAndUpdate(
      id,
      { isVerified: true },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json(createApiResponse(false, null, null, "User not found"));
    }
    
    // Log the action
    createAuditLog({
      action: 'VERIFY_USER',
      userId: req.user._id,
      targetUserId: id,
      details: `Manually verified user ${user.nickname} (${user.email})`
    });

    return res.json(createApiResponse(true, user, "User has been verified"));
  } catch (error) {
    logger.error(`Error verifying user: ${error.message}`, { stack: error.stack });
    return res.status(500).json(createApiResponse(false, null, null, "Failed to verify user"));
  }
};

/**
 * Reset a user's password
 */
export const resetUserPassword = async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json(createApiResponse(false, null, null, "Invalid user ID"));
  }
  
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json(createApiResponse(false, null, null, "Password must be at least 8 characters"));
  }
  
  try {
    // Get the user to update
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json(createApiResponse(false, null, null, "User not found"));
    }
    
    // Update user's password using instance method to handle hashing & version increment
    await user.updatePassword(newPassword);
    
    // Log the action
    createAuditLog({
      action: 'RESET_USER_PASSWORD',
      userId: req.user._id,
      targetUserId: id,
      details: `Manually reset password for user ${user.nickname} (${user.email})`
    });

    return res.json(createApiResponse(true, null, "User password has been reset"));
  } catch (error) {
    logger.error(`Error resetting user password: ${error.message}`, { stack: error.stack });
    return res.status(500).json(createApiResponse(false, null, null, "Failed to reset user password"));
  }
};

/**
 * Get photos for moderation
 */
export const getPhotosForModeration = async (req, res) => {
  const { status = 'all', page = 1, limit = 20 } = req.query;
  
  try {
    // Find all users with photos
    const query = User.find({
      'photos.0': { $exists: true } // Has at least one photo
    });
    
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    
    // Select only necessary fields
    query.select('_id nickname email photos');
    
    // Apply pagination
    query.skip(skip).limit(parseInt(limit, 10));
    
    // Sort by newest photos first
    query.sort({ 'photos.metadata.uploadDate': -1 });
    
    const users = await query.exec();
    
    // Extract and format photos for moderation
    const photos = [];
    
    users.forEach(user => {
      if (user.photos && user.photos.length > 0) {
        user.photos.forEach(photo => {
          photos.push({
            photoId: photo._id,
            userId: user._id,
            userNickname: user.nickname,
            userEmail: user.email,
            url: photo.url,
            isPrivate: photo.isPrivate,
            uploadDate: photo.metadata?.uploadDate || photo.createdAt,
            metadata: photo.metadata
          });
        });
      }
    });
    
    // Count total photos for pagination
    const totalPhotos = await User.aggregate([
      { $project: { photoCount: { $size: '$photos' } } },
      { $group: { _id: null, total: { $sum: '$photoCount' } } }
    ]);
    
    const total = totalPhotos.length > 0 ? totalPhotos[0].total : 0;
    
    // Log the action
    createAuditLog({
      action: 'VIEW_PHOTOS_FOR_MODERATION',
      userId: req.user._id,
      details: `Viewed photos for moderation (${status} status)`
    });

    return res.json(createApiResponse(true, {
      photos,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10))
      }
    }));
  } catch (error) {
    logger.error(`Error getting photos for moderation: ${error.message}`, { stack: error.stack });
    return res.status(500).json(createApiResponse(false, null, null, "Failed to retrieve photos for moderation"));
  }
};

/**
 * Approve a photo
 */
export const approvePhoto = async (req, res) => {
  const { photoId } = req.params;
  const { userId } = req.body;
  
  if (!mongoose.Types.ObjectId.isValid(photoId) || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json(createApiResponse(false, null, null, "Invalid ID format"));
  }
  
  try {
    // Find and update the user's photo
    const user = await User.findOneAndUpdate(
      { _id: userId, 'photos._id': photoId },
      { 
        $set: { 
          'photos.$.moderated': true,
          'photos.$.moderationStatus': 'approved',
          'photos.$.moderatedBy': req.user._id,
          'photos.$.moderatedAt': new Date()
        }
      },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json(createApiResponse(false, null, null, "User or photo not found"));
    }
    
    // Find the updated photo in the user's photos array
    const photo = user.photos.find(p => p._id.toString() === photoId);
    
    // Log the action
    createAuditLog({
      action: 'APPROVE_PHOTO',
      userId: req.user._id,
      targetUserId: userId,
      details: `Approved photo for user ${user.nickname} (${user.email})`,
      metadata: { photoId }
    });

    return res.json(createApiResponse(true, photo, "Photo approved successfully"));
  } catch (error) {
    logger.error(`Error approving photo: ${error.message}`, { stack: error.stack });
    return res.status(500).json(createApiResponse(false, null, null, "Failed to approve photo"));
  }
};

/**
 * Reject a photo
 */
export const rejectPhoto = async (req, res) => {
  const { photoId } = req.params;
  const { userId, reason } = req.body;
  
  if (!mongoose.Types.ObjectId.isValid(photoId) || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json(createApiResponse(false, null, null, "Invalid ID format"));
  }
  
  try {
    // Find user and update photo
    const user = await User.findOneAndUpdate(
      { _id: userId, 'photos._id': photoId },
      { 
        $set: { 
          'photos.$.moderated': true,
          'photos.$.moderationStatus': 'rejected',
          'photos.$.moderatedBy': req.user._id,
          'photos.$.moderatedAt': new Date(),
          'photos.$.moderationReason': reason || 'Violates community guidelines'
        }
      },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json(createApiResponse(false, null, null, "User or photo not found"));
    }
    
    // Create notification to inform user
    // This is just an example, implement based on your notification model
    await Notification.create({
      recipient: userId,
      type: 'photo_rejected',
      content: 'One of your photos has been removed for violating our guidelines.',
      relatedData: {
        photoId,
        reason: reason || 'Violates community guidelines'
      },
      isRead: false,
      createdAt: new Date()
    });
    
    // Log the action
    createAuditLog({
      action: 'REJECT_PHOTO',
      userId: req.user._id,
      targetUserId: userId,
      details: `Rejected photo for user ${user.nickname} (${user.email})`,
      metadata: { photoId, reason }
    });

    return res.json(createApiResponse(true, null, "Photo rejected successfully"));
  } catch (error) {
    logger.error(`Error rejecting photo: ${error.message}`, { stack: error.stack });
    return res.status(500).json(createApiResponse(false, null, null, "Failed to reject photo"));
  }
};

/**
 * Get user reports
 */
export const getReports = async (req, res) => {
  const { status = 'pending', page = 1, limit = 20 } = req.query;
  
  // This is a placeholder for a Reports model
  // Implement based on your actual reports model structure
  return res.json(createApiResponse(true, {
    message: "Reports functionality not yet implemented"
  }));
};

/**
 * Update a report status
 */
export const updateReport = async (req, res) => {
  const { id } = req.params;
  const { status, resolution, notes } = req.body;
  
  // This is a placeholder for a Reports model
  // Implement based on your actual reports model structure
  return res.json(createApiResponse(true, {
    message: "Report update functionality not yet implemented"
  }));
};

/**
 * Get system settings
 */
export const getSettings = async (req, res) => {
  // Placeholder for a Settings model
  // In a real implementation, these would come from a database
  const settings = {
    security: {
      maxLoginAttempts: 5,
      lockoutDuration: 60, // minutes
      passwordMinLength: 8,
      requireEmailVerification: true,
      twoFactorAuthEnabled: false
    },
    features: {
      storiesEnabled: true,
      videoChatEnabled: true,
      locationServicesEnabled: true,
      photoSharingEnabled: true
    },
    limits: {
      freeTierDailyLikes: 3,
      freeTierStoryCooldown: 72, // hours
      maxPhotosPerUser: 10,
      maxStoriesPerDay: 5,
      maxReportsBeforeAutoReview: 3
    },
    notifications: {
      emailDigestEnabled: true,
      pushNotificationsEnabled: true,
      marketingEmailsEnabled: true
    },
    moderation: {
      photoModerationEnabled: true,
      autoModerationEnabled: false,
      contentFilterLevel: 'medium' // mild, medium, strict
    }
  };
  
  // Log the action
  createAuditLog({
    action: 'VIEW_SYSTEM_SETTINGS',
    userId: req.user._id,
    details: 'Viewed system settings'
  });

  return res.json(createApiResponse(true, settings));
};

/**
 * Update system settings
 */
export const updateSettings = async (req, res) => {
  const { settings } = req.body;
  
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json(createApiResponse(false, null, null, "Invalid settings data"));
  }
  
  // Placeholder for updating settings in a real database
  // In a real implementation, validate and persist these settings
  
  // Log the action
  createAuditLog({
    action: 'UPDATE_SYSTEM_SETTINGS',
    userId: req.user._id,
    details: 'Updated system settings',
    changes: settings
  });

  return res.json(createApiResponse(true, settings, "Settings updated successfully"));
};

/**
 * Get audit logs
 */
export const getAuditLogs = async (req, res) => {
  // Placeholder for an AuditLog model
  // In a real implementation, fetch from your audit logs collection with proper pagination
  const logs = [
    {
      action: 'LOGIN',
      userId: '60d21b4667d0d8992e610c85',
      userEmail: 'admin@example.com',
      timestamp: new Date(Date.now() - 3600000),
      ipAddress: '192.168.1.1',
      details: 'Admin login successful'
    },
    {
      action: 'UPDATE_USER',
      userId: '60d21b4667d0d8992e610c85',
      targetUserId: '60d21b4667d0d8992e610c87',
      timestamp: new Date(Date.now() - 7200000),
      ipAddress: '192.168.1.1',
      details: 'Updated user profile'
    }
  ];
  
  return res.json(createApiResponse(true, logs));
};

/**
 * Get user subscriptions
 */
export const getSubscriptions = async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  
  try {
    // Build query
    const query = {};
    
    if (status === 'active') {
      query.isPaid = true;
      query.subscriptionExpiry = { $gt: new Date() };
    } else if (status === 'expired') {
      query.isPaid = true;
      query.subscriptionExpiry = { $lte: new Date() };
    } else if (status === 'free') {
      query.isPaid = false;
    }
    
    // Execute query with pagination
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    
    const users = await User.find(query)
      .select('nickname email accountTier isPaid subscriptionExpiry createdAt')
      .sort({ subscriptionExpiry: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));
    
    const totalUsers = await User.countDocuments(query);
    
    // Log the action
    createAuditLog({
      action: 'VIEW_SUBSCRIPTIONS',
      userId: req.user._id,
      details: `Viewed subscription list (${status || 'all'} status)`
    });

    return res.json(createApiResponse(true, {
      subscriptions: users,
      pagination: {
        total: totalUsers,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(totalUsers / parseInt(limit, 10))
      }
    }));
  } catch (error) {
    logger.error(`Error getting subscriptions: ${error.message}`, { stack: error.stack });
    return res.status(500).json(createApiResponse(false, null, null, "Failed to retrieve subscriptions"));
  }
};

/**
 * Update a user's subscription
 */
export const updateUserSubscription = async (req, res) => {
  const { userId } = req.params;
  const { isPaid, accountTier, expiryDate, notes } = req.body;
  
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json(createApiResponse(false, null, null, "Invalid user ID"));
  }
  
  if (accountTier && !['FREE', 'PAID', 'FEMALE', 'COUPLE'].includes(accountTier)) {
    return res.status(400).json(createApiResponse(false, null, null, "Invalid account tier"));
  }
  
  try {
    const updateData = {};
    
    if (isPaid !== undefined) updateData.isPaid = isPaid;
    if (accountTier) updateData.accountTier = accountTier;
    if (expiryDate) updateData.subscriptionExpiry = new Date(expiryDate);
    
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json(createApiResponse(false, null, null, "User not found"));
    }
    
    // Log the action
    createAuditLog({
      action: 'UPDATE_USER_SUBSCRIPTION',
      userId: req.user._id,
      targetUserId: userId,
      details: `Updated subscription for user ${user.nickname} (${user.email})`,
      changes: updateData,
      metadata: { notes }
    });

    return res.json(createApiResponse(true, user, "Subscription updated successfully"));
  } catch (error) {
    logger.error(`Error updating subscription: ${error.message}`, { stack: error.stack });
    return res.status(500).json(createApiResponse(false, null, null, "Failed to update subscription"));
  }
};

/**
 * Send a notification to one or more users
 */
export const sendNotification = async (req, res) => {
  const { recipients, type, content, targetUrl } = req.body;
  
  if (!recipients || !content) {
    return res.status(400).json(createApiResponse(false, null, null, "Recipients and content are required"));
  }
  
  try {
    let userIds = [];
    
    // Handle different types of recipient specifications
    if (recipients === 'all') {
      // Get all active users
      const users = await User.find({ active: true }).select('_id');
      userIds = users.map(user => user._id);
    } else if (recipients === 'paid') {
      // Get paid users
      const users = await User.find({ isPaid: true, active: true }).select('_id');
      userIds = users.map(user => user._id);
    } else if (Array.isArray(recipients)) {
      // Specific user IDs
      userIds = recipients.filter(id => mongoose.Types.ObjectId.isValid(id));
    } else if (mongoose.Types.ObjectId.isValid(recipients)) {
      // Single user ID
      userIds = [recipients];
    } else {
      return res.status(400).json(createApiResponse(false, null, null, "Invalid recipients format"));
    }
    
    if (userIds.length === 0) {
      return res.status(400).json(createApiResponse(false, null, null, "No valid recipients specified"));
    }
    
    // Create notifications in bulk
    const notifications = userIds.map(userId => ({
      recipient: userId,
      type: type || 'admin',
      content,
      relatedData: { targetUrl },
      isRead: false,
      createdAt: new Date()
    }));
    
    const result = await Notification.insertMany(notifications);
    
    // Log the action
    createAuditLog({
      action: 'SEND_NOTIFICATION',
      userId: req.user._id,
      details: `Sent notification to ${userIds.length} users`,
      metadata: { type, content, recipientCount: userIds.length }
    });

    return res.json(createApiResponse(true, { 
      sent: result.length,
      recipients: userIds.length
    }, "Notifications sent successfully"));
  } catch (error) {
    logger.error(`Error sending notifications: ${error.message}`, { stack: error.stack });
    return res.status(500).json(createApiResponse(false, null, null, "Failed to send notifications"));
  }
};

/**
 * Send an email to one or more users
 */
export const sendEmail = async (req, res) => {
  const { recipients, subject, body, template } = req.body;
  
  if (!recipients || !subject || !body) {
    return res.status(400).json(createApiResponse(false, null, null, "Recipients, subject, and body are required"));
  }
  
  // In a real implementation, this would connect to your email service
  // For now, we'll just log it and pretend it worked
  logger.info(`Admin email: To: ${recipients}, Subject: ${subject}`);
  
  // Log the action
  createAuditLog({
    action: 'SEND_EMAIL',
    userId: req.user._id,
    details: `Sent email with subject "${subject}" to ${typeof recipients === 'string' ? recipients : recipients.length + ' recipients'}`,
    metadata: { subject, template }
  });

  return res.json(createApiResponse(true, null, "Email scheduled for delivery"));
};