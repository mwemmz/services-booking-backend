const router = require('express').Router();
const { uuidParam } = require('../utils/uuid');
const {
  initializePayment,
  verifyPayment,
  getBookingPayments,
  handleWebhook,
} = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');

router.param('bookingId', uuidParam('bookingId'));

router.post('/initialize', authenticate, initializePayment);
router.post('/verify', authenticate, verifyPayment);
router.post('/webhook', handleWebhook);
router.get('/booking/:bookingId', authenticate, getBookingPayments);

module.exports = router;
