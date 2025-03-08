const express = require('express');
const router = express.Router();
const {
  reportUser,
  getReports,
  resolveReport
} = require('../controllers/moderationController');
const { protect } = require('../middlewares/authMiddleware');

// POST /api/moderation/reports (body: { userId, reason, details })
router.post('/reports', protect, reportUser);

// GET /api/moderation/reports
router.get('/reports', protect, getReports);

// POST /api/moderation/reports/:reportId/resolve (body: { action })
router.post('/reports/:reportId/resolve', protect, resolveReport);

module.exports = router;
