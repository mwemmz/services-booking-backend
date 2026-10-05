const router = require('express').Router();
const { uuidParam } = require('../utils/uuid');
const {
  getFinancialSummary,
  getCoverageInsights,
} = require('../controllers/insightsController');
const { authenticate, authorize } = require('../middleware/auth');

router.param('providerId', uuidParam('providerId'));

router.get('/financial/:providerId', authenticate, authorize('provider', 'admin'), getFinancialSummary);
router.get('/coverage/:providerId', authenticate, authorize('provider', 'admin'), getCoverageInsights);
router.get('/financial', authenticate, getFinancialSummary);
router.get('/coverage', authenticate, getCoverageInsights);

module.exports = router;