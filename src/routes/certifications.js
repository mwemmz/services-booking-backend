const router = require('express').Router();
const { uuidParam } = require('../utils/uuid');
const {
  createCertification,
  getProviderCertifications,
  verifyCertification,
  rejectCertification,
  getMyCertifications,
  deleteCertification,
} = require('../controllers/certificationController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createCertificationRules } = require('../validations/certificationValidation');

router.param('id', uuidParam('id'));
router.param('providerId', uuidParam('providerId'));

router.post('/', authenticate, authorize('provider'), [...createCertificationRules, validate], createCertification);
router.get('/mine', authenticate, authorize('provider'), getMyCertifications);
router.get('/provider/:providerId', getProviderCertifications);
router.put('/:id/verify', authenticate, authorize('admin'), verifyCertification);
router.put('/:id/approve', authenticate, authorize('admin'), verifyCertification);
router.put('/:id/reject', authenticate, authorize('admin'), rejectCertification);
router.delete('/:id', authenticate, authorize('provider', 'admin'), deleteCertification);

module.exports = router;
