const { Dispute, Booking, Provider } = require('../models');

exports.createDispute = async (req, res) => {
  try {
    const { booking_id, type, reason, description } = req.body;
    const booking = await Booking.findByPk(booking_id);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    const isCustomer = booking.customer_id === req.user.id;
    let isProviderForBooking = false;
    if (req.user.role === 'provider') {
      const provider = await Provider.findOne({ where: { user_id: req.user.id } });
      isProviderForBooking = provider && booking.provider_id === provider.id;
    }
    if (!isCustomer && !isProviderForBooking && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to report this booking.' });
    }

    const dispute = await Dispute.create({
      booking_id,
      reporter_id: req.user.id,
      provider_id: booking.provider_id,
      type: type || 'dispute',
      reason,
      description,
      status: 'open',
      reported_at: new Date(),
    });

    return res.status(201).json({ message: 'Report submitted.', dispute });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to submit report.', error: error.message });
  }
};

exports.getMyDisputes = async (req, res) => {
  try {
    const disputes = await Dispute.findAll({ where: { reporter_id: req.user.id } });
    return res.json({ disputes });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch reports.', error: error.message });
  }
};

exports.getAllDisputes = async (req, res) => {
  try {
    const { status, type } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const disputes = await Dispute.findAll({ where, include: [{ model: Booking, as: 'booking' }] });
    return res.json({ disputes });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch reports.', error: error.message });
  }
};

exports.resolveDispute = async (req, res) => {
  try {
    const { status, resolution_note } = req.body;
    const dispute = await Dispute.findByPk(req.params.id);
    if (!dispute) return res.status(404).json({ message: 'Report not found.' });

    await dispute.update({ status, resolution_note });
    return res.json({ message: 'Report updated.', dispute });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update report.', error: error.message });
  }
};