const { body } = require('express-validator');

/**
 * Business details a provider can set. `required` is false for edits, where a
 * client only sends the fields that changed.
 *
 * Each call builds fresh chains: express-validator chains are mutable, so
 * sharing one instance between two rule sets would leak `.optional()` across.
 */
const providerProfileRules = ({ requireBusinessName }) => {
  const rules = [
    body('business_name').notEmpty().withMessage('Business name cannot be empty'),
    body('description').optional().notEmpty().withMessage('Description cannot be empty'),
    body('category').optional().notEmpty().withMessage('Category cannot be empty'),
    body('service_area').optional().notEmpty().withMessage('Service area cannot be empty'),
    body('address').optional().notEmpty().withMessage('Address cannot be empty'),
    body('location_lat').optional().isFloat().withMessage('Latitude must be a number'),
    body('location_lng').optional().isFloat().withMessage('Longitude must be a number'),
    body('service_radius').optional().isFloat({ min: 1 }).withMessage('Service radius must be at least 1km'),
  ];

  // An edit only sends what changed, so business name becomes optional too.
  if (!requireBusinessName) {
    rules[0].optional();
  }

  return rules;
};

// The old mobile app registers with a business name and little else, so only
// that one field is mandatory here.
const registerProviderRules = providerProfileRules({ requireBusinessName: true });

const updateProviderRules = providerProfileRules({ requireBusinessName: false });

module.exports = {
  registerProviderRules,
  updateProviderRules,
};
