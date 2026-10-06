const { Op } = require('sequelize');
const { Service, Provider, CatalogService, Category } = require('../models');
const { paginate, buildPaginationResponse } = require('../utils/pagination');

exports.createService = async (req, res) => {
  try {
    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider) {
      return res.status(403).json({ message: 'You must be a registered provider.' });
    }

    const service = await Service.create({
      provider_id: provider.id,
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      duration: req.body.duration,
      category: req.body.category,
      image: req.body.image,
      // Optional: ties this priced offering to a seeded catalogue entry.
      catalog_service_id: req.body.catalog_service_id ?? null,
    });

    return res.status(201).json({ message: 'Service created.', service });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create service.', error: error.message });
  }
};

exports.getAllServices = async (req, res) => {
  try {
    const { category, min_price, max_price, search, page = 1, limit = 20 } = req.query;

    const where = { is_active: true };

    if (category) where.category = category;
    if (min_price || max_price) {
      where.price = {};
      if (min_price) where.price[Op.gte] = parseFloat(min_price);
      if (max_price) where.price[Op.lte] = parseFloat(max_price);
    }
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const query = paginate({
      where,
      include: [{ model: Provider, as: 'provider', include: [{ model: require('../models').User, as: 'user' }] }],
      order: [['createdAt', 'DESC']],
    }, { page, limit });

    const { count, rows: services } = await Service.findAndCountAll(query);

    return res.json({
      services,
      pagination: buildPaginationResponse(count, page, limit),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch services.', error: error.message });
  }
};

exports.getServiceById = async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id, {
      include: [{ model: Provider, as: 'provider', include: [{ model: require('../models').User, as: 'user' }] }],
    });

    if (!service) {
      return res.status(404).json({ message: 'Service not found.' });
    }

    return res.json({ service });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch service.', error: error.message });
  }
};

exports.updateService = async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found.' });
    }

    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider || service.provider_id !== provider.id) {
      return res.status(403).json({ message: 'Not authorized to update this service.' });
    }

    const allowedFields = ['name', 'description', 'price', 'duration', 'category', 'image', 'catalog_service_id'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Attaching a catalogue entry is what puts this service in the storefront's
    // category pages, so the reference has to point at a real entry.
    if (updates.catalog_service_id) {
      const catalogService = await CatalogService.findByPk(updates.catalog_service_id, {
        include: [{ model: Category, as: 'category' }],
      });
      if (!catalogService) {
        return res.status(400).json({ message: 'That catalogue service does not exist.' });
      }
      updates.category = catalogService.category.name;
    }

    await service.update(updates);

    return res.json({
      message: 'Service updated.',
      service: await Service.findByPk(service.id, { include: [{ model: CatalogService, as: 'catalogService' }] }),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update service.', error: error.message });
  }
};

exports.deleteService = async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found.' });
    }

    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider || service.provider_id !== provider.id) {
      return res.status(403).json({ message: 'Not authorized to delete this service.' });
    }

    await service.update({ is_active: false });

    return res.json({ message: 'Service deactivated.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete service.', error: error.message });
  }
};

exports.getProviderServices = async (req, res) => {
  try {
    // The public route is keyed by provider id; the authenticated route falls back to
// the caller's own provider. Comparing a provider id against user_id never matches.
const where = req.params.providerId ? { id: req.params.providerId } : { user_id: req.user.id };
    const provider = await Provider.findOne({ where });
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found.' });
    }

    const services = await Service.findAll({
      where: { provider_id: provider.id, is_active: true },
    });

    return res.json({ services });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch services.', error: error.message });
  }
};
