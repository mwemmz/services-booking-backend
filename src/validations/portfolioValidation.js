const { body } = require('express-validator');

const createPortfolioRules = [
  body('image_url').trim().notEmpty().withMessage('An image URL is required'),
  body('caption').optional({ nullable: true }).trim().isLength({ max: 140 }).withMessage('Caption must be 140 characters or fewer'),
  body('sort_order').optional().isInt({ min: 0 }).withMessage('sort_order must be zero or greater'),
];

const updatePortfolioRules = [
  body('image_url').optional().trim().notEmpty().withMessage('An image URL is required'),
  body('caption').optional({ nullable: true }).trim().isLength({ max: 140 }).withMessage('Caption must be 140 characters or fewer'),
  body('sort_order').optional().isInt({ min: 0 }).withMessage('sort_order must be zero or greater'),
];

module.exports = {
  createPortfolioRules,
  updatePortfolioRules,
};