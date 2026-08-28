const { saveBase64File } = require('../services/uploadService');
const { Provider, Service, User } = require('../models');

/**
 * Upload an image as base64. Body: { data: "data:image/png;base64,...", type: "provider|service|user" }
 * Returns the server path to store on the related record.
 */
exports.uploadImage = async (req, res) => {
  try {
    const { data, type = 'user' } = req.body;
    if (!data) {
      return res.status(400).json({ message: 'data (base64) is required.' });
    }

    const filePath = saveBase64File(data);
    return res.json({ message: 'Upload successful.', url: filePath });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Upload failed.' });
  }
};

/**
 * Upload + attach to the authenticated provider's profile.
 */
exports.uploadProviderImage = async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ message: 'data (base64) is required.' });
    }

    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider) {
      return res.status(404).json({ message: 'Provider profile not found.' });
    }

    const filePath = saveBase64File(data);
    // Providers don't have a dedicated image column; update user profile_image instead.
    await User.update({ profile_image: filePath }, { where: { id: req.user.id } });

    return res.json({ message: 'Provider image uploaded.', url: filePath });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Upload failed.' });
  }
};

/**
 * Upload + attach to a service owned by the authenticated provider.
 * Body: { data, service_id }
 */
exports.uploadServiceImage = async (req, res) => {
  try {
    const { data, service_id } = req.body;
    if (!data || !service_id) {
      return res.status(400).json({ message: 'data and service_id are required.' });
    }

    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    const service = await Service.findOne({ where: { id: service_id } });
    if (!provider || !service || service.provider_id !== provider.id) {
      return res.status(403).json({ message: 'You do not own this service.' });
    }

    const filePath = saveBase64File(data);
    await service.update({ image: filePath });

    return res.json({ message: 'Service image uploaded.', url: filePath });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Upload failed.' });
  }
};
