// Test routes for development and debugging
import express from "express";
import { protect } from "../middleware/auth.js";
import { testEmailConfiguration } from "../utils/unifiedEmailService.js";
import config from "../config.js";
import logger from "../logger.js";

const router = express.Router();
const log = logger.child({ component: "TestRoutes" });

// Only enable test routes in development or with explicit permission
if (config.NODE_ENV === "development" || process.env.ENABLE_TEST_ROUTES === "true") {
  
  /**
   * @route   POST /api/test/email
   * @desc    Test email configuration
   * @access  Private (admin only in production)
   */
  router.post("/email", protect, async (req, res) => {
    try {
      // In production, require admin role
      if (config.NODE_ENV === "production" && req.user.role !== "admin") {
        return res.status(403).json({ 
          success: false, 
          error: "Admin access required" 
        });
      }
      
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          success: false, 
          error: "Email address required" 
        });
      }
      
      log.info(`Testing email configuration with ${email}`);
      
      const result = await testEmailConfiguration(email);
      
      res.json({
        success: true,
        message: "Test email sent successfully",
        emailService: config.USE_RESEND ? "Resend" : "Nodemailer",
        ...result
      });
      
    } catch (error) {
      log.error(`Email test failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
        emailService: config.USE_RESEND ? "Resend" : "Nodemailer"
      });
    }
  });
  
  /**
   * @route   GET /api/test/config
   * @desc    Get current email configuration (without sensitive data)
   * @access  Private (admin only in production)
   */
  router.get("/config", protect, async (req, res) => {
    // In production, require admin role
    if (config.NODE_ENV === "production" && req.user.role !== "admin") {
      return res.status(403).json({ 
        success: false, 
        error: "Admin access required" 
      });
    }
    
    res.json({
      success: true,
      config: {
        environment: config.NODE_ENV,
        emailService: config.USE_RESEND ? "Resend" : "Nodemailer",
        emailFrom: config.EMAIL_FROM,
        appName: config.APP_NAME,
        appUrl: config.APP_URL,
        appDomain: config.APP_DOMAIN,
        resendConfigured: !!config.RESEND_API_KEY,
        nodemailerConfigured: !!(config.EMAIL_USER && config.EMAIL_PASSWORD)
      }
    });
  });
  
} else {
  // In production without explicit permission, return 404 for all test routes
  router.use("*", (req, res) => {
    res.status(404).json({ success: false, error: "Not found" });
  });
}

export default router;