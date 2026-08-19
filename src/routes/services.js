const router = require('express').Router();
const {
  createService,
  getAllServices,
  getServiceById,
  updateService,
  deleteService,
  getProviderServices,
} = require('../controllers/serviceController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createServiceRules,
  updateServiceRules,
} = require('../validations/serviceValidation');

router.post('/', authenticate, authorize('provider'), [...createServiceRules, validate], createService);
router.get('/', getAllServices);
router.get('/provider/:providerId', getProviderServices);
router.get('/:id', getServiceById);
router.put('/:id', authenticate, authorize('provider'), [...updateServiceRules, validate], updateService);
router.delete('/:id', authenticate, authorize('provider'), deleteService);

module.exports = router;
