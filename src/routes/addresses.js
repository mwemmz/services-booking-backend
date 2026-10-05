const express = require('express');
const { uuidParam } = require('../utils/uuid');
const {
  listAddresses,
  createAddress,
  getAddress,
  updateAddress,
  deleteAddress,
} = require('../controllers/addressController');
const { createAddressRules, updateAddressRules } = require('../validations/addressValidation');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.param('id', uuidParam('id'));

// Saved addresses belong to the signed-in user only; every route is scoped by user_id.
router.get('/', authenticate, listAddresses);
router.post('/', authenticate, [...createAddressRules, validate], createAddress);
router.get('/:id', authenticate, getAddress);
router.put('/:id', authenticate, [...updateAddressRules, validate], updateAddress);
router.delete('/:id', authenticate, deleteAddress);

module.exports = router;