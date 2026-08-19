const { Op } = require('sequelize');
const { Provider, User, Service } = require('../models');
const { paginate, buildPaginationResponse } = require('../utils/pagination');
const { haversineDistance } = require('../utils/distance');

exports.registerAsProvider = async (req, res) => {
  try {
    const existing = await Provider.findOne({ where: { user_id: req.user.id } });
    if (existing) {
      return res.status(409).json({ message: 'Already registered as a provider.' });
    }

    const provider = await Provider.create({
      user_id: req.user.id,
      business_name: req.body.business_name,
      description: req.body.description,
      category: req.body.category,
      location_lat: req.body.location_lat,
      location_lng: req.body.location_lng,
      service_radius: req.body.service_radius,
      working_hours: req.body.working_hours,
      verification_documents: req.body.verification_documents,
    });

    await req.user.update({ role: 'provider' });

    return res.status(201).json({ message: 'Provider registration successful.', provider });
  } catch (error) {
    return res.status(500).json({ message: 'Provider registration failed.', error: error.message });
  }
};

exports.getAllProviders = async (req, res) => {
  try {
    const { category, is_verified, rating, page = 1, limit = 20 } = req.query;

    const where = {};
    if (category) where.category = category;
    if (is_verified !== undefined) where.is_verified = is_verified === 'true';
    if (rating) where.rating = { [Op.gte]: parseFloat(rating) };

    const query = paginate({
      where,
      include: [{ model: User, as: 'user' }],
      order: [['rating', 'DESC']],
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

exports.getProviderById = async (req, res) => {
  try {
    const provider = await Provider.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user' },
        { model: Service, as: 'services', where: { is_active: true }, required: false },
      ],
    });

    if (!provider) {
      return res.status(404).json({ message: 'Provider not found.' });
    }

    return res.json({ provider });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch provider.', error: error.message });
  }
};

exports.updateProvider = async (req, res) => {
  try {
    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider) {
      return res.status(404).json({ message: 'Provider profile not found.' });
    }

    const allowedFields = ['business_name', 'description', 'category', 'location_lat', 'location_lng', 'service_radius', 'working_hours'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    await provider.update(updates);

    return res.json({ message: 'Provider profile updated.', provider });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update provider.', error: error.message });
  }
};

exports.toggleOnlineStatus = async (req, res) => {
  try {
    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider) {
      return res.status(404).json({ message: 'Provider profile not found.' });
    }

    provider.is_online = !provider.is_online;
    await provider.save();

    return res.json({ message: 'Status updated.', is_online: provider.is_online });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update status.', error: error.message });
  }
};

exports.getNearbyProviders = async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and longitude are required.' });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const maxRadius = parseFloat(radius);

    const providers = await Provider.findAll({
      where: { is_online: true, location_lat: { [Op.ne]: null }, location_lng: { [Op.ne]: null } },
      include: [{ model: User, as: 'user' }],
    });

    const nearby = providers.filter((provider) => {
      const distance = haversineDistance(userLat, userLng, parseFloat(provider.location_lat), parseFloat(provider.location_lng));
      return distance <= maxRadius;
    });

    return res.json({ providers: nearby });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch nearby providers.', error: error.message });
  }
};
