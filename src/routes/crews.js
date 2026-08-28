const router = require('express').Router();
const {
  createCrew,
  getMyCrews,
  getCrewById,
  addMember,
  removeMember,
  deleteCrew,
} = require('../controllers/crewController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createCrewRules } = require('../validations/crewValidation');

router.post('/', authenticate, authorize('provider'), [...createCrewRules, validate], createCrew);
router.get('/mine', authenticate, authorize('provider'), getMyCrews);
router.get('/:id', getCrewById);
router.post('/:id/members', authenticate, authorize('provider'), addMember);
router.delete('/:id/members/:memberId', authenticate, authorize('provider'), removeMember);
router.delete('/:id', authenticate, deleteCrew);

module.exports = router;