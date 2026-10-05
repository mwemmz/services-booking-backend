const { body } = require('express-validator');

const createBookingRules = [
  body('provider_id').notEmpty().withMessage('Provider ID is required'),
  body('service_id').notEmpty().withMessage('Service ID is required'),
  body('booking_time').isISO8601().withMessage('A valid ISO 8601 date is required'),
  body('address').optional().notEmpty().withMessage('Address cannot be empty'),
  body('crew_id').optional().isUUID().withMessage('crew_id must be a valid UUID'),
];

const BOOKING_STATUSES = [
  'pending', 'assigned', 'accepted', 'rejected',
  'on_the_way', 'arrived', 'in-progress',
  'completed', 'paid', 'cancelled', 'expired',
];

const updateStatusRules = [
  body('status')
    .isIn(BOOKING_STATUSES)
    .withMessage(`Status must be one of: ${BOOKING_STATUSES.join(', ')}`),
];

module.exports = {
  createBookingRules,
  updateStatusRules,
};
