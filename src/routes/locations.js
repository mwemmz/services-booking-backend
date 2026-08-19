const router = require('express').Router();
const {
  updateProviderLocation,
  getBookingLocationHistory,
  calculateDistance,
} = require('../controllers/locationController');
const { authenticate, authorize } = require('../middleware/auth');

router.put('/provider', authenticate, authorize('provider'), updateProviderLocation);
router.get('/booking/:bookingId', authenticate, getBookingLocationHistory);
router.post('/calculate-distance', calculateDistance);

module.exports = router;
