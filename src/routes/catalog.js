const router = require('express').Router();
const {
  listCategories,
  getCategory,
  listCatalogServices,
  listProvidersForService,
  listStorefrontProviders,
  getStorefrontProvider,
} = require('../controllers/catalogController');
const { authenticate } = require('../middleware/auth');

router.get('/categories', listCategories);
router.get('/categories/:slug', getCategory);
router.get('/services', listCatalogServices);
router.get('/services/:slug/providers', authenticate, listProvidersForService);
router.get('/providers', authenticate, listStorefrontProviders);
router.get('/providers/:id', authenticate, getStorefrontProvider);

module.exports = router;