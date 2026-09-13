const { Op } = require('sequelize');
const { Booking, Provider, Review, Endorsement } = require('../models');

/**
 * A booking becomes "verified work history" only when:
 *  - it is completed or paid
 *  - the customer has left a review/rating
 *  - a DIFFERENT worker has confirmed it via a peer endorsement
 */
exports.markBookingVerified = async (bookingId) => {
  const booking = await Booking.findByPk(bookingId);
  if (!booking) return false;

  const eligible = ['completed', 'paid'].includes(booking.status);
  const [review, endorsement] = await Promise.all([
    Review.findOne({ where: { booking_id: bookingId } }),
    Endorsement.findOne({ where: { booking_id: bookingId, status: 'confirmed' } }),
  ]);

  const verified = Boolean(eligible && review && endorsement);
  if (booking.is_confirmed !== verified) {
    await booking.update({ is_confirmed: verified });
  }
  return verified;
};

/** Fallback until a worker has confirmed jobs (per spec: default starting rating). */
const DEFAULT_STARTING_RATING = '4.50';

/**
 * Recompute a provider's public rating from confirmed jobs only:
 * ratings on bookings that ALSO have a confirmed peer endorsement.
 */
exports.recomputeProviderRating = async (providerId) => {
  const confirmed = await Endorsement.findAll({ where: { status: 'confirmed' }, attributes: ['booking_id'] });
  const confirmedBookingIds = confirmed.map((e) => e.booking_id);

  let reviews = [];
  if (confirmedBookingIds.length > 0) {
    reviews = await Review.findAll({
      where: { provider_id: providerId, booking_id: { [Op.in]: confirmedBookingIds } },
      attributes: ['rating'],
      raw: true,
    });
  }

  const totalReviews = reviews.length;
  let rating = DEFAULT_STARTING_RATING;
  if (totalReviews > 0) {
    const avg = reviews.reduce((sum, r) => sum + parseFloat(r.rating), 0) / totalReviews;
    rating = avg.toFixed(2);
  }

  const provider = await Provider.findByPk(providerId);
  if (provider) {
    await provider.update({ rating, total_reviews: totalReviews });
  }

  return { rating, total_reviews: totalReviews };
};