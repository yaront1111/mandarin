const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');
const auth = require('../middlewares/auth');

router.post('/like', auth, matchController.likeUser);
router.get('/', auth, matchController.getMatches);

module.exports = router;
