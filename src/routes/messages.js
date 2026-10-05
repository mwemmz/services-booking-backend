const router = require('express').Router();
const { uuidParam } = require('../utils/uuid');
const {
  getOrCreate,
  listConversations,
  listMessages,
  sendMessage,
} = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');

router.param('id', uuidParam('id'));
router.param('bookingId', uuidParam('bookingId'));

// Get-or-create the conversation for a booking (must be mounted before generic routes).
router.get('/conversations/booking/:bookingId', authenticate, getOrCreate);
router.get('/conversations', authenticate, listConversations);
router.get('/conversations/:id/messages', authenticate, listMessages);
router.post('/conversations/:id/messages', authenticate, sendMessage);

module.exports = router;