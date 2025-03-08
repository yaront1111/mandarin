const express = require('express');
const router = express.Router();
const photoController = require('../controllers/photoController');
const auth = require('../middlewares/auth');
const upload = require('../middlewares/upload');

router.post('/', auth, upload.single('photo'), photoController.uploadPhoto);
router.get('/:userId', auth, photoController.getUserPhotos);
router.delete('/:id', auth, photoController.deletePhoto);

module.exports = router;
