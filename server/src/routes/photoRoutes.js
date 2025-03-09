// server/src/routes/photoRoutes.js
const express = require('express');
const router = express.Router();
const photoController = require('../controllers/photoController');
const auth = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// Access Requests routes
router.get('/access-requests', auth, photoController.getPhotoAccessRequests);
router.post('/request-access', auth, photoController.requestPhotoAccess);
router.post('/grant-access', auth, photoController.grantPhotoAccess);
router.post('/reject-access', auth, photoController.rejectPhotoAccess);

// Photo management routes
router.get('/', auth, photoController.getCurrentUserPhotos);
router.post('/', auth, upload.single('photo'), photoController.uploadPhoto);
router.get('/:userId', auth, photoController.getUserPhotos);
router.put('/:id', auth, photoController.updatePhoto);
router.delete('/:id', auth, photoController.deletePhoto);

// Photo order management
router.put('/order', auth, photoController.updatePhotoOrder);

module.exports = router;
