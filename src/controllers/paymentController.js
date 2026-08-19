const { v4: uuidv4 } = require('uuid');
const { Payment, Booking } = require('../models');
const { paginate, buildPaginationResponse } = require('../utils/pagination');
const config = require('../config/config');

exports.initializePayment = async (req, res) => {
  try {
    const { booking_id, payment_method } = req.body;

    const booking = await Booking.findByPk(booking_id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Booking must be completed before payment.' });
    }

    const transactionRef = `PAY-${uuidv4()}`;

    const payment = await Payment.create({
      booking_id,
      amount: booking.total_amount,
      status: 'pending',
      transaction_ref: transactionRef,
      payment_method,
    });

    const paymentUrl = `${config.payment.apiUrl}/pay?ref=${transactionRef}&amount=${booking.total_amount}`;

    return res.status(201).json({
      message: 'Payment initialized.',
      payment,
      paymentUrl,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to initialize payment.', error: error.message });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { transaction_ref } = req.body;

    const payment = await Payment.findOne({ where: { transaction_ref } });
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found.' });
    }

    const verified = true;

    if (verified) {
      await payment.update({ status: 'completed' });
      await Booking.update({ status: 'paid' }, { where: { id: payment.booking_id } });
    } else {
      await payment.update({ status: 'failed' });
    }

    return res.json({ message: 'Payment verified.', payment });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to verify payment.', error: error.message });
  }
};

exports.getBookingPayments = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const query = paginate({
      where: { booking_id: req.params.bookingId },
      order: [['created_at', 'DESC']],
    }, { page, limit });

    const { count, rows: payments } = await Payment.findAndCountAll(query);

    return res.json({
      payments,
      pagination: buildPaginationResponse(count, page, limit),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch payments.', error: error.message });
  }
};

exports.handleWebhook = async (req, res) => {
  try {
    const { event, data } = req.body;

    if (event === 'payment.success') {
      const payment = await Payment.findOne({ where: { transaction_ref: data.transaction_ref } });
      if (payment) {
        await payment.update({ status: 'completed' });
        await Booking.update({ status: 'paid' }, { where: { id: payment.booking_id } });
      }
    } else if (event === 'payment.failed') {
      const payment = await Payment.findOne({ where: { transaction_ref: data.transaction_ref } });
      if (payment) {
        await payment.update({ status: 'failed' });
      }
    }

    return res.json({ message: 'Webhook processed.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to process webhook.', error: error.message });
  }
};
