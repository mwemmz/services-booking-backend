const { body } = require('express-validator');

exports.createCertificationRules = [
  body('name').notEmpty().withMessage('Certification name is required'),
  body('issuing_body').notEmpty().withMessage('Issuing body is required'),
  body('expiry_date').optional().isISO8601(),
];
