// routes/moderationRoutes.js
const express = require('express');
const router = express.Router();
const { reportUser, getReports, resolveReport } = require('../controllers/moderationController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/reports', protect, reportUser);
router.get('/reports', protect, getReports);
router.post('/reports/:reportId/resolve', protect, resolveReport);

module.exports = router;
