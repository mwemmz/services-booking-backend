const router = require('express').Router();
const {
  registerAsProvider,
  getAllProviders,
  getProviderById,
  updateProvider,
  toggleOnlineStatus,
  getNearbyProviders,
} = require('../controllers/providerController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  registerProviderRules,
  updateProviderRules,
} = require('../validations/providerValidation');

router.post('/', authenticate, [...registerProviderRules, validate], registerAsProvider);
router.get('/', getAllProviders);
router.get('/nearby', authenticate, getNearbyProviders);
router.get('/:id', getProviderById);
router.put('/:id', authenticate, [...updateProviderRules, validate], updateProvider);
router.put('/:id/status', authenticate, toggleOnlineStatus);

module.exports = router;
