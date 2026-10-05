const router = require('express').Router();
const { uuidParam } = require('../utils/uuid');
const {
  createDispute,
  getMyDisputes,
  getAllDisputes,
  resolveDispute,
} = require('../controllers/disputeController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createDisputeRules,
  resolveDisputeRules,
} = require('../validations/disputeValidation');

router.param('id', uuidParam('id'));

router.post('/', authenticate, [...createDisputeRules, validate], createDispute);
router.get('/mine', authenticate, getMyDisputes);
router.get('/', authenticate, authorize('admin'), getAllDisputes);
router.put('/:id/resolve', authenticate, authorize('admin'), [...resolveDisputeRules, validate], resolveDispute);

module.exports = router;