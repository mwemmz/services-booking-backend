const { body } = require('express-validator');

const createAddressRules = [
  body('label').optional().trim().isLength({ min: 1, max: 60 }).withMessage('Label must be 1-60 characters'),
  body('address_line').trim().notEmpty().withMessage('Address is required'),
  body('city').optional({ nullable: true }).trim().isLength({ max: 100 }).withMessage('City must be 100 characters or fewer'),
  body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }).withMessage('Latitude must be a valid coordinate'),
  body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }).withMessage('Longitude must be a valid coordinate'),
  body('instructions').optional({ nullable: true }).trim().isLength({ max: 500 }).withMessage('Instructions must be 500 characters or fewer'),
  body('is_default').optional().isBoolean().withMessage('is_default must be true or false'),
];

const updateAddressRules = [
  body('label').optional().trim().isLength({ min: 1, max: 60 }).withMessage('Label must be 1-60 characters'),
  body('address_line').optional().trim().notEmpty().withMessage('Address is required'),
  body('city').optional({ nullable: true }).trim().isLength({ max: 100 }).withMessage('City must be 100 characters or fewer'),
  body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }).withMessage('Latitude must be a valid coordinate'),
  body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }).withMessage('Longitude must be a valid coordinate'),
  body('instructions').optional({ nullable: true }).trim().isLength({ max: 500 }).withMessage('Instructions must be 500 characters or fewer'),
  body('is_default').optional().isBoolean().withMessage('is_default must be true or false'),
];

module.exports = {
  createAddressRules,
  updateAddressRules,
};