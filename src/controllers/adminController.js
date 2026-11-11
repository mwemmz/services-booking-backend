const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { User, Provider, Booking, Service, Payment, AuditLog } = require('../models');
const { audit } = require('../services/auditService');
const { createNotification } = require('../services/notificationService');
const { paginate, buildPaginationResponse } = require('../utils/pagination');

const publicUserAttributes = { exclude: ['password_hash', 'reset_token', 'reset_token_expires', 'email_verify_token'] };

exports.getAllUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;

    const where = {};
    if (role) where.role = role;
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const query = paginate({
      where,
      attributes: publicUserAttributes,
      order: [['createdAt', 'DESC']],
    }, { page, limit });

    const { count, rows: users } = await User.findAndCountAll(query);

    return res.json({
      users,
      pagination: buildPaginationResponse(count, page, limit),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch users.', error: error.message });
  }
};

exports.getAllProviders = async (req, res) => {
  try {
    const { is_verified, category, page = 1, limit = 20 } = req.query;

    const where = {};
    if (is_verified !== undefined) where.is_verified = is_verified === 'true';
    if (req.query.status === 'pending') where.verification_status = 'pending';
    if (req.query.status === 'rejected') where.verification_status = 'rejected';
    if (category) where.category = category;

    const query = paginate({
      where,
      include: [{ model: User, as: 'user', attributes: publicUserAttributes }],
      order: [['createdAt', 'DESC']],
    }, { page, limit });

    const { count, rows: providers } = await Provider.findAndCountAll(query);

    return res.json({
      providers,
      pagination: buildPaginationResponse(count, page, limit),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch providers.', error: error.message });
  }
};

exports.verifyProvider = async (req, res) => {
  try {
    const provider = await Provider.findByPk(req.params.id, { include: [{ model: User, as: 'user' }] });
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found.' });
    }

    await provider.update({ is_verified: true, verification_status: 'verified', verification_note: null });
    if (provider.user?.national_id_number) await provider.user.update({ national_id_verified: true });
    await audit(req, 'PROVIDER_APPROVED', { targetType: 'provider', targetId: provider.id, detail: provider.business_name });
    await createNotification(provider.user_id, 'verification', 'You are verified', 'An admin approved your account. Customers now see your verified badge.');

    return res.json({ message: 'Provider verified.', provider });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to verify provider.', error: error.message });
  }
};

exports.rejectProvider = async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 5) {
      return res.status(400).json({ message: 'Give a short reason so the provider can fix it.' });
    }
    const provider = await Provider.findByPk(req.params.id);
    if (!provider) return res.status(404).json({ message: 'Provider not found.' });

    await provider.update({ is_verified: false, verification_status: 'rejected', verification_note: reason.slice(0, 300) });
    await audit(req, 'PROVIDER_REJECTED', { targetType: 'provider', targetId: provider.id, detail: reason });
    await createNotification(provider.user_id, 'verification', 'Verification needs attention', reason.slice(0, 200));

    return res.json({ message: 'Provider rejected.', provider });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to reject provider.', error: error.message });
  }
};

const findManagedUser = async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) {
    res.status(404).json({ message: 'User not found.' });
    return null;
  }
  if (user.id === req.user.id || user.role === 'admin') {
    res.status(403).json({ message: 'Admin accounts cannot be changed here.' });
    return null;
  }
  return user;
};

exports.suspendUser = async (req, res) => {
  try {
    const user = await findManagedUser(req, res);
    if (!user) return undefined;
    await user.update({ is_active: false });
    await audit(req, 'USER_SUSPENDED', { targetType: 'user', targetId: user.id, detail: user.name });
    return res.json({ message: 'User suspended.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to suspend user.', error: error.message });
  }
};

exports.reactivateUser = async (req, res) => {
  try {
    const user = await findManagedUser(req, res);
    if (!user) return undefined;
    await user.update({ is_active: true, failed_login_attempts: 0, locked_until: null });
    await audit(req, 'USER_REACTIVATED', { targetType: 'user', targetId: user.id, detail: user.name });
    return res.json({ message: 'User reactivated.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to reactivate user.', error: error.message });
  }
};

exports.unlockUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    await user.update({ failed_login_attempts: 0, locked_until: null });
    await audit(req, 'USER_UNLOCKED', { targetType: 'user', targetId: user.id, detail: user.name });
    return res.json({ message: 'Account unlocked.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to unlock user.', error: error.message });
  }
};

/** One screen of security facts: who is locked out, what is waiting, what just happened. */
exports.getSecurityOverview = async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const [lockedUsers, suspendedCount, pendingVerifications, lockoutsToday, events] = await Promise.all([
      User.findAll({ where: { locked_until: { [Op.gt]: new Date() } }, attributes: ['id', 'name', 'email', 'phone', 'role', 'locked_until'] }),
      User.count({ where: { is_active: false } }),
      Provider.count({ where: { verification_status: 'pending' } }),
      AuditLog.count({ where: { action: 'LOGIN_LOCKED', createdAt: { [Op.gte]: since } } }),
      AuditLog.findAll({ order: [['createdAt', 'DESC']], limit: 30 }),
    ]);
    return res.json({ lockedUsers, suspendedCount, pendingVerifications, lockoutsToday, events });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load security overview.', error: error.message });
  }
};

exports.getAllBookings = async (req, res) => {
  try {
    const { status, date_from, date_to, page = 1, limit = 20 } = req.query;

    const where = {};
    if (status) where.status = status;
    if (date_from || date_to) {
      where.createdAt = {};
      if (date_from) where.createdAt[Op.gte] = new Date(date_from);
      if (date_to) where.createdAt[Op.lte] = new Date(date_to);
    }

    const query = paginate({
      where,
      include: [
        { model: User, as: 'customer', attributes: publicUserAttributes },
        { model: Provider, as: 'provider' },
        { model: Service, as: 'service' },
        { model: Payment, as: 'payment' },
      ],
      order: [['createdAt', 'DESC']],
    }, { page, limit });

    const { count, rows: bookings } = await Booking.findAndCountAll(query);

    return res.json({
      bookings,
      pagination: buildPaginationResponse(count, page, limit),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch bookings.', error: error.message });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const totalBookings = await Booking.count();
    const totalUsers = await User.count();
    const totalProviders = await Provider.count();

    const revenueResult = await Payment.findOne({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalRevenue'],
      ],
      where: { status: 'completed' },
      raw: true,
    });

    const recentBookings = await Booking.findAll({
      include: [
        { model: User, as: 'customer', attributes: publicUserAttributes },
        { model: Provider, as: 'provider' },
      ],
      order: [['createdAt', 'DESC']],
      limit: 10,
    });

    return res.json({
      totalBookings,
      totalRevenue: parseFloat(revenueResult.totalRevenue) || 0,
      totalUsers,
      totalProviders,
      recentBookings,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch analytics.', error: error.message });
  }
};

exports.getReports = async (req, res) => {
  try {
    const bookingTrends = await Booking.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'DESC']],
      limit: 30,
      raw: true,
    });

    const providerPerformance = await Provider.findAll({
      attributes: ['id', 'business_name', 'rating', 'total_reviews', 'is_verified'],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name', 'email'],
        },
      ],
      order: [['rating', 'DESC']],
      limit: 20,
    });

    return res.json({
      bookingTrends,
      providerPerformance,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch reports.', error: error.message });
  }
};
