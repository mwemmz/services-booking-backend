const { Op } = require('sequelize');
const { Category, CatalogService, Service, Provider, User, Review, Favourite } = require('../models');

/**
 * The browsable catalogue: categories, the services under them, and how many
 * providers offer each one.
 *
 * These are the endpoints the storefront reads. Everything here is public and
 * cached by the client, so it does no per-user work unless a signed-in customer
 * asks whether they have favourited a provider.
 */

const categoryDto = (category) => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
  description: category.description,
  imageUrl: category.image_url ?? category.imageUrl ?? null,
  icon: category.icon,
  services: (category.catalogServices ?? []).map((service) => ({
    id: service.id,
    name: service.name,
    slug: service.slug,
    description: service.description ?? '',
    section: service.section ?? null,
    providerCount: (service.offerings ?? []).length,
  })),
});

const withCatalogServices = {
  model: CatalogService,
  as: 'catalogServices',
  required: false,
  include: [{ model: Service, as: 'offerings', required: false, where: { is_active: true }, attributes: ['id'] }],
};

/** Categories with their services, in the order the storefront shows them. */
exports.listCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({
      include: [withCatalogServices],
      order: [
        ['display_order', 'ASC'],
        ['name', 'ASC'],
      ],
    });

    return res.json({ categories: categories.map(categoryDto) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch categories.', error: error.message });
  }
};

exports.getCategory = async (req, res) => {
  try {
    const where = req.params.slug.includes('-')
      ? { slug: req.params.slug }
      : { name: req.params.slug };

    const category = await Category.findOne({ where, include: [withCatalogServices] });
    if (!category) {
      return res.status(404).json({ message: 'That category could not be found.' });
    }

    return res.json({ category: categoryDto(category) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch category.', error: error.message });
  }
};

/** Flat list of catalogue services, optionally narrowed to one category. */
exports.listCatalogServices = async (req, res) => {
  try {
    const { category, q } = req.query;
    const where = {};
    if (q) where.name = { [Op.iLike]: `%${q}%` };

    const services = await CatalogService.findAll({
      where,
      include: [
        // An explicit include with required:true is what actually filters by the
        // related category's slug; a bare { category: { slug } } does not.
        ...(category
          ? [{ model: Category, as: 'category', required: true, where: { slug: category } }]
          : [{ model: Category, as: 'category', required: false }]),
        { model: Service, as: 'offerings', required: false, where: { is_active: true }, attributes: ['id'] },
      ],
      order: [['name', 'ASC']],
    });

    return res.json({
      services: services.map((service) => ({
        id: service.id,
        name: service.name,
        slug: service.slug,
        description: service.description ?? '',
        section: service.section ?? null,
        category: service.category?.name ?? null,
        categorySlug: service.category?.slug ?? null,
        providerCount: (service.offerings ?? []).length,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch services.', error: error.message });
  }
};

/**
 * Providers offering a catalogue service, best rated first. Favourites are only
 * resolved when the caller identifies itself, since the public list is shared.
 */
exports.listProvidersForService = async (req, res) => {
  try {
    const { slug } = req.params;
    const catalogService = await CatalogService.findOne({ where: { slug } });
    if (!catalogService) {
      return res.status(404).json({ message: 'That service could not be found.' });
    }

    const providers = await Provider.findAll({
      where: { is_verified: true },
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'profile_image'] },
        {
          model: Service,
          as: 'services',
          required: true,
          where: { catalog_service_id: catalogService.id, is_active: true },
        },
        { model: Review, as: 'reviews', required: false },
      ],
      order: [['rating', 'DESC']],
    });

    const customerId = req.user?.id ?? null;
    let favourites = new Set();
    if (customerId) {
      const rows = await Favourite.findAll({ where: { user_id: customerId } });
      favourites = new Set(rows.map((row) => row.provider_id));
    }

    return res.json({
      service: { id: catalogService.id, name: catalogService.name, slug: catalogService.slug, description: catalogService.description ?? '' },
      providers: providers.map((provider) => ({
        id: provider.id,
        business_name: provider.business_name,
        bio: provider.description ?? '',
        category: provider.category,
        rating: provider.rating,
        total_reviews: provider.total_reviews,
        is_verified: provider.is_verified,
        image: provider.user?.profile_image ?? null,
        is_favourite: favourites.has(provider.id),
        services: provider.services.map((service) => ({
          id: service.id,
          name: service.name,
          price: service.price,
          duration: service.duration,
        })),
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch providers.', error: error.message });
  }
};