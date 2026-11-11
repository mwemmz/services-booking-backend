const { Provider, SubscriptionPayment } = require('../models');
const { audit } = require('../services/auditService');
const { createNotification } = require('../services/notificationService');

const FEE = Number(process.env.SUBSCRIPTION_FEE || 50);
const PERIOD_DAYS = 30;
const METHODS = ['MTN Mobile Money', 'Airtel Money', 'Zamtel Kwacha', 'Card'];

const statusOf = (payments) => {
  const latest = payments.reduce((best, p) => (!best || new Date(p.period_end) > new Date(best.period_end) ? p : best), null);
  const paidUntil = latest ? latest.period_end : null;
  return { active: !!paidUntil && new Date(paidUntil) > new Date(), paid_until: paidUntil };
};

/** Where this provider stands with the platform fee. */
exports.getMySubscription = async (req, res) => {
  try {
    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider) return res.status(404).json({ message: 'Provider profile not found.' });
    const payments = await SubscriptionPayment.findAll({ where: { provider_id: provider.id }, order: [['createdAt', 'DESC']], limit: 12 });
    return res.json({ fee: FEE, period_days: PERIOD_DAYS, methods: METHODS, ...statusOf(payments), payments });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load subscription.', error: error.message });
  }
};

/**
 * Pay the platform fee. The mobile-money step is simulated for the demo: the
 * payment is recorded as paid and extends the listing by 30 days from the later
 * of now and the current paid-until date, so paying early never loses time.
 */
exports.paySubscription = async (req, res) => {
  try {
    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider) return res.status(404).json({ message: 'Provider profile not found.' });
    const method = METHODS.includes(req.body && req.body.method) ? req.body.method : METHODS[0];
    const existing = await SubscriptionPayment.findAll({ where: { provider_id: provider.id } });
    const { paid_until: paidUntil } = statusOf(existing);
    const start = paidUntil && new Date(paidUntil) > new Date() ? new Date(paidUntil) : new Date();
    const end = new Date(start.getTime() + PERIOD_DAYS * 24 * 60 * 60 * 1000);
    const payment = await SubscriptionPayment.create({
      provider_id: provider.id,
      amount: FEE,
      method,
      reference: `ZS-${Date.now().toString(36).toUpperCase()}`,
      status: 'paid',
      period_start: start,
      period_end: end,
    });
    await audit(req, 'SUBSCRIPTION_PAID', { targetType: 'provider', targetId: provider.id, detail: `K${FEE} via ${method}` });
    await createNotification(req.user.id, 'system', 'Payment received', `Thank you. Your listing is active until ${end.toDateString()}.`, null).catch(() => {});
    return res.status(201).json({ message: 'Payment received.', payment, active: true, paid_until: end });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to record payment.', error: error.message });
  }
};

exports.FEE = FEE;
exports.statusOf = statusOf;
