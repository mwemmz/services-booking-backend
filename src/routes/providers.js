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
  getMyAvailability,
  replaceMyAvailability,
  submitVerification,
} = require('../controllers/providerController');
const { getMySubscription, paySubscription } = require('../controllers/subscriptionController');
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
router.get('/me/availability', authenticate, getMyAvailability);
router.put('/me/availability', authenticate, replaceMyAvailability);
router.post('/me/verification', authenticate, authorize('provider'), submitVerification);
router.get('/me/subscription', authenticate, authorize('provider'), getMySubscription);
router.post('/me/subscription/pay', authenticate, authorize('provider'), paySubscription);
router.get('/:id', getProviderById);
router.put('/:id', authenticate, [...updateProviderRules, validate], updateProvider);
router.put('/:id/status', authenticate, toggleOnlineStatus);

module.exports = router;
