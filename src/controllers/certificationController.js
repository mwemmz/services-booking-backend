const { Certification, Provider } = require('../models');

exports.createCertification = async (req, res) => {
  try {
    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider) return res.status(404).json({ message: 'Provider not found' });

    const cert = await Certification.create({ ...req.body, provider_id: provider.id });
    return res.status(201).json(cert);
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

exports.verifyCertification = async (req, res) => {
  try {
    const cert = await Certification.findByPk(req.params.id);
    if (!cert) return res.status(404).json({ message: 'Certification not found' });

    await cert.update({ is_verified: true });
    return res.json({ message: 'Certification verified', cert });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteCertification = async (req, res) => {
  try {
    await Certification.destroy({ where: { id: req.params.id } });
    return res.json({ message: 'Certification deleted' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
