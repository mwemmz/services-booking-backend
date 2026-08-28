const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
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

exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

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
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
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
 * Request a password reset. Emails a reset token (expiring in 1 hour).
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email } });

    // Always return success to avoid revealing which emails exist.
    if (!user) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const resetToken = uuidv4();
    await user.update({
      reset_token: resetToken,
      reset_token_expires: new Date(Date.now() + 60 * 60 * 1000),
    });

    await sendPasswordReset(user.email, resetToken);

    return res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to request password reset.', error: error.message });
  }
};

/**
 * Reset the password using a valid, unexpired reset token.
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'token and newPassword are required.' });
    }

    const user = await User.findOne({
      where: {
        reset_token: token,
        reset_token_expires: { [require('sequelize').Op.gt]: new Date() },
      },
    });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
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

    const verifyToken = uuidv4();
    await user.update({ email_verify_token: verifyToken });
    await sendEmailVerification(user.email, verifyToken);

    return res.json({ message: 'Verification email sent.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send verification email.', error: error.message });
  }
};

/**
 * Confirm a user's email using the emailed token.
 */
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'token is required.' });
    }

    const user = await User.findOne({ where: { email_verify_token: token } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid verification token.' });
    }

    await user.update({ email_verified: true, email_verify_token: null });

    return res.json({ message: 'Email verified successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to verify email.', error: error.message });
  }
};
