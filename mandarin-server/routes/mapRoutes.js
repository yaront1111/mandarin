// routes/mapRoutes.js
const express = require('express');
const router = express.Router();
const { getNearbyUsers } = require('../controllers/mapController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/nearby', protect, getNearbyUsers);

module.exports = router;
