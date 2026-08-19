const router = require('express').Router();
const {
  createReview,
  getProviderReviews,
  getReviewById,
  deleteReview,
} = require('../controllers/reviewController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createReviewRules } = require('../validations/reviewValidation');

router.post('/', authenticate, [...createReviewRules, validate], createReview);
router.get('/provider/:providerId', getProviderReviews);
router.get('/:id', getReviewById);
router.delete('/:id', authenticate, deleteReview);

module.exports = router;
