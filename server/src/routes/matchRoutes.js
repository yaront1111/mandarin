const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');
const auth = require('../middlewares/auth');

// Basic match routes
router.post('/like', auth, matchController.likeUser);
router.get('/', auth, matchController.getMatches);

// New routes for mutual and potential matches
router.get('/mutual', auth, matchController.getMutualMatches);
router.get('/potential', auth, matchController.getPotentialMatches);

// Additional routes for management
router.delete('/:id', auth, matchController.unmatchUser);
router.post('/block', auth, matchController.blockUser);
router.post('/report', auth, matchController.reportUser);

module.exports = router;
