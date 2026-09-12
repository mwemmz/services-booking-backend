const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { User, Provider, Booking, Service, Payment } = require('../models');
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
    const provider = await Provider.findByPk(req.params.id);
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found.' });
    }

    await provider.update({ is_verified: true });

    return res.json({ message: 'Provider verified.', provider });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to verify provider.', error: error.message });
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
