const router = require('express').Router();
const {
  getAllUsers,
  getAllProviders,
  verifyProvider,
  getAllBookings,
  getAnalytics,
  getReports,
} = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/users', authenticate, authorize('admin'), getAllUsers);
router.get('/providers', authenticate, authorize('admin'), getAllProviders);
router.put('/providers/:id/verify', authenticate, authorize('admin'), verifyProvider);
router.get('/bookings', authenticate, authorize('admin'), getAllBookings);
router.get('/analytics', authenticate, authorize('admin'), getAnalytics);
router.get('/reports', authenticate, authorize('admin'), getReports);

module.exports = router;
