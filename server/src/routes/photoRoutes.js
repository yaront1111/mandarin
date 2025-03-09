// server/src/routes/photoRoutes.js
const express = require('express');
const router = express.Router();
const photoController = require('../controllers/photoController');
const auth = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// 1) Access Requests routes:
router.get('/access-requests', auth, photoController.getPhotoAccessRequests);
router.post('/request-access', auth, photoController.requestPhotoAccess);
router.post('/grant-access', auth, photoController.grantPhotoAccess);
router.post('/reject-access', auth, photoController.rejectPhotoAccess);

// 2) Your new route for current user’s photos:
router.get('/', auth, photoController.getCurrentUserPhotos);

// 3) Existing routes for user photos and deleting by photo ID:
router.post('/', auth, upload.single('photo'), photoController.uploadPhoto);
router.get('/:userId', auth, photoController.getUserPhotos);
router.delete('/:id', auth, photoController.deletePhoto);

module.exports = router;
