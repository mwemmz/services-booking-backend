const { Address } = require('../models');

const shapeAddress = (address) => ({
  id: address.id,
  label: address.label,
  address_line: address.address_line,
  city: address.city,
  latitude: address.latitude === null ? null : Number(address.latitude),
  longitude: address.longitude === null ? null : Number(address.longitude),
  instructions: address.instructions,
  is_default: address.is_default,
  created_at: address.createdAt,
});

/**
 * Clearing the default flag everywhere first keeps exactly one default per user,
 * which is what the booking form expects when it pre-fills a location.
 */
const clearOtherDefaults = async (userId, keepAddressId = null) => {
  await Address.update(
    { is_default: false },
    { where: { user_id: userId, ...(keepAddressId ? { id: { [require('sequelize').Op.ne]: keepAddressId } } : {}) } },
  );
};

exports.listAddresses = async (req, res) => {
  try {
    const addresses = await Address.findAll({
      where: { user_id: req.user.id },
      order: [['is_default', 'DESC'], ['createdAt', 'DESC']],
    });

    return res.json({ addresses: addresses.map(shapeAddress) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to list addresses.', error: error.message });
  }
};

exports.createAddress = async (req, res) => {
  try {
    const count = await Address.count({ where: { user_id: req.user.id } });
    const isDefault = req.body.is_default !== undefined && req.body.is_default !== null
      ? Boolean(req.body.is_default)
      : count === 0;

    const address = await Address.create({
      user_id: req.user.id,
      label: req.body.label || 'Home',
      address_line: req.body.address_line,
      city: req.body.city ?? null,
      latitude: req.body.latitude ?? null,
      longitude: req.body.longitude ?? null,
      instructions: req.body.instructions ?? null,
      is_default: isDefault,
    });

    if (isDefault) {
      await clearOtherDefaults(req.user.id, address.id);
    }

    return res.status(201).json({ message: 'Address saved.', address: shapeAddress(address) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to save address.', error: error.message });
  }
};

exports.getAddress = async (req, res) => {
  try {
    const address = await Address.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!address) {
      return res.status(404).json({ message: 'Address not found.' });
    }

    return res.json({ address: shapeAddress(address) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch address.', error: error.message });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const address = await Address.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!address) {
      return res.status(404).json({ message: 'Address not found.' });
    }

    const fields = ['label', 'address_line', 'city', 'latitude', 'longitude', 'instructions'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        address[field] = req.body[field];
      }
    });

    if (req.body.is_default !== undefined) {
      address.is_default = Boolean(req.body.is_default);
    }

    await address.save();

    if (address.is_default) {
      await clearOtherDefaults(req.user.id, address.id);
    }

    return res.json({ message: 'Address updated.', address: shapeAddress(address) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update address.', error: error.message });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const address = await Address.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!address) {
      return res.status(404).json({ message: 'Address not found.' });
    }

    const wasDefault = address.is_default;
    await address.destroy();

    // Keep one default available so the booking form always has a starting point.
    if (wasDefault) {
      const replacement = await Address.findOne({
        where: { user_id: req.user.id },
        order: [['createdAt', 'DESC']],
      });
      if (replacement) {
        await replacement.update({ is_default: true });
      }
    }

    return res.json({ message: 'Address removed.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to remove address.', error: error.message });
  }
};