const router = require('express').Router();
const { uuidParam } = require('../utils/uuid');
const {
  createBooking,
  getAllBookings,
  getBookingById,
  updateBookingStatus,
  rejectBooking,
  confirmQuote,
  cancelBooking,
  getCustomerBookings,
  getProviderBookings,
  getWorkHistory,
  checkAvailabilityEndpoint,
  getProviderSlots,
  rebookBooking,
} = require('../controllers/bookingController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createBookingRules,
  updateStatusRules,
} = require('../validations/bookingValidation');

router.param('id', uuidParam('id'));
router.param('customerId', uuidParam('customerId'));
router.param('providerId', uuidParam('providerId'));

router.post('/', authenticate, [...createBookingRules, validate], createBooking);
router.get('/available', checkAvailabilityEndpoint);
router.get('/slots', getProviderSlots);
router.get('/', authenticate, getAllBookings);
router.get('/customer/:customerId', authenticate, getCustomerBookings);
router.get('/provider/:providerId', authenticate, getProviderBookings);
router.get('/provider/:providerId/work-history', authenticate, getWorkHistory);
router.get('/:id', authenticate, getBookingById);
router.put('/:id/status', authenticate, [...updateStatusRules, validate], updateBookingStatus);
router.put('/:id/reject', authenticate, authorize('provider'), rejectBooking);
router.put('/:id/confirm-quote', authenticate, authorize('customer'), confirmQuote);
router.put('/:id/cancel', authenticate, cancelBooking);
router.post('/:id/rebook', authenticate, rebookBooking);

module.exports = router;
