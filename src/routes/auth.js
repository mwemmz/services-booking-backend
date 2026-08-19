const router = require('express').Router();
const {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  updateProfile,
  changePassword,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  registerRules,
  loginRules,
  updateProfileRules,
  changePasswordRules,
} = require('../validations/authValidation');

router.post('/register', [...registerRules, validate], register);
router.post('/login', [...loginRules, validate], login);
router.post('/refresh-token', refreshToken);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.put('/update-profile', authenticate, [...updateProfileRules, validate], updateProfile);
router.put('/change-password', authenticate, [...changePasswordRules, validate], changePassword);

module.exports = router;
