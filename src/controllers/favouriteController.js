const { Favourite, Provider, User, Service } = require('../models');
const { Op } = require('sequelize');

const PUBLIC_USER_ATTRS = ['id', 'name', 'email', 'phone', 'profile_image'];

/** Resolve a provider by either its profile id or the owning user id. */
const resolveProvider = async (providerId) => Provider.findOne({
  where: { [Op.or]: [{ id: providerId }, { user_id: providerId }] },
});

/** Shape a favourite for the API, exposing the provider *user* id for the mobile app. */
const shapeFavourite = (favourite) => ({
  id: favourite.id,
  provider_id: favourite.provider_id,
  provider_user_id: favourite.provider?.user_id ?? null,
  created_at: favourite.createdAt,
  provider: favourite.provider || null,
});

exports.listFavourites = async (req, res) => {
  try {
    const favourites = await Favourite.findAll({
      where: { user_id: req.user.id },
      include: [
        {
          model: Provider,
          as: 'provider',
          include: [
            { model: User, as: 'user', attributes: PUBLIC_USER_ATTRS },
            { model: Service, as: 'services', where: { is_active: true }, required: false },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json({ favourites: favourites.map(shapeFavourite) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to list favourites.', error: error.message });
  }
};

exports.checkFavourite = async (req, res) => {
  try {
    const provider = await resolveProvider(req.params.providerId);
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found.' });
    }

    const favourite = await Favourite.findOne({
      where: { user_id: req.user.id, provider_id: provider.id },
    });

    return res.json({ is_favourite: Boolean(favourite), provider_user_id: provider.user_id });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to check favourite.', error: error.message });
  }
};

exports.addFavourite = async (req, res) => {
  try {
    const provider = await resolveProvider(req.body.provider_id || req.params.providerId);
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found.' });
    }

    const [favourite] = await Favourite.findOrCreate({
      where: { user_id: req.user.id, provider_id: provider.id },
      defaults: { user_id: req.user.id, provider_id: provider.id },
    });

    return res.status(201).json({ message: 'Provider saved.', is_favourite: true, favourite: shapeFavourite(favourite) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to save provider.', error: error.message });
  }
};

exports.removeFavourite = async (req, res) => {
  try {
    const provider = await resolveProvider(req.params.providerId);
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found.' });
    }

    await Favourite.destroy({ where: { user_id: req.user.id, provider_id: provider.id } });

    return res.json({ message: 'Provider removed from saved.', is_favourite: false });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to remove favourite.', error: error.message });
  }
};