const router = require('express').Router();
const { uuidParam } = require('../utils/uuid');
const {
  registerAsProvider,
  getAllProviders,
  getProviderById,
  updateProvider,
  toggleOnlineStatus,
  getNearbyProviders,
  getMyProviderProfile,
} = require('../controllers/providerController');
const { getOpportunities } = require('../controllers/geoController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  registerProviderRules,
  updateProviderRules,
} = require('../validations/providerValidation');

router.param('id', uuidParam('id'));

router.post('/', authenticate, [...registerProviderRules, validate], registerAsProvider);
router.get('/', getAllProviders);
router.get('/opportunities', authenticate, authorize('provider'), getOpportunities);
router.get('/nearby', authenticate, getNearbyProviders);
router.get('/me', authenticate, getMyProviderProfile);
router.get('/:id', getProviderById);
router.put('/:id', authenticate, [...updateProviderRules, validate], updateProvider);
router.put('/:id/status', authenticate, toggleOnlineStatus);

module.exports = router;
