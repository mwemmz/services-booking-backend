const { Op } = require('sequelize');
const { Booking, User, Provider, Service, Payment } = require('../models');
const { paginate, buildPaginationResponse } = require('../utils/pagination');

const VALID_TRANSITIONS = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['in-progress', 'cancelled'],
  'in-progress': ['completed'],
  completed: ['paid'],
};

exports.createBooking = async (req, res) => {
  try {
    const { provider_id, service_id, booking_time, location_lat, location_lng, address, notes } = req.body;

    const service = await Service.findByPk(service_id);
    if (!service || !service.is_active) {
      return res.status(404).json({ message: 'Service not found or inactive.' });
    }

    const provider = await Provider.findByPk(provider_id);
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found.' });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    const booking = await Booking.create({
      customer_id: req.user.id,
      provider_id,
      service_id,
      booking_time,
      total_amount: service.price,
      location_lat,
      location_lng,
      address,
      notes,
      expires_at: expiresAt,
      status: 'pending',
    });

    const fullBooking = await Booking.findByPk(booking.id, {
      include: [
        { model: User, as: 'customer' },
        { model: Provider, as: 'provider' },
        { model: Service, as: 'service' },
      ],
    });

    return res.status(201).json({ message: 'Booking created.', booking: fullBooking });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create booking.', error: error.message });
  }
};

exports.getAllBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const where = {};

    if (req.user.role === 'customer') {
      where.customer_id = req.user.id;
    } else if (req.user.role === 'provider') {
      const provider = await Provider.findOne({ where: { user_id: req.user.id } });
      if (!provider) {
        return res.status(404).json({ message: 'Provider profile not found.' });
      }
      where.provider_id = provider.id;
    }

    if (status) where.status = status;

    const query = paginate({
      where,
      include: [
        { model: User, as: 'customer' },
        { model: Provider, as: 'provider' },
        { model: Service, as: 'service' },
        { model: Payment, as: 'payment' },
      ],
      order: [['created_at', 'DESC']],
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

exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id, {
      include: [
        { model: User, as: 'customer' },
        { model: Provider, as: 'provider', include: [{ model: User, as: 'user' }] },
        { model: Service, as: 'service' },
        { model: Payment, as: 'payment' },
      ],
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    return res.json({ booking });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch booking.', error: error.message });
  }
};

exports.updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const booking = await Booking.findByPk(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const allowed = VALID_TRANSITIONS[booking.status];
    if (!allowed || !allowed.includes(status)) {
      return res.status(400).json({
        message: `Cannot transition from '${booking.status}' to '${status}'.`,
      });
    }

    await booking.update({ status });

    return res.json({ message: 'Booking status updated.', booking });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update booking status.', error: error.message });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const isCustomer = booking.customer_id === req.user.id;
    let isProvider = false;
    if (req.user.role === 'provider') {
      const provider = await Provider.findOne({ where: { user_id: req.user.id } });
      isProvider = provider && booking.provider_id === provider.id;
    }

    if (!isCustomer && !isProvider) {
      return res.status(403).json({ message: 'Not authorized to cancel this booking.' });
    }

    if (!['pending', 'accepted'].includes(booking.status)) {
      return res.status(400).json({ message: 'Can only cancel bookings that are pending or accepted.' });
    }

    await booking.update({ status: 'cancelled' });

    return res.json({ message: 'Booking cancelled.', booking });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to cancel booking.', error: error.message });
  }
};

exports.getCustomerBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const where = { customer_id: req.params.customerId || req.user.id };
    if (status) where.status = status;

    const query = paginate({
      where,
      include: [
        { model: Provider, as: 'provider' },
        { model: Service, as: 'service' },
        { model: Payment, as: 'payment' },
      ],
      order: [['created_at', 'DESC']],
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

exports.getProviderBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const provider = await Provider.findOne({ where: { user_id: req.params.providerId || req.user.id } });
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found.' });
    }

    const where = { provider_id: provider.id };
    if (status) where.status = status;

    const query = paginate({
      where,
      include: [
        { model: User, as: 'customer' },
        { model: Service, as: 'service' },
        { model: Payment, as: 'payment' },
      ],
      order: [['created_at', 'DESC']],
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
