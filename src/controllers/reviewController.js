const { Review, Booking, Provider, User, Endorsement } = require('../models');
const { paginate, buildPaginationResponse } = require('../utils/pagination');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { markBookingVerified, recomputeProviderRating } = require('../services/providerTrustService');

exports.createReview = async (req, res) => {
  try {
    const { booking_id, rating, comment } = req.body;

    const booking = await Booking.findByPk(booking_id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    if (booking.customer_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only review your own bookings.' });
    }

    if (booking.status !== 'completed' && booking.status !== 'paid') {
      return res.status(400).json({ message: 'Can only review completed or paid bookings.' });
    }

    const existingReview = await Review.findOne({ where: { booking_id } });
    if (existingReview) {
      return res.status(409).json({ message: 'Review already exists for this booking.' });
    }

    const review = await Review.create({
      booking_id,
      customer_id: req.user.id,
      provider_id: booking.provider_id,
      rating,
      comment,
    });

    // Rating only counts once a different worker confirms the job (spec rule).
    await recomputeProviderRating(booking.provider_id);
    // If the peer already confirmed earlier, this completed review makes it verified.
    await markBookingVerified(booking_id);

    return res.status(201).json({ message: 'Review created.', review });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create review.', error: error.message });
  }
};

exports.getProviderReviews = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const query = paginate({
      where: { provider_id: req.params.providerId },
      include: [{ model: User, as: 'customer' }],
      order: [['created_at', 'DESC']],
    }, { page, limit });

    const { count, rows: reviews } = await Review.findAndCountAll(query);

    // Align the displayed average with the confirmed-only provider rating.
    const confirmed = await Endorsement.findAll({ where: { status: 'confirmed' }, attributes: ['booking_id'] });
    const confirmedIds = confirmed.map((e) => e.booking_id);
    const confirmedWhere = { provider_id: req.params.providerId };
    if (confirmedIds.length > 0) confirmedWhere.booking_id = { [Op.in]: confirmedIds };
    else confirmedWhere.booking_id = null;

    const stats = await Review.findOne({
      where: confirmedWhere,
      attributes: [
        [sequelize.fn('AVG', sequelize.col('rating')), 'averageRating'],
      ],
      raw: true,
    });
    const providerForRating = await Provider.findByPk(req.params.providerId, { attributes: ['rating'] });

    return res.json({
      reviews,
      averageRating: stats && stats.averageRating != null ? parseFloat(stats.averageRating) : (providerForRating ? parseFloat(providerForRating.rating) || 0 : 0),
      pagination: buildPaginationResponse(count, page, limit),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch reviews.', error: error.message });
  }
};

exports.getReviewById = async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id, {
      include: [
        { model: User, as: 'customer' },
        { model: Provider, as: 'provider' },
        { model: Booking, as: 'booking' },
      ],
    });

    if (!review) {
      return res.status(404).json({ message: 'Review not found.' });
    }

    return res.json({ review });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch review.', error: error.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found.' });
    }

    const isOwner = review.customer_id === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this review.' });
    }

    await review.destroy();

    await recomputeProviderRating(review.provider_id);
    // Removing the customer's review un-verifies the booking.
    await markBookingVerified(review.booking_id);

    return res.json({ message: 'Review deleted.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete review.', error: error.message });
  }
};
