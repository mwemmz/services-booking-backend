const { body } = require('express-validator');

exports.submitNationalIdRules = [
  body('national_id_number')
    .notEmpty()
    .withMessage('national_id_number is required')
    .isLength({ min: 6 })
    .withMessage('national_id_number looks too short'),
];