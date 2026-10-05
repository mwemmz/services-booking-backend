const router = require('express').Router();
const { uuidParam } = require('../utils/uuid');
const {
  listFavourites,
  checkFavourite,
  addFavourite,
  removeFavourite,
} = require('../controllers/favouriteController');
const { authenticate } = require('../middleware/auth');

router.param('providerId', uuidParam('providerId'));

router.get('/', authenticate, listFavourites);
router.get('/:providerId/status', authenticate, checkFavourite);
router.post('/', authenticate, addFavourite);
router.delete('/:providerId', authenticate, removeFavourite);

module.exports = router;