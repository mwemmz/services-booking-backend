const router = require('express').Router();
const {
  requestEndorsement,
  getMyPendingEndorsements,
  confirmEndorsement,
  declineEndorsement,
  getEndorsementForBooking,
} = require('../controllers/endorsementController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/pending', authenticate, authorize('provider'), getMyPendingEndorsements);
router.post('/request/:bookingId', authenticate, authorize('provider'), requestEndorsement);
router.get('/booking/:bookingId', authenticate, getEndorsementForBooking);
router.post('/:id/confirm', authenticate, authorize('provider'), confirmEndorsement);
router.post('/:id/decline', authenticate, authorize('provider'), declineEndorsement);

module.exports = router;