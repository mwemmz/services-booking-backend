const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { User } = require('../models');
const { sendPasswordReset, sendEmailVerification } = require('../services/emailService');

const generateAccessToken = (user) => {
  return jwt.sign({ id: user.id, role: user.role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

const generateRefreshToken = (user) => {
  return jwt.sign({ id: user.id }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
};

/** 6-digit numeric code for email verification (mobile-friendly OTP). */
const generateVerificationCode = () =>
  String(Math.floor(100000 + Math.random() * 900000));

exports.register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const allowedRoles = ['customer', 'provider'];
    const role = allowedRoles.includes(req.body.role) ? req.body.role : 'customer';

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'Email already in use.' });
    }

    const user = await User.create({ name, email, password_hash: password, phone, role });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return res.status(201).json({
      message: 'Registration successful.',
      accessToken,
      refreshToken,
      user,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Registration failed.', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, phone, identifier, password } = req.body;

    // Callers may send email, phone, or a single identifier field holding either.
    const loginId = identifier ?? email ?? phone;

    const user = await User.findOne({
      where: {
        [Op.or]: [
          ...(String(loginId).includes('@') ? [{ email: String(loginId).toLowerCase() }] : []),
          ...(String(loginId).includes('@') ? [] : [{ phone: loginId }]),
        ],
      },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: 'Account is deactivated.' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return res.json({
      message: 'Login successful.',
      accessToken,
      refreshToken,
      user,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed.', error: error.message });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required.' });
    }

    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    const user = await User.findByPk(decoded.id);

    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'Invalid refresh token.' });
    }

    const accessToken = generateAccessToken(user);

    return res.json({
      message: 'Token refreshed.',
      accessToken,
    });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired refresh token.' });
  }
};

exports.logout = async (req, res) => {
  return res.json({ message: 'Logged out successfully.' });
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.json({ user });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch user.', error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, profile_image } = req.body;

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await user.update({ name, phone, profile_image });

    return res.json({ message: 'Profile updated.', user });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update profile.', error: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    user.password_hash = newPassword;
    await user.save();

    return res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to change password.', error: error.message });
  }
};

/**
 * Request a password reset.
 *
 * People sign in with a phone number here, so a reset starts from the one they
 * typed. Email still works, and both paths store a short code that expires in an
 * hour. Outside production the code comes back in the response so the flow can
 * be tested without an inbox.
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email, phone, identifier } = req.body;

    const loginId = identifier ?? email ?? phone;
    if (!loginId) {
      return res.status(400).json({ message: 'Enter your email or phone number.' });
    }

    const user = await User.findOne({
      where: {
        [Op.or]: String(loginId).includes('@')
          ? [{ email: String(loginId).toLowerCase() }]
          : [{ phone: loginId }],
      },
    });

    // Always return success to avoid revealing which accounts exist.
    if (!user) {
      return res.json({ message: 'If that account exists, a reset code is on its way.' });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));

    await user.update({
      reset_token: code,
      reset_token_expires: new Date(Date.now() + 60 * 60 * 1000),
    });

    await sendPasswordReset(user.email, code);

    const devMode = config.nodeEnv !== 'production';

    return res.json({
      message: 'If that account exists, a reset code is on its way.',
      ...(devMode ? { resetCode: code } : {}),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to request password reset.', error: error.message });
  }
};

/**
 * Reset the password using a valid, unexpired reset token.
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token, code, newPassword, password } = req.body;
    const supplied = token ?? code;
    const nextPassword = newPassword ?? password;

    if (!supplied || !nextPassword) {
      return res.status(400).json({ message: 'Enter the reset code and your new password.' });
    }

    const user = await User.findOne({
      where: {
        reset_token: String(supplied),
        reset_token_expires: { [Op.gt]: new Date() },
      },
    });
    if (!user) {
      return res.status(400).json({ message: 'That reset code is invalid or has expired.' });
    }

    user.password_hash = newPassword;
    user.reset_token = null;
    user.reset_token_expires = null;
    await user.save();

    return res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to reset password.', error: error.message });
  }
};

/**
 * Resend a verification email.
 */
exports.resendVerification = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (user.email_verified) {
      return res.json({ message: 'Email is already verified.' });
    }

    const code = generateVerificationCode();
    await user.update({ email_verify_token: code });
    await sendEmailVerification(user.email, code);

    const devMode = config.nodeEnv !== 'production';
    return res.json({
      message: 'Verification email sent.',
      ...(devMode ? { code } : {}),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send verification email.', error: error.message });
  }
};

/**
 * Confirm a user's email using the emailed 6-digit code (or legacy token link).
 */
exports.verifyEmail = async (req, res) => {
  try {
    const { token, code } = req.body;
    const value = code || token;
    if (!value) {
      return res.status(400).json({ message: 'Verification code is required.' });
    }

    const user = await User.findOne({ where: { email_verify_token: String(value) } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email verification code.' });
    }

    await user.update({ email_verified: true, email_verify_token: null });

    return res.json({ message: 'Email verified successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to verify email.', error: error.message });
  }
};
