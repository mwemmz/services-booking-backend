const { Certification, Provider, User } = require('../models');
const { audit } = require('../services/auditService');
const { createNotification } = require('../services/notificationService');

/** A provider adds a trade certificate. Only the listed fields are accepted, so a provider cannot mark their own certificate verified. */
exports.createCertification = async (req, res) => {
  try {
    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider) return res.status(404).json({ message: 'Provider not found' });

    const { name, issuing_body, expiry_date, document_url } = req.body;
    const cert = await Certification.create({
      name, issuing_body, expiry_date: expiry_date || null, document_url: document_url || null,
      provider_id: provider.id, status: 'pending', is_verified: false,
    });
    if (!provider.is_verified) {
      await provider.update({ verification_status: 'pending', verification_note: null, verification_submitted_at: new Date() });
    }
    await audit(req, 'CERTIFICATE_SUBMITTED', { targetType: 'certification', targetId: cert.id, detail: name });
    return res.status(201).json(cert);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getMyCertifications = async (req, res) => {
  try {
    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider) return res.status(404).json({ message: 'Provider not found' });
    const certs = await Certification.findAll({ where: { provider_id: provider.id }, order: [['createdAt', 'DESC']] });
    return res.json(certs);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getProviderCertifications = async (req, res) => {
  try {
    const certs = await Certification.findAll({ where: { provider_id: req.params.providerId } });
    return res.json(certs);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/** Admin validates a trade certificate. A validated certificate gives the provider the verified status. */
exports.verifyCertification = async (req, res) => {
  try {
    const cert = await Certification.findByPk(req.params.id);
    if (!cert) return res.status(404).json({ message: 'Certification not found' });
    if (cert.expiry_date && new Date(cert.expiry_date) < new Date()) {
      return res.status(400).json({ message: 'This certificate has expired, so it cannot be validated.' });
    }
    await cert.update({ status: 'verified', is_verified: true, review_note: null });
    const provider = await Provider.findByPk(cert.provider_id, { include: [{ model: User, as: 'user' }] });
    if (provider) {
      await provider.update({ is_verified: true, verification_status: 'verified', verification_note: null });
      await audit(req, 'CERTIFICATE_VALIDATED', { targetType: 'certification', targetId: cert.id, detail: `${cert.name} for ${provider.business_name}` });
      await createNotification(provider.user_id, 'verification', 'You are verified', `An admin validated your ${cert.name} certificate. Customers now see your verified badge.`);
    }
    return res.json({ message: 'Certification verified', cert, provider });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.rejectCertification = async (req, res) => {
  try {
    const reason = String((req.body && req.body.reason) || '').trim();
    if (reason.length < 5) return res.status(400).json({ message: 'Give a short reason so the provider can fix it.' });
    const cert = await Certification.findByPk(req.params.id);
    if (!cert) return res.status(404).json({ message: 'Certification not found' });
    await cert.update({ status: 'rejected', is_verified: false, review_note: reason.slice(0, 300) });
    const provider = await Provider.findByPk(cert.provider_id);
    if (provider && !provider.is_verified) {
      await provider.update({ verification_status: 'rejected', verification_note: reason.slice(0, 300) });
    }
    if (provider) {
      await audit(req, 'CERTIFICATE_REJECTED', { targetType: 'certification', targetId: cert.id, detail: `${cert.name}: ${reason}` });
      await createNotification(provider.user_id, 'verification', 'Certificate needs attention', reason.slice(0, 200));
    }
    return res.json({ message: 'Certification rejected', cert });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteCertification = async (req, res) => {
  try {
    const cert = await Certification.findByPk(req.params.id);
    if (!cert) return res.status(404).json({ message: 'Certification not found' });
    if (req.user.role !== 'admin') {
      const provider = await Provider.findOne({ where: { user_id: req.user.id } });
      if (!provider || provider.id !== cert.provider_id) return res.status(403).json({ message: 'You can only delete your own certificates.' });
    }
    await cert.destroy();
    return res.json({ message: 'Certification deleted' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
