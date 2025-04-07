// adminRoutes.js - Routes for admin dashboard functionality
import express from "express";
import { protect, restrictTo, asyncHandler } from "../middleware/auth.js";
import * as adminController from "../controllers/adminController.js";

const router = express.Router();

// Apply protection and admin-only restriction to all routes
router.use(protect);
router.use(restrictTo("admin"));

// Dashboard and analytics
router.get("/stats/overview", asyncHandler(adminController.getOverviewStats));
router.get("/stats/users", asyncHandler(adminController.getUserStats));
router.get("/stats/activity", asyncHandler(adminController.getActivityStats));
router.get("/stats/system", asyncHandler(adminController.getSystemStats));
router.get("/stats/content", asyncHandler(adminController.getContentStats));
router.get("/stats/messaging", asyncHandler(adminController.getMessagingStats));

// User management
router.get("/users", asyncHandler(adminController.getAllUsers));
router.get("/users/:id", asyncHandler(adminController.getUserById));
router.put("/users/:id", asyncHandler(adminController.updateUser));
router.delete("/users/:id", asyncHandler(adminController.deleteUser));
router.post("/users/:id/role", asyncHandler(adminController.changeUserRole));
router.post("/users/:id/ban", asyncHandler(adminController.banUser));
router.post("/users/:id/unban", asyncHandler(adminController.unbanUser));
router.post("/users/:id/verify", asyncHandler(adminController.verifyUser));
router.post("/users/:id/password-reset", asyncHandler(adminController.resetUserPassword));

// Content moderation
router.get("/moderation/photos", asyncHandler(adminController.getPhotosForModeration));
router.post("/moderation/photos/:photoId/approve", asyncHandler(adminController.approvePhoto));
router.post("/moderation/photos/:photoId/reject", asyncHandler(adminController.rejectPhoto));

router.get("/moderation/reports", asyncHandler(adminController.getReports));
router.put("/moderation/reports/:id", asyncHandler(adminController.updateReport));

// Configuration and settings
router.get("/settings", asyncHandler(adminController.getSettings));
router.put("/settings", asyncHandler(adminController.updateSettings));

// Audit and logs
router.get("/audit-logs", asyncHandler(adminController.getAuditLogs));

// Subscription management
router.get("/subscriptions", asyncHandler(adminController.getSubscriptions));
router.post("/subscriptions/:userId", asyncHandler(adminController.updateUserSubscription));

// Communication
router.post("/notifications", asyncHandler(adminController.sendNotification));
router.post("/email", asyncHandler(adminController.sendEmail));

export default router;