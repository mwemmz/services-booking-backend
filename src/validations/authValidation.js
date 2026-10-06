const { body } = require('express-validator');

const registerRules = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('A valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  // Providers sign in with their phone, so it is required for them.
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Enter a valid phone number'),
  body('role').optional().isIn(['customer', 'provider']).withMessage('Role must be customer or provider'),
  (req, res, next) => {
    if (req.body?.role === 'provider' && !req.body?.phone) {
      return res.status(400).json({ message: 'Enter a valid phone number.' });
    }
    return next();
  },
];

const loginRules = [
  // Accept a phone number in place of the email: the storefront signs people in
  // with whichever they typed.
  body('email')
    .optional()
    .isEmail()
    .withMessage('A valid email is required'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Invalid phone number'),
  body('identifier')
    .optional()
    .isString()
    .withMessage('identifier must be a string'),
  body('password').notEmpty().withMessage('Password is required'),
  // One of them has to be there, whichever the client sent.
  (req, res, next) => {
    const { email, phone, identifier } = req.body ?? {};
    if (!email && !phone && !identifier) {
      return res.status(400).json({ message: 'Enter your email or phone number.' });
    }
    return next();
  },
];

const updateProfileRules = [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
];

const changePasswordRules = [
  body('oldPassword').notEmpty().withMessage('Old password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
];

const forgotPasswordRules = [
  (req, res, next) => {
    const { email, phone, identifier } = req.body ?? {};
    if (!email && !phone && !identifier) {
      return res.status(400).json({ message: 'Enter your email or phone number.' });
    }
    if (identifier && !email && !phone) return next();
    if (phone) return next();
    return body('email').isEmail().withMessage('A valid email is required')(req, res, next);
  },
];

const resetPasswordRules = [
  body('code').notEmpty().withMessage('Enter the reset code'),
  body('password').isLength({ min: 6 }).withMessage('Use at least 6 characters'),
];

module.exports = {
  registerRules,
  loginRules,
  updateProfileRules,
  changePasswordRules,
  forgotPasswordRules,
  resetPasswordRules,
};
