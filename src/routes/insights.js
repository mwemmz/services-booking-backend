const router = require('express').Router();
const {
  getFinancialSummary,
  getCoverageInsights,
} = require('../controllers/insightsController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/financial/:providerId', authenticate, authorize('provider', 'admin'), getFinancialSummary);
router.get('/coverage/:providerId', authenticate, authorize('provider', 'admin'), getCoverageInsights);
router.get('/financial', authenticate, getFinancialSummary);
router.get('/coverage', authenticate, getCoverageInsights);

module.exports = router;