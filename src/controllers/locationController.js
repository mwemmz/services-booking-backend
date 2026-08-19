const { Location, Provider } = require('../models');
const { haversineDistance } = require('../utils/distance');

exports.updateProviderLocation = async (req, res) => {
  try {
    const { latitude, longitude, booking_id } = req.body;

    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider) {
      return res.status(404).json({ message: 'Provider profile not found.' });
    }

    await provider.update({ location_lat: latitude, location_lng: longitude });

    const location = await Location.create({
      provider_id: provider.id,
      latitude,
      longitude,
      booking_id: booking_id || null,
    });

    return res.json({ message: 'Location updated.', location });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update location.', error: error.message });
  }
};

exports.getBookingLocationHistory = async (req, res) => {
  try {
    const locations = await Location.findAll({
      where: { booking_id: req.params.bookingId },
      include: [{ model: Provider, as: 'provider' }],
      order: [['created_at', 'ASC']],
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
