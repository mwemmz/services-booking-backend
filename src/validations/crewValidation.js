const { body } = require('express-validator');

exports.createCrewRules = [
  body('name').notEmpty().withMessage('Crew name is required'),
  body('member_ids').optional().isArray().withMessage('member_ids must be an array'),
];