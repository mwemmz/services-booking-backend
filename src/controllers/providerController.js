const { Op } = require('sequelize');
const { Provider, User, Service, ProviderAvailability } = require('../models');
const db = require('../config/database');
const { paginate, buildPaginationResponse } = require('../utils/pagination');
const { haversineDistance } = require('../utils/distance');

/** Never expose auth secrets on public provider/user responses. */
const publicUserAttributes = {
  attributes: {
    exclude: ['password_hash', 'reset_token', 'reset_token_expires', 'email_verify_token'],
  },
};

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
      include: [
        { model: User, as: 'user', ...publicUserAttributes },
        { model: Service, as: 'services', where: { is_active: true }, required: false },
      ],
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
    // Accept either the provider profile id or the owning user id.
    const provider = await Provider.findOne({
      where: {
        [Op.or]: [{ id: req.params.id }, { user_id: req.params.id }],
      },
      include: [
        { model: User, as: 'user', ...publicUserAttributes },
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
      include: [
        { model: User, as: 'user', ...publicUserAttributes },
        { model: Service, as: 'services', where: { is_active: true }, required: false },
      ],
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

/**
 * The signed-in provider's own profile. Mounted before /:id so it is not
 * swallowed by the uuid id matcher, and used by clients that only hold a user
 * token and have no way to guess their provider id.
 */
exports.getMyProviderProfile = async (req, res) => {
  try {
    const provider = await Provider.findOne({
      where: { user_id: req.user.id },
      include: [
        { model: User, as: 'user', ...publicUserAttributes },
        { model: Service, as: 'services', where: { is_active: true }, required: false },
      ],
    });

    if (!provider) {
      return res.status(404).json({ message: 'No provider profile for this account.' });
    }

    return res.json({ provider });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch profile.', error: error.message });
  }
};

/** The provider's own recurring working hours, one window per weekday. */
exports.getMyAvailability = async (req, res) => {
  try {
    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider) {
      return res.status(404).json({ message: 'No provider profile for this account.' });
    }

    const windows = await ProviderAvailability.findAll({
      where: { provider_id: provider.id },
      order: [['day_of_week', 'ASC']],
    });

    return res.json({
      availability: windows.map((window) => ({
        day_of_week: window.day_of_week,
        start_time: window.start_time,
        end_time: window.end_time,
        is_active: window.is_active,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch availability.', error: error.message });
  }
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Replace the whole week in one go. Sending the full set is simpler than
 * patching individual days and keeps it impossible to end up with two windows
 * on the same weekday.
 */
exports.replaceMyAvailability = async (req, res) => {
  try {
    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider) {
      return res.status(404).json({ message: 'No provider profile for this account.' });
    }

    const input = Array.isArray(req.body?.availability) ? req.body.availability : null;
    if (!input) {
      return res.status(400).json({ message: 'Send the week as an array of windows.' });
    }

    const normalised = [];
    const seen = new Set();
    for (const window of input) {
      const day = Number(window?.day_of_week);
      const start = String(window?.start_time ?? '');
      const end = String(window?.end_time ?? '');

      if (!Number.isInteger(day) || day < 0 || day > 6) {
        return res.status(400).json({ message: 'day_of_week must be a number from 0 (Sunday) to 6 (Saturday).' });
      }
      if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
        return res.status(400).json({ message: 'Times must be in 24-hour HH:MM format.' });
      }
      if (start >= end) {
        return res.status(400).json({ message: `A window must end after it starts (${start} to ${end}).` });
      }
      if (seen.has(day)) {
        return res.status(400).json({ message: 'Only one window is allowed per day.' });
      }
      seen.add(day);
      normalised.push({ day_of_week: day, start_time: start, end_time: end, is_active: window?.is_active !== false });
    }

await db.transaction(async (transaction) => {
      await ProviderAvailability.destroy({ where: { provider_id: provider.id }, transaction });
      if (normalised.length > 0) {
        await ProviderAvailability.bulkCreate(
          normalised.map((window) => ({ ...window, provider_id: provider.id })),
          { transaction },
        );
      }
    });

    // Mirror the week into the legacy working_hours blob so the older client,
    // which reads that field directly, keeps generating the same slots.
    const workingHours = {};
    for (const window of normalised) {
      if (!window.is_active) continue;
      const day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][window.day_of_week];
      workingHours[day] = [{ start: window.start_time, end: window.end_time }];
    }
    await provider.update({ working_hours: workingHours });

    return res.json({ message: 'Availability saved.', availability: normalised });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to save availability.', error: error.message });
  }
};
