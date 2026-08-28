const router = require('express').Router();
const {
  uploadImage,
  uploadProviderImage,
  uploadServiceImage,
} = require('../controllers/uploadController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/image', authenticate, uploadImage);
router.post('/provider', authenticate, authorize('provider'), uploadProviderImage);
router.post('/service', authenticate, authorize('provider'), uploadServiceImage);

module.exports = router;
