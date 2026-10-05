const { Op } = require('sequelize');
const { PortfolioItem, Provider } = require('../models');

const shapeItem = (item) => ({
  id: item.id,
  provider_id: item.provider_id,
  image_url: item.image_url,
  caption: item.caption,
  sort_order: item.sort_order,
  created_at: item.createdAt,
});

/** Resolve the signed-in provider's own profile record. */
const ownProvider = (req) => Provider.findOne({ where: { user_id: req.user.id } });

exports.listProviderPortfolio = async (req, res) => {
  try {
    const provider = await Provider.findOne({
      where: { [Op.or]: [{ id: req.params.providerId }, { user_id: req.params.providerId }] },
    });
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found.' });
    }

    const items = await PortfolioItem.findAll({
      where: { provider_id: provider.id },
      order: [['sort_order', 'ASC'], ['createdAt', 'DESC']],
    });

    return res.json({ provider_id: provider.id, provider_user_id: provider.user_id, items: items.map(shapeItem) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load portfolio.', error: error.message });
  }
};

exports.listMyPortfolio = async (req, res) => {
  try {
    const provider = await ownProvider(req);
    if (!provider) {
      return res.status(404).json({ message: 'Provider profile not found.' });
    }

    const items = await PortfolioItem.findAll({
      where: { provider_id: provider.id },
      order: [['sort_order', 'ASC'], ['createdAt', 'DESC']],
    });

    return res.json({ provider_id: provider.id, items: items.map(shapeItem) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load portfolio.', error: error.message });
  }
};

exports.createPortfolioItem = async (req, res) => {
  try {
    const provider = await ownProvider(req);
    if (!provider) {
      return res.status(404).json({ message: 'Provider profile not found.' });
    }

    const count = await PortfolioItem.count({ where: { provider_id: provider.id } });

    const item = await PortfolioItem.create({
      provider_id: provider.id,
      image_url: req.body.image_url,
      caption: req.body.caption ?? null,
      sort_order: req.body.sort_order ?? count,
    });

    return res.status(201).json({ message: 'Portfolio item added.', item: shapeItem(item) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to add portfolio item.', error: error.message });
  }
};

exports.updatePortfolioItem = async (req, res) => {
  try {
    const provider = await ownProvider(req);
    if (!provider) {
      return res.status(404).json({ message: 'Provider profile not found.' });
    }

    const item = await PortfolioItem.findOne({
      where: { id: req.params.id, provider_id: provider.id },
    });
    if (!item) {
      return res.status(404).json({ message: 'Portfolio item not found.' });
    }

    ['image_url', 'caption', 'sort_order'].forEach((field) => {
      if (req.body[field] !== undefined) {
        item[field] = req.body[field];
      }
    });

    await item.save();

    return res.json({ message: 'Portfolio item updated.', item: shapeItem(item) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update portfolio item.', error: error.message });
  }
};

exports.deletePortfolioItem = async (req, res) => {
  try {
    const item = await PortfolioItem.findOne({ where: { id: req.params.id } });
    if (!item) {
      return res.status(404).json({ message: 'Portfolio item not found.' });
    }

    const provider = await ownProvider(req);
    const isOwner = provider && provider.id === item.provider_id;
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You can only remove your own portfolio items.' });
    }

    await item.destroy();

    return res.json({ message: 'Portfolio item removed.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to remove portfolio item.', error: error.message });
  }
};