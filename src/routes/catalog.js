const router = require('express').Router();
const {
  listCategories,
  getCategory,
  listCatalogServices,
  listProvidersForService,
} = require('../controllers/catalogController');
const { authenticate } = require('../middleware/auth');

router.get('/categories', listCategories);
router.get('/categories/:slug', getCategory);
router.get('/services', listCatalogServices);
router.get('/services/:slug/providers', authenticate, listProvidersForService);

module.exports = router;