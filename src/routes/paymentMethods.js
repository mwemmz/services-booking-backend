const express = require('express');
const { uuidParam } = require('../utils/uuid');
const { listPaymentMethods, createPaymentMethod, deletePaymentMethod } = require('../controllers/paymentMethodController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.param('id', uuidParam('id'));

// Saved payment methods belong to the signed-in user only.
router.get('/', authenticate, listPaymentMethods);
router.post('/', authenticate, createPaymentMethod);
router.delete('/:id', authenticate, deletePaymentMethod);

module.exports = router;
