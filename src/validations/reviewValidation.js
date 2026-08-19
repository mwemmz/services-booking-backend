const { body } = require('express-validator');

const createReviewRules = [
  body('booking_id').notEmpty().withMessage('Booking ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be an integer between 1 and 5'),
  body('comment').optional().notEmpty().withMessage('Comment cannot be empty'),
];

module.exports = {
  createReviewRules,
};
