const express = require('express');
const { uuidParam } = require('../utils/uuid');
const {
  listProviderPortfolio,
  listMyPortfolio,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
} = require('../controllers/portfolioController');
const { createPortfolioRules, updatePortfolioRules } = require('../validations/portfolioValidation');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.param('id', uuidParam('id'));

// Public: a customer's provider profile shows the work gallery.
router.get('/provider/:providerId', listProviderPortfolio);

// Owner management.
router.get('/', authenticate, authorize('provider'), listMyPortfolio);
router.post('/', authenticate, authorize('provider'), [...createPortfolioRules, validate], createPortfolioItem);
router.put('/:id', authenticate, [...updatePortfolioRules, validate], updatePortfolioItem);
router.delete('/:id', authenticate, deletePortfolioItem);

module.exports = router;