const { PaymentMethod } = require('../models');

const NETWORKS = ['Airtel Money', 'MoMo', 'Visa'];

const shape = (row) => ({ id: row.id, provider: row.network, phone: row.detail, label: `${row.network} ${row.detail}` });

exports.listPaymentMethods = async (req, res) => {
  try {
    const rows = await PaymentMethod.findAll({ where: { user_id: req.user.id }, order: [['createdAt', 'DESC']] });
    return res.json({ methods: rows.map(shape) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load payment methods.', error: error.message });
  }
};

exports.createPaymentMethod = async (req, res) => {
  try {
    const { network, detail } = req.body || {};
    if (!NETWORKS.includes(network)) return res.status(400).json({ message: 'Choose Airtel Money, MoMo or Visa.' });
    const text = String(detail || '').replace(/\D/g, '');
    if (network === 'Visa' ? text.length !== 4 : text.length < 9) {
      return res.status(400).json({ message: network === 'Visa' ? 'Enter the last 4 digits.' : 'Enter a valid phone number.' });
    }
    const [row] = await PaymentMethod.findOrCreate({
      where: { user_id: req.user.id, network, detail: text },
      defaults: { user_id: req.user.id, network, detail: text },
    });
    return res.status(201).json({ method: shape(row) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to save payment method.', error: error.message });
  }
};

exports.deletePaymentMethod = async (req, res) => {
  try {
    await PaymentMethod.destroy({ where: { id: req.params.id, user_id: req.user.id } });
    return res.json({ message: 'Removed.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to remove payment method.', error: error.message });
  }
};
