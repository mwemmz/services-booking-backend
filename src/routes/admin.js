const router = require('express').Router();
const { uuidParam } = require('../utils/uuid');
const {
  getAllUsers,
  getAllProviders,
  verifyProvider,
  rejectProvider,
  suspendUser,
  reactivateUser,
  unlockUser,
  getSecurityOverview,
  getAllBookings,
  getAnalytics,
  getReports,
} = require('../controllers/adminController');
const { getDemandMap } = require('../controllers/geoController');
const { authenticate, authorize } = require('../middleware/auth');

router.param('id', uuidParam('id'));

router.get('/users', authenticate, authorize('admin'), getAllUsers);
router.get('/providers', authenticate, authorize('admin'), getAllProviders);
router.put('/providers/:id/verify', authenticate, authorize('admin'), verifyProvider);
router.put('/providers/:id/reject', authenticate, authorize('admin'), rejectProvider);
router.put('/users/:id/suspend', authenticate, authorize('admin'), suspendUser);
router.put('/users/:id/reactivate', authenticate, authorize('admin'), reactivateUser);
router.put('/users/:id/unlock', authenticate, authorize('admin'), unlockUser);
router.get('/security', authenticate, authorize('admin'), getSecurityOverview);
router.get('/bookings', authenticate, authorize('admin'), getAllBookings);
router.get('/analytics', authenticate, authorize('admin'), getAnalytics);
router.get('/reports', authenticate, authorize('admin'), getReports);
router.get('/demand-map', authenticate, authorize('admin'), getDemandMap);

module.exports = router;
