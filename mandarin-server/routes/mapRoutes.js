const express = require('express');
const router = express.Router();
const { getNearbyUsers } = require('../controllers/mapController');
const { protect } = require('../middlewares/authMiddleware');

// GET /api/map/nearby
router.get('/nearby', protect, getNearbyUsers);

module.exports = router;
