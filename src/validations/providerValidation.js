const { body } = require('express-validator');

const registerProviderRules = [
  body('business_name').notEmpty().withMessage('Business name is required'),
  body('description').optional().notEmpty().withMessage('Description cannot be empty'),
  body('category').optional().notEmpty().withMessage('Category cannot be empty'),
];

const updateProviderRules = [
  body('business_name').optional().notEmpty().withMessage('Business name cannot be empty'),
  body('description').optional().notEmpty().withMessage('Description cannot be empty'),
  body('category').optional().notEmpty().withMessage('Category cannot be empty'),
];

module.exports = {
  registerProviderRules,
  updateProviderRules,
};
