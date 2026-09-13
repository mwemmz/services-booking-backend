const { Booking, Endorsement, Provider, Review, User } = require('../models');
const { createNotification } = require('../services/notificationService');
const { markBookingVerified, recomputeProviderRating } = require('../services/providerTrustService');

/**
 * Provider requests a peer worker to verify a completed job.
 * The peer is found by their account email and must be a different worker.
 */
exports.requestEndorsement = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: 'Peer worker email is required.' });
    }

    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider) {
      return res.status(404).json({ message: 'Provider profile not found.' });
    }

    const booking = await Booking.findByPk(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }
    if (booking.provider_id !== provider.id) {
      return res.status(403).json({ message: 'You can only request verification for your own jobs.' });
    }
    if (!['completed', 'paid'].includes(booking.status)) {
      return res.status(400).json({ message: 'Only completed jobs can be verified.' });
    }

    const peerUser = await User.findOne({ where: { email } });
    if (!peerUser || peerUser.role !== 'provider') {
      return res.status(400).json({ message: 'No worker account matches that email.' });
    }
    const peer = await Provider.findOne({ where: { user_id: peerUser.id } });
    if (!peer) {
      return res.status(400).json({ message: 'No worker profile matches that email.' });
    }
    if (peer.id === provider.id) {
      return res.status(400).json({ message: 'Another worker must verify your job — you cannot verify it yourself.' });
    }

    let endorsement = await Endorsement.findOne({ where: { booking_id: booking.id } });
    if (endorsement && endorsement.status === 'pending') {
      return res.status(409).json({ message: 'A verification request is already waiting for this job.' });
    }

    if (endorsement) {
      await endorsement.update({
        requester_id: provider.id,
        peer_id: peer.id,
        peer_user_email: email,
        status: 'pending',
        note: null,
        responded_at: null,
      });
    } else {
      endorsement = await Endorsement.create({
        booking_id: booking.id,
        requester_id: provider.id,
        peer_id: peer.id,
        peer_user_email: email,
        status: 'pending',
      });
    }

    await createNotification(
      peerUser.id,
      'endorsement_request',
      'Job verification requested',
      `${provider.business_name} asked you to verify a completed job.`,
      { bookingId: booking.id, endorsementId: endorsement.id },
    );

    return res.status(201).json({ message: 'Verification request sent.', endorsement });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to request verification.', error: error.message });
  }
};

/**
 * Pending verification requests addressed to the logged-in provider.
 */
exports.getMyPendingEndorsements = async (req, res) => {
  try {
    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider) {
      return res.status(404).json({ message: 'Provider profile not found.' });
    }

    const endorsements = await Endorsement.findAll({
      where: { peer_id: provider.id, status: 'pending' },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Booking,
          as: 'booking',
          include: [
            { model: User, as: 'customer', attributes: ['id', 'name'] },
            { model: Provider, as: 'provider', attributes: ['id', 'business_name'] },
          ],
        },
      ],
    });

    return res.json({ endorsements });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch verification requests.', error: error.message });
  }
};

/**
 * Peer worker confirms the job actually happened.
 */
exports.confirmEndorsement = async (req, res) => {
  try {
    const endorsement = await Endorsement.findByPk(req.params.id, {
      include: [{ model: Booking, as: 'booking', attributes: ['id', 'provider_id', 'customer_id', 'status'] }],
    });
    if (!endorsement) {
      return res.status(404).json({ message: 'Verification request not found.' });
    }

    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider || endorsement.peer_id !== provider.id) {
      return res.status(403).json({ message: 'This request was not addressed to you.' });
    }
    if (endorsement.status !== 'pending') {
      return res.status(409).json({ message: 'This request was already answered.' });
    }
    if (!endorsement.booking || !['completed', 'paid'].includes(endorsement.booking.status)) {
      return res.status(400).json({ message: 'The job must be completed before it can be verified.' });
    }

    await endorsement.update({
      status: 'confirmed',
      note: (req.body.note || '').trim() || null,
      responded_at: new Date(),
    });

    // Only now does the booking become verified work history + count toward the rating.
    await markBookingVerified(endorsement.booking_id);
    await recomputeProviderRating(endorsement.booking.provider_id);

    return res.json({ message: 'Job verified. Thank you for vouching for this worker.', endorsement });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to confirm verification.', error: error.message });
  }
};

/**
 * Peer worker declines to vouch for the job.
 */
exports.declineEndorsement = async (req, res) => {
  try {
    const endorsement = await Endorsement.findByPk(req.params.id, {
      include: [{ model: Booking, as: 'booking', attributes: ['id', 'provider_id', 'customer_id'] }],
    });
    if (!endorsement) {
      return res.status(404).json({ message: 'Verification request not found.' });
    }

    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider || endorsement.peer_id !== provider.id) {
      return res.status(403).json({ message: 'This request was not addressed to you.' });
    }
    if (endorsement.status !== 'pending') {
      return res.status(409).json({ message: 'This request was already answered.' });
    }

    await endorsement.update({ status: 'declined', responded_at: new Date() });

    return res.json({ message: 'Verification declined.', endorsement });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to decline verification.', error: error.message });
  }
};

/**
 * Public status + customer review presence for one booking (used by job detail screens).
 */
exports.getEndorsementForBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const [endorsement, review] = await Promise.all([
      Endorsement.findOne({ where: { booking_id: bookingId } }),
      Review.findOne({ where: { booking_id: bookingId }, attributes: ['id', 'rating'] }),
    ]);

    return res.json({
      endorsement,
      customerReview: review ? { id: review.id, rating: review.rating } : null,
      verified: Boolean(endorsement && endorsement.status === 'confirmed' && review),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch verification status.', error: error.message });
  }
};