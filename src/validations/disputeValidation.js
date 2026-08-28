const { body } = require('express-validator');

exports.createDisputeRules = [
  body('booking_id').notEmpty().isUUID().withMessage('booking_id must be a valid UUID'),
  body('type').optional().isIn(['dispute', 'safety']).withMessage('type must be dispute or safety'),
  body('reason').notEmpty().withMessage('reason is required'),
  body('description').optional().isString(),
];

exports.resolveDisputeRules = [
  body('status').isIn(['open', 'resolved', 'closed']).withMessage('status must be open, resolved, or closed'),
  body('resolution_note').optional().isString(),
];