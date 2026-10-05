const { Op } = require('sequelize');
const {
  Booking, User, Provider, Service, Payment, Crew, Review, Endorsement,
  BookingStatusHistory, Transaction,
} = require('../models');
const { paginate, buildPaginationResponse } = require('../utils/pagination');
const { checkAvailability, generateSlots } = require('../services/bookingAvailability');
const { markBookingVerified } = require('../services/providerTrustService');
const { createNotification, notifyBookingUpdate } = require('../services/notificationService');
const { sendBookingConfirmation } = require('../services/emailService');
const { emitToUser, emitToBooking } = require('../config/socket');

// Timeline + earnings helpers, shared with the expiry cron.
const { recordStatus, syncTransaction } = require('../services/bookingLedger');

/** Push a booking status change to everyone involved (customer, provider, viewers). */
const broadcastBookingStatus = async (bookingId, status, customerId, providerId) => {
  const payload = { bookingId, status, timestamp: new Date().toISOString() };
  emitToBooking(bookingId, 'booking-status-update', payload);
  emitToUser(customerId, 'booking-status-update', payload);
  if (providerId) {
    const profile = await Provider.findByPk(providerId, { attributes: ['user_id'] });
    if (profile) emitToUser(profile.user_id, 'booking-status-update', payload);
  }
};

const VALID_TRANSITIONS = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['on-the-way', 'cancelled'],
  'on-the-way': ['arrived', 'in-progress', 'cancelled'],
  arrived: ['in-progress', 'cancelled'],
  'in-progress': ['completed'],
  completed: ['paid'],
};

exports.createBooking = async (req, res) => {
  try {
    const { provider_id, service_id, booking_time, location_lat, location_lng, address, notes, crew_id } = req.body;

    const service = await Service.findByPk(service_id);
    if (!service || !service.is_active) {
      return res.status(404).json({ message: 'Service not found or inactive.' });
    }

    const provider = await Provider.findByPk(provider_id);
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found.' });
    }

    // If booking a crew, the crew must exist and belong to this provider.
    if (crew_id) {
      const crew = await Crew.findByPk(crew_id);
      if (!crew) return res.status(404).json({ message: 'Crew not found.' });
      if (crew.leader_id !== provider_id) {
        return res.status(400).json({ message: 'Crew does not belong to the chosen provider.' });
      }
    }

    // Prevent double-booking of the same provider/service time slot.
    const availability = await checkAvailability({
      providerId: provider_id,
      serviceId: service_id,
      bookingTime: booking_time,
      serviceDurationMin: service.duration,
    });
    if (!availability.available) {
      return res.status(409).json({
        message: 'This time slot is already booked for the provider.',
        conflict_id: availability.conflict,
      });
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
      crew_id: crew_id || null,
      expires_at: expiresAt,
      status: 'pending',
    });

    // Timeline entry and the opening ledger row for what the provider will earn.
    await recordStatus(booking.id, 'pending', 'Booking requested', req.user.id);
    await syncTransaction(booking, { amount: service.price, status: 'PENDING' });

    const fullBooking = await Booking.findByPk(booking.id, {
      include: [
        { model: User, as: 'customer' },
        { model: Provider, as: 'provider' },
        { model: Service, as: 'service' },
        { model: Crew, as: 'crew' },
      ],
    });

    // Real-time: deliver the new request to the provider + record an in-app notification.
    emitToUser(provider.user_id, 'new-booking', {
      bookingId: booking.id,
      timestamp: new Date().toISOString(),
    });
    await createNotification(
      provider.user_id,
      'new_request',
      'New booking request',
      `${service.name} was requested${fullBooking?.customer?.name ? ` by ${fullBooking.customer.name}` : ''}.`,
      { bookingId: booking.id },
    );

    // Best-effort confirmation email to the customer (emails are optional to configure).
    const customerUser = await User.findByPk(booking.customer_id, { attributes: ['email'] });
    if (customerUser?.email) {
      await sendBookingConfirmation(customerUser.email, {
        serviceName: service.name,
        providerName: fullBooking?.provider?.business_name || 'Your provider',
        bookingTime: booking.booking_time,
        address: booking.address,
        totalAmount: booking.total_amount,
      });
    }

    return res.status(201).json({ message: 'Booking created.', booking: fullBooking });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create booking.', error: error.message });
  }
};

/**
 * Check whether a provider is free at a given time. Public availability check.
 */
exports.checkAvailabilityEndpoint = async (req, res) => {
  try {
    const { provider_id, service_id, booking_time } = req.query;
    if (!provider_id || !booking_time) {
      return res.status(400).json({ message: 'provider_id and booking_time are required.' });
    }

    let duration = null;
    if (service_id) {
      const service = await Service.findByPk(service_id);
      if (service) duration = service.duration;
    }

    const result = await checkAvailability({
      providerId: provider_id,
      serviceId: service_id,
      bookingTime: booking_time,
      serviceDurationMin: duration || 60,
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to check availability.', error: error.message });
  }
};

/**
 * Generate available time slots for a provider on a given date.
 */
exports.getProviderSlots = async (req, res) => {
  try {
    const { provider_id, date, slot_minutes, duration } = req.query;
    if (!provider_id || !date) {
      return res.status(400).json({ message: 'provider_id and date are required.' });
    }

    const result = await generateSlots({
      providerId: provider_id,
      date,
      slotMinutes: slot_minutes ? parseInt(slot_minutes) : 30,
      durationMin: duration ? parseInt(duration) : null,
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to generate slots.', error: error.message });
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

exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id, {
      include: [
        { model: User, as: 'customer' },
        { model: Provider, as: 'provider', include: [{ model: User, as: 'user' }] },
        { model: Service, as: 'service' },
        { model: Payment, as: 'payment' },
        { model: Crew, as: 'crew', include: [{ model: Provider, as: 'members' }] },
        { model: Review, as: 'review' },
        { model: Endorsement, as: 'endorsement' },
        { model: Transaction, as: 'transaction' },
        {
          model: BookingStatusHistory,
          as: 'statusHistory',
          separate: true,
          order: [['createdAt', 'ASC']],
        },
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
    const { status, quoted_price: quotedPrice } = req.body;

    const booking = await Booking.findByPk(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // Applying the same status is a harmless no-op (helps idempotent retries).
    if (status === booking.status) {
      return res.json({ message: `Booking is already '${status}'.`, booking });
    }

    const allowed = VALID_TRANSITIONS[booking.status];
    if (!allowed || !allowed.includes(status)) {
      return res.status(400).json({
        message: `Cannot transition from '${booking.status}' to '${status}'.`,
      });
    }

    // Sending a price is not the same as accepting the job. When the provider
    // quotes, the booking stays pending until the customer agrees, so the amount
    // is a decision they actually make rather than one already imposed on them.
    const isQuote = status === 'accepted' && quotedPrice !== undefined && quotedPrice !== null;
    let quoteAmount = null;
    if (isQuote) {
      quoteAmount = Number(quotedPrice);
      if (!Number.isFinite(quoteAmount) || quoteAmount < 1) {
        return res.status(400).json({ message: 'Enter a price in kwacha.' });
      }
    }

    const updates = { status: isQuote ? booking.status : status };
    if (isQuote) updates.quoted_price = quoteAmount;

    await booking.update(updates);

    // A booking is only verified work history once the customer reviews it AND
    // a different worker confirms it. Re-evaluate so an early confirmation
    // (before the job finished) still upgrades a stale is_confirmed=false.
    if (['completed', 'paid'].includes(status)) {
      await markBookingVerified(booking.id);
    }

    const providerProfile = await Provider.findByPk(booking.provider_id, { attributes: ['user_id'] });

    if (isQuote) {
      // The ledger keeps the listed price until the customer accepts; the
      // timeline records the proposal so the wait is visible to both parties.
      await recordStatus(
        booking.id,
        booking.status,
        `Provider proposed K${quoteAmount} — waiting for the customer to accept`,
        req.user.id,
      );

      const payload = { bookingId: booking.id, quoted_price: quoteAmount, timestamp: new Date().toISOString() };
      emitToBooking(booking.id, 'booking-quote', payload);
      emitToUser(booking.customer_id, 'booking-quote', payload);

      await notifyBookingUpdate(booking.customer_id, 'quote', booking.id);
      if (providerProfile) await notifyBookingUpdate(providerProfile.user_id, 'quote', booking.id);

      return res.json({ message: 'Quote sent to the customer.', booking });
    }

    // Money moves: earned on completion, voided on cancellation.
    if (status === 'completed') {
      await syncTransaction(booking, { status: 'EARNED' });
    }

    await recordStatus(booking.id, status, null, req.user.id);

    await broadcastBookingStatus(booking.id, status, booking.customer_id, booking.provider_id);
    // Persist + push a notification to both parties for every status change.
    await notifyBookingUpdate(booking.customer_id, status, booking.id);
    if (providerProfile) await notifyBookingUpdate(providerProfile.user_id, status, booking.id);

    return res.json({ message: 'Booking status updated.', booking });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update booking status.', error: error.message });
  }
};

/**
 * Provider declines a pending request. Distinct from a cancellation because the
 * request was never taken on, so the ledger row is voided rather than cancelled.
 */
exports.rejectBooking = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider || booking.provider_id !== provider.id) {
      return res.status(403).json({ message: 'Not authorized to decline this request.' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ message: 'This request can no longer be declined.' });
    }

    const note = (req.body.reason || '').trim() || 'Provider declined the request';

    await booking.update({ status: 'rejected' });
    await syncTransaction(booking, { status: 'VOID' });
    await recordStatus(booking.id, 'rejected', note, req.user.id);

    await broadcastBookingStatus(booking.id, 'rejected', booking.customer_id, booking.provider_id);
    await notifyBookingUpdate(booking.customer_id, 'rejected', booking.id);

    return res.json({ message: 'Request declined.', booking });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to decline request.', error: error.message });
  }
};

/**
 * Customer accepts the price a provider quoted, which locks the job in at that
 * amount. Without a quote there is nothing to confirm.
 */
exports.confirmQuote = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    if (booking.customer_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only accept quotes on your own bookings.' });
    }

    if (booking.status !== 'pending' || booking.quoted_price === null) {
      return res.status(400).json({ message: 'There is no price to accept yet.' });
    }

    const amount = Number(booking.quoted_price);
    await booking.update({ status: 'accepted', total_amount: amount });

    await syncTransaction(booking, { amount, status: 'PENDING' });
    await recordStatus(booking.id, 'accepted', `Customer accepted the price of K${amount}`, req.user.id);

    await broadcastBookingStatus(booking.id, 'accepted', booking.customer_id, booking.provider_id);
    await notifyBookingUpdate(booking.customer_id, 'accepted', booking.id);
    const providerProfile = await Provider.findByPk(booking.provider_id, { attributes: ['user_id'] });
    if (providerProfile) await notifyBookingUpdate(providerProfile.user_id, 'accepted', booking.id);

    return res.json({ message: 'Quote accepted.', booking });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to accept quote.', error: error.message });
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

    if (!['pending', 'accepted', 'on-the-way', 'arrived'].includes(booking.status)) {
      return res.status(400).json({ message: 'Can only cancel bookings that are pending, accepted, or on the way.' });
    }

    await booking.update({ status: 'cancelled' });

    await syncTransaction(booking, { status: 'VOID' });
    await recordStatus(booking.id, 'cancelled', 'Booking cancelled', req.user.id);

    await broadcastBookingStatus(booking.id, 'cancelled', booking.customer_id, booking.provider_id);
    // Let both sides know the job is off.
    await notifyBookingUpdate(booking.customer_id, 'cancelled', booking.id);
    const providerProfile = await Provider.findByPk(booking.provider_id, { attributes: ['user_id'] });
    if (providerProfile) await notifyBookingUpdate(providerProfile.user_id, 'cancelled', booking.id);

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

// Feature 2: Confirmed Work History - only bookings marked is_confirmed count.
exports.getWorkHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const provider = await Provider.findOne({ where: { user_id: req.params.providerId || req.user.id } });
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found.' });
    }

    const where = { provider_id: provider.id, is_confirmed: true };

    const [bookings, confirmedCount, totalEarned, jobCount] = await Promise.all([
      Booking.findAll(paginate({
        where,
        include: [
          { model: User, as: 'customer' },
          { model: Service, as: 'service' },
          { model: Payment, as: 'payment' },
          { model: Endorsement, as: 'endorsement' },
        ],
        order: [['updatedAt', 'DESC']],
      }, { page, limit })),
      Booking.count({ where }),
      Booking.sum('total_amount', { where: { ...where, status: { [Op.ne]: 'cancelled' } } }),
      Booking.count({ where: { provider_id: provider.id } }),
    ]);

    return res.json({
      summary: {
        confirmedJobs: confirmedCount,
        totalEarned: totalEarned || 0,
        totalJobs: jobCount,
      },
      bookings,
      pagination: buildPaginationResponse(confirmedCount, page, limit),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch work history.', error: error.message });
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

/** Re-book a past job: clone the provider/service/location into a fresh pending booking. */
exports.rebookBooking = async (req, res) => {
  try {
    const previous = await Booking.findByPk(req.params.id);
    if (!previous) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    if (previous.customer_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only re-book your own bookings.' });
    }

    if (!['completed', 'paid', 'cancelled', 'expired'].includes(previous.status)) {
      return res.status(400).json({ message: 'This booking is still active and cannot be re-booked.' });
    }

    const service = await Service.findByPk(previous.service_id);
    if (!service || !service.is_active) {
      return res.status(404).json({ message: 'Service not found or inactive.' });
    }

    const provider = await Provider.findByPk(previous.provider_id);
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found.' });
    }

    const booking_time = req.body.booking_time || new Date(Date.now() + 15 * 60 * 1000);
    if (req.body.crew_id) {
      const crew = await Crew.findByPk(req.body.crew_id);
      if (!crew) return res.status(404).json({ message: 'Crew not found.' });
      if (crew.leader_id !== previous.provider_id) {
        return res.status(400).json({ message: 'Crew does not belong to the chosen provider.' });
      }
    }

    const availability = await checkAvailability({
      providerId: previous.provider_id,
      serviceId: previous.service_id,
      bookingTime: booking_time,
      serviceDurationMin: service.duration,
    });
    if (!availability.available) {
      return res.status(409).json({
        message: 'This time slot is already booked for the provider.',
        conflict_id: availability.conflict,
      });
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const booking = await Booking.create({
      customer_id: req.user.id,
      provider_id: previous.provider_id,
      service_id: previous.service_id,
      booking_time,
      total_amount: service.price,
      location_lat: previous.location_lat,
      location_lng: previous.location_lng,
      address: previous.address,
      notes: previous.notes,
      crew_id: req.body.crew_id || previous.crew_id || null,
      expires_at: expiresAt,
      status: 'pending',
    });

    // A rebook is a fresh request, so it starts its own timeline and ledger row.
    await recordStatus(booking.id, 'pending', 'Booking requested', req.user.id);
    await syncTransaction(booking, { amount: service.price, status: 'PENDING' });

    const fullBooking = await Booking.findByPk(booking.id, {
      include: [
        { model: User, as: 'customer' },
        { model: Provider, as: 'provider' },
        { model: Service, as: 'service' },
        { model: Crew, as: 'crew' },
      ],
    });

    emitToUser(provider.user_id, 'new-booking', {
      bookingId: booking.id,
      timestamp: new Date().toISOString(),
    });
    await createNotification(
      provider.user_id,
      'new_request',
      'New booking request',
      `${service.name} was re-booked${fullBooking?.customer?.name ? ` by ${fullBooking.customer.name}` : ''}.`,
      { bookingId: booking.id },
    );

    const customerUser = await User.findByPk(booking.customer_id, { attributes: ['email'] });
    if (customerUser?.email) {
      await sendBookingConfirmation(customerUser.email, {
        serviceName: service.name,
        providerName: fullBooking?.provider?.business_name || 'Your provider',
        bookingTime: booking.booking_time,
        address: booking.address,
        totalAmount: booking.total_amount,
      });
    }

    return res.status(201).json({ message: 'Booking re-created.', booking: fullBooking });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to re-book.', error: error.message });
  }
};
