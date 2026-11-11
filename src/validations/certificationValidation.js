const { body } = require('express-validator');

exports.createCertificationRules = [
  body('name').notEmpty().withMessage('Certification name is required'),
  body('issuing_body').notEmpty().withMessage('Issuing body is required'),
  body('document_url').notEmpty().withMessage('Attach a photo or PDF of the certificate'),
  body('expiry_date').optional({ values: 'falsy' }).isISO8601(),
];
