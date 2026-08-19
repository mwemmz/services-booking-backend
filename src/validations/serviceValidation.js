const { body } = require('express-validator');

const createServiceRules = [
  body('name').notEmpty().withMessage('Service name is required'),
  body('price').isFloat({ gt: 0 }).withMessage('Price must be a number greater than 0'),
  body('duration').isInt({ gt: 0 }).withMessage('Duration must be an integer greater than 0'),
  body('category').notEmpty().withMessage('Category is required'),
];

const updateServiceRules = [
  body('name').optional().notEmpty().withMessage('Service name cannot be empty'),
  body('price').optional().isFloat({ gt: 0 }).withMessage('Price must be a number greater than 0'),
  body('duration').optional().isInt({ gt: 0 }).withMessage('Duration must be an integer greater than 0'),
];

module.exports = {
  createServiceRules,
  updateServiceRules,
};
