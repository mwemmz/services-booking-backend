const { Location, Provider, Booking } = require('../models');
const { emitToBooking, emitToUser } = require('../config/socket');
const { haversineDistance } = require('../utils/distance');
const config = require('../config/config');
const { createNotification } = require('../services/notificationService');

const TRACKABLE = ['accepted', 'on-the-way', 'arrived'];
const AVERAGE_SPEED_KMH = 30;
const FEEDBACK_COOLDOWN_MS = 20000;
const lastFeedback = new Map();

exports.updateProviderLocation = async (req, res) => {
  try {
    const { latitude, longitude, booking_id, accuracy, heading, speed } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'latitude and longitude are required.' });
    }

    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider) {
      return res.status(404).json({ message: 'Provider profile not found.' });
    }

    const maxAccuracy = config.location.maxAccuracyMeters;
    const parsedAccuracy = accuracy != null ? parseFloat(accuracy) : null;
    const isAccurate = parsedAccuracy === null || parsedAccuracy <= maxAccuracy;

    const location = await Location.create({
      provider_id: provider.id,
      latitude,
      longitude,
      booking_id: booking_id || null,
      accuracy: parsedAccuracy,
      heading: heading != null ? parseFloat(heading) : null,
      speed: speed != null ? parseFloat(speed) : null,
      is_accurate: isAccurate,
    });

    if (isAccurate) {
      await provider.update({
        location_lat: latitude,
        location_lng: longitude,
        location_accuracy: parsedAccuracy,
        last_location_update: new Date(),
      });
    }

    // Relay accurate fixes to the customer watching this booking, the same way the
    // socket 'location-update' path does, so REST-only clients still drive the live map.
    if (isAccurate && booking_id) {
      const booking = await Booking.findByPk(booking_id, {
        attributes: ['id', 'provider_id', 'status', 'location_lat', 'location_lng'],
      });
      if (booking && booking.provider_id === provider.id) {
        const payload = {
          bookingId: booking.id,
          providerId: req.user.id,
          latitude,
          longitude,
          accuracy: parsedAccuracy,
          heading: heading != null ? parseFloat(heading) : null,
          timestamp: new Date().toISOString(),
        };
        // Distance and a rough ETA to the customer's address, so every client shows the same figures.
        if (booking.location_lat != null && booking.location_lng != null) {
          const km = haversineDistance(
            parseFloat(latitude),
            parseFloat(longitude),
            parseFloat(booking.location_lat),
            parseFloat(booking.location_lng),
          );
          payload.distanceKm = Math.round(km * 10) / 10;
          payload.etaMinutes = Math.max(1, Math.round((km / AVERAGE_SPEED_KMH) * 60));
        }
        emitToBooking(booking_id, 'provider-location', payload);
      }
    }

    return res.json({
      message: 'Location updated.',
      location,
      is_accurate: isAccurate,
      rejected_reason: isAccurate
        ? null
        : `GPS accuracy ${parsedAccuracy}m exceeds max ${maxAccuracy}m. Fix not applied to provider position.`,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update location.', error: error.message });
  }
};

exports.getBookingLocationHistory = async (req, res) => {
  try {
    const locations = await Location.findAll({
      where: { booking_id: req.params.bookingId },
      include: [{ model: Provider, as: 'provider' }],
      order: [['createdAt', 'ASC']],
    });

    return res.json({ locations });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch location history.', error: error.message });
  }
};

exports.calculateDistance = async (req, res) => {
  try {
    const { lat1, lng1, lat2, lng2 } = req.query;

    if (!lat1 || !lng1 || !lat2 || !lng2) {
      return res.status(400).json({ message: 'All four coordinates (lat1, lng1, lat2, lng2) are required.' });
    }

    const distance = haversineDistance(
      parseFloat(lat1),
      parseFloat(lng1),
      parseFloat(lat2),
      parseFloat(lng2)
    );

    return res.json({ distance: Math.round(distance * 100) / 100 });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to calculate distance.', error: error.message });
  }
};

/** PUT /bookings/:id/location: the provider shares a live fix for one of their own jobs. */
exports.updateBookingLocation = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id, { attributes: ['id', 'provider_id', 'status'] });
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider || booking.provider_id !== provider.id) {
      return res.status(403).json({ message: 'You can only share location for your own bookings.' });
    }
    if (!TRACKABLE.includes(booking.status)) {
      return res.status(400).json({ message: `Location cannot be shared while a booking is ${booking.status}.` });
    }
    req.body = { ...req.body, booking_id: booking.id };
    return exports.updateProviderLocation(req, res);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to share location.', error: error.message });
  }
};

/** PUT /bookings/:id/route-feedback: the customer tells the provider they are heading the wrong way. */
exports.reportWrongRoute = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id, {
      attributes: ['id', 'customer_id', 'provider_id', 'status'],
      include: [{ model: Provider, as: 'provider', attributes: ['id', 'user_id'] }],
    });
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    if (booking.customer_id !== req.user.id) {
      return res.status(403).json({ message: 'Only the customer on this booking can report a wrong route.' });
    }
    if (booking.status !== 'on-the-way') {
      return res.status(400).json({ message: 'You can report a wrong route only while the provider is on the way.' });
    }
    const last = lastFeedback.get(booking.id) || 0;
    if (Date.now() - last < FEEDBACK_COOLDOWN_MS) {
      return res.status(429).json({ message: 'Your provider was just alerted. Please wait a moment before alerting again.' });
    }
    lastFeedback.set(booking.id, Date.now());

    const message = (req.body?.message || '').toString().trim().slice(0, 140)
      || 'The customer says you are going the wrong way. Please check the route.';
    const payload = { bookingId: booking.id, message, timestamp: new Date().toISOString() };
    emitToUser(booking.provider.user_id, 'route-feedback', payload);
    await createNotification(booking.provider.user_id, 'route_feedback', 'Wrong route reported', message, {
      bookingId: booking.id,
    });
    return res.json({ message: 'Your provider has been alerted.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to report route.', error: error.message });
  }
};
