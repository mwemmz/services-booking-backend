const { body } = require('express-validator');

const idRule = (field) =>
  body(field).isUUID().withMessage(`${field} must be a valid UUID`);

const createBookingRules = [
  idRule('provider_id'),
  idRule('service_id'),
  body('booking_time').isISO8601().withMessage('A valid ISO 8601 date is required'),
  body('address').optional().notEmpty().withMessage('Address cannot be empty'),
  idRule('crew_id').optional(),
];

const updateStatusRules = [
  body('status')
    .isIn(['pending', 'assigned', 'accepted', 'rejected', 'in-progress', 'completed', 'paid', 'cancelled'])
    .withMessage('Status must be one of: pending, assigned, accepted, rejected, in-progress, completed, paid, cancelled'),
];

module.exports = {
  createBookingRules,
  updateStatusRules,
};
