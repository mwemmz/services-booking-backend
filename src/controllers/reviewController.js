const { Review, Booking, Provider, User } = require('../models');
const { paginate, buildPaginationResponse } = require('../utils/pagination');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

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

    const provider = await Provider.findByPk(booking.provider_id);
    if (provider) {
      const stats = await Review.findOne({
        where: { provider_id: booking.provider_id },
        attributes: [
          [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalReviews'],
        ],
        raw: true,
      });
      await provider.update({
        rating: parseFloat(stats.avgRating) || 0,
        total_reviews: parseInt(stats.totalReviews) || 0,
      });
    }

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

    const stats = await Review.findOne({
      where: { provider_id: req.params.providerId },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('rating')), 'averageRating'],
      ],
      raw: true,
    });

    return res.json({
      reviews,
      averageRating: parseFloat(stats.averageRating) || 0,
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

    const provider = await Provider.findByPk(review.provider_id);
    if (provider) {
      const stats = await Review.findOne({
        where: { provider_id: review.provider_id },
        attributes: [
          [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalReviews'],
        ],
        raw: true,
      });
      await provider.update({
        rating: parseFloat(stats.avgRating) || 0,
        total_reviews: parseInt(stats.totalReviews) || 0,
      });
    }

    return res.json({ message: 'Review deleted.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete review.', error: error.message });
  }
};
