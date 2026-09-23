const router = require('express').Router();
const { uuidParam } = require('../utils/uuid');
const {
  updateProviderLocation,
  getBookingLocationHistory,
  calculateDistance,
} = require('../controllers/locationController');
const { authenticate, authorize } = require('../middleware/auth');

router.param('bookingId', uuidParam('bookingId'));

router.put('/provider', authenticate, authorize('provider'), updateProviderLocation);
router.get('/booking/:bookingId', authenticate, getBookingLocationHistory);
router.post('/calculate-distance', calculateDistance);

module.exports = router;
