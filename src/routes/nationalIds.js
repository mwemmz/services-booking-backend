const router = require('express').Router();
const { uuidParam } = require('../utils/uuid');
const {
  submitNationalId,
  verifyNationalId,
  getNationalIdStatus,
} = require('../controllers/nationalIdController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { submitNationalIdRules } = require('../validations/nationalIdValidation');

router.param('userId', uuidParam('userId'));

router.post('/submit', authenticate, [...submitNationalIdRules, validate], submitNationalId);
router.get('/status', authenticate, getNationalIdStatus);
router.put('/users/:userId/verify', authenticate, authorize('admin'), verifyNationalId);

module.exports = router;