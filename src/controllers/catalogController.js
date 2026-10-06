const { Op } = require('sequelize');
const {
  Category,
  CatalogService,
  Service,
  Provider,
  User,
  Favourite,
  ProviderAvailability,
  PortfolioItem,
  Review,
} = require('../models');
const { haversineDistance } = require('../utils/distance');

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
// ---------------------------------------------------------------------------
// Storefront providers
//
// The browse screens want cards, not database rows, and they want one round
// trip rather than a provider list plus a detail call plus a favourites call.
// These two endpoints do that shaping here, so the storefront and any future
// client read the same view model.
// ---------------------------------------------------------------------------

const SERVICE_INCLUDE = {
  model: Service,
  as: 'services',
  required: false,
  where: { is_active: true },
  include: [
    {
      model: CatalogService,
      as: 'catalogService',
      required: false,
      include: [{ model: Category, as: 'category', required: false }],
    },
  ],
  order: [['price', 'ASC']],
};

const toServiceView = (service) => ({
  providerServiceId: service.id,
  id: service.catalog_service_id ?? service.id,
  catalogServiceId: service.catalog_service_id,
  name: service.catalogService?.name ?? service.name,
  slug: service.catalogService?.slug ?? null,
  description: service.description ?? '',
  durationMinutes: service.duration,
category: service.catalogService?.category?.name ?? service.category,
  categorySlug: service.catalogService?.category?.slug ?? null,
  price: Number(service.price),
  image: service.image ?? null,
});

const toProviderCard = (provider, { coords, favourites } = {}) => {
  const services = (provider.services ?? []).map(toServiceView);
  const latitude = provider.location_lat == null ? null : Number(provider.location_lat);
  const longitude = provider.location_lng == null ? null : Number(provider.location_lng);

  const distanceKm =
    coords?.lat != null && coords?.lng != null && latitude != null && longitude != null
      ? Math.round(haversineDistance(coords.lat, coords.lng, latitude, longitude) * 10) / 10
      : null;

  const personName = provider.user?.name ?? '';

  return {
    id: provider.id,
    name: provider.business_name || personName,
    personName,
    avatarUrl: provider.user?.profile_image ?? null,
    verified: Boolean(provider.is_verified),
    verificationStatus: provider.is_verified ? 'VERIFIED' : 'PENDING',
    rating: Number(provider.rating ?? 0),
    reviewCount: provider.total_reviews ?? 0,
    bio: provider.description ?? '',
    serviceArea: provider.service_area ?? null,
    baseAddress: provider.address ?? null,
    latitude,
    longitude,
    isOnline: Boolean(provider.is_online),
    distanceKm,
    minPrice: services.length ? Math.min(...services.map((service) => Number(service.price))) : null,
    services,
    favorite: favourites ? favourites.has(provider.id) : false,
  };
};

const toProviderDetail = (provider, options = {}) => ({
  ...toProviderCard(provider, options),
  availability: (provider.availability ?? []).map((window) => ({
    dayOfWeek: window.day_of_week,
    startTime: window.start_time,
    endTime: window.end_time,
    isActive: window.is_active,
  })),
  portfolio: (provider.portfolio ?? []).map((item) => ({
    id: item.id,
    imageUrl: item.image_url,
    caption: item.caption,
  })),
  reviews: (provider.reviews ?? []).map((review) => ({
    id: review.id,
    rating: review.rating,
    reason: null,
    comment: review.comment,
    authorName: review.customer?.name ?? 'A customer',
    authorAvatar: review.customer?.profile_image ?? null,
    createdAt: review.createdAt,
  })),
});

/** Favourite provider ids for the signed-in customer, so cards can show a filled heart. */
const favouritesFor = async (userId) => {
  if (!userId) return new Set();
  const rows = await Favourite.findAll({ where: { user_id: userId }, attributes: ['provider_id'] });
  return new Set(rows.map((row) => row.provider_id));
};

const parseCoords = (query) => {
  const lat = query.lat === undefined ? undefined : Number(query.lat);
  const lng = query.lng === undefined ? undefined : Number(query.lng);
  const coords = {};
  if (Number.isFinite(lat)) coords.lat = lat;
  if (Number.isFinite(lng)) coords.lng = lng;
  return Object.keys(coords).length === 2 ? coords : undefined;
};

exports.listStorefrontProviders = async (req, res) => {
  try {
    const { category, service, q } = req.query;
    const where = { is_verified: true };

    const providers = await Provider.findAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'profile_image'] },
        {
          ...SERVICE_INCLUDE,
          ...(service
            ? { required: true, where: { is_active: true, catalogService: { slug: service } } }
            : {}),
          ...(category && !service
            ? {
                required: true,
                where: { is_active: true, catalogService: { category: { slug: category } } },
              }
            : {}),
        },
      ],
      order: [['rating', 'DESC']],
    });

    const favourites = await favouritesFor(req.user?.id ?? null);
    const coords = parseCoords(req.query);
    let cards = providers.map((provider) => toProviderCard(provider, { coords, favourites }));

    if (q) {
      const needle = String(q).toLowerCase();
      cards = cards.filter(
        (card) =>
          card.name.toLowerCase().includes(needle) ||
          card.personName.toLowerCase().includes(needle) ||
          card.bio.toLowerCase().includes(needle) ||
          card.services.some(
            (entry) => entry.name.toLowerCase().includes(needle) || entry.category.toLowerCase().includes(needle),
          ),
      );
    }

    return res.json({ providers: cards });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch providers.', error: error.message });
  }
};

exports.getStorefrontProvider = async (req, res) => {
  try {
    const provider = await Provider.findOne({
      where: {
        [Op.or]: [{ id: req.params.id }, { user_id: req.params.id }],
      },
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'profile_image'] },
        SERVICE_INCLUDE,
        { model: ProviderAvailability, as: 'availability', required: false },
        { model: PortfolioItem, as: 'portfolio', required: false },
        {
          model: Review,
          as: 'reviews',
          required: false,
          include: [{ model: User, as: 'customer', attributes: ['name', 'profile_image'] }],
          separate: true,
          order: [['createdAt', 'DESC']],
          limit: 20,
        },
      ],
    });

    if (!provider) {
      return res.status(404).json({ message: 'That provider could not be found.' });
    }

    const favourites = await favouritesFor(req.user?.id ?? null);
    const coords = parseCoords(req.query);

    return res.json({ provider: toProviderDetail(provider, { coords, favourites }) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch provider.', error: error.message });
  }
};
