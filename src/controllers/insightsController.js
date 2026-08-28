const { Op } = require('sequelize');
const { Booking, Provider, Payment, User, Location, Crew } = require('../models');

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

exports.getFinancialSummary = async (req, res) => {
  try {
    const provider = await Provider.findOne(
      req.params.providerId
        ? { where: { id: req.params.providerId } }
        : { where: { user_id: req.user.id } },
    );
    if (!provider) return res.status(404).json({ message: 'Provider not found.' });

    const where = { provider_id: provider.id, is_confirmed: true };

    const today = new Date();
    const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [totalEarned, totalJobs, weekJobs, monthJobs, paymentMethods, distinctCustomers] = await Promise.all([
      Booking.sum('total_amount', { where: { ...where, status: { [Op.ne]: 'cancelled' } } }),
      Booking.count({ where }),
      Booking.count({ where: { ...where, createdAt: { [Op.gte]: startOfWeek } } }),
      Booking.count({ where: { ...where, createdAt: { [Op.gte]: startOfMonth } } }),
      Payment.findAll({
        attributes: ['payment_method'],
        where: { '$booking.provider_id$': provider.id },
        include: [{ model: Booking, as: 'booking', attributes: [] }],
        group: ['payment_method'],
        raw: true,
      }),
      Booking.count({ distinct: true, col: 'customer_id', where }),
    ]);

    const perJob = totalJobs ? (totalEarned / totalJobs).toFixed(2) : '0.00';

    return res.json({
      summary: {
        totalEarned: totalEarned || 0,
        totalJobs,
        averagePerJob: perJob,
        thisWeekJobs: weekJobs,
        thisMonthJobs: monthJobs,
        repeatCustomers: distinctCustomers,
        paymentMethods: paymentMethods.map((p) => p.payment_method).filter(Boolean),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to build financial summary.', error: error.message });
  }
};

exports.getCoverageInsights = async (req, res) => {
  try {
    const provider = await Provider.findOne(
      req.params.providerId
        ? { where: { id: req.params.providerId } }
        : { where: { user_id: req.user.id } },
    );
    if (!provider) return res.status(404).json({ message: 'Provider not found.' });

    const where = { provider_id: provider.id, is_confirmed: true };

    const [jobs, recentLocations, crews] = await Promise.all([
      Booking.findAll({ where, attributes: ['location_lat', 'location_lng', 'createdAt'] }),
      Location.findAll({
        where: { provider_id: provider.id, updatedAt: { [Op.gte]: new Date(Date.now() - SEVEN_DAYS) } },
        attributes: ['latitude', 'longitude', 'accuracy'],
        limit: 50,
      }),
      Crew.findAll({ where: { leader_id: provider.id } }),
    ]);

    const jobLocations = jobs.filter((j) => j.location_lat || j.location_lng)
      .map((j) => ({ latitude: j.location_lat, longitude: j.location_lng, createdAt: j.createdAt }));

    const uniqueCells = new Set(
      jobLocations.map((l) => `${l.latitude ? l.latitude.toFixed(2) : 'x'},${l.longitude ? l.longitude.toFixed(2) : 'x'}`),
    );

    const coverage = {
      locationsCount: jobLocations.length,
      uniqueAreas: uniqueCells.size,
      avgRating: provider.rating,
      activeCrews: crews.length,
    };

    return res.json({
      coverage,
      jobLocations,
      recentLocationFixes: recentLocations,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to build coverage insights.', error: error.message });
  }
};