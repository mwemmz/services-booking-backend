/**
 * Seeds the browsable catalogue: categories and the services under them.
 *
 * Safe to run repeatedly. Categories and catalogue services are matched on slug,
 * so re-running updates descriptions and ordering without duplicating rows.
 * Provider offerings are not touched: those are real provider records.
 */
const { Category, CatalogService } = require('../src/models');

const CATALOG = [
  {
    name: 'Beauty & Cosmetics',
    slug: 'beauty-cosmetics',
    icon: 'sparkles',
    imageUrl: '/images/beauty.jpg',
    description: 'Barbershop and salon services, kept as separate lists.',
    services: [
      { name: 'Haircut', slug: 'haircut', section: 'barbershop' },
      { name: 'Fade', slug: 'fade', section: 'barbershop' },
      { name: 'Shave', slug: 'shave', section: 'barbershop' },
      { name: 'Beard trimming', slug: 'beard-trimming', section: 'barbershop' },
      { name: 'Braiding', slug: 'braiding', section: 'salon' },
      { name: 'Braids', slug: 'braids', section: 'both' },
      { name: 'Cornrows', slug: 'cornrows', section: 'both' },
      { name: 'Hair extensions', slug: 'hair-extensions', section: 'salon' },
      { name: 'Nails', slug: 'nails', section: 'salon' },
      { name: 'Manicure', slug: 'manicure', section: 'salon' },
      { name: 'Pedicure', slug: 'pedicure', section: 'salon' },
      { name: 'Makeup', slug: 'makeup', section: 'salon' },
      { name: 'Hair treatment', slug: 'hair-treatment', section: 'salon' },
      { name: 'Hair styling', slug: 'hair-styling', section: 'salon' },
      { name: 'Hair dye', slug: 'hair-dye', section: 'both' },
    ],
  },
  {
    name: 'Handy Craft / Repair',
    slug: 'repairs',
    icon: 'wrench',
    imageUrl: '/images/repairs.jpg',
    description: 'Phone, computer, appliance, electrical, and plumbing repairs.',
    services: [
      { name: 'Phone repair', slug: 'phone-repair' },
      { name: 'Laptop repair', slug: 'laptop-repair' },
      { name: 'Computer repair', slug: 'computer-repair' },
      { name: 'Fridge repair', slug: 'fridge-repair' },
      { name: 'Air-conditioner repair', slug: 'air-conditioner-repair' },
      { name: 'Electrical repair', slug: 'electrical-repair' },
      { name: 'Appliance repair', slug: 'appliance-repair' },
      { name: 'Plumbing repair', slug: 'plumbing-repair' },
      { name: 'General maintenance', slug: 'general-maintenance' },
    ],
  },
  {
    name: 'Cleaning Services',
    slug: 'cleaning',
    icon: 'spray',
    imageUrl: '/images/cleaning.jpg',
    description: 'Home, office, garden, laundry, and move-in cleaning.',
    services: [
      { name: 'Home cleaning', slug: 'home-cleaning' },
      { name: 'Office cleaning', slug: 'office-cleaning' },
      { name: 'Deep cleaning', slug: 'deep-cleaning' },
      { name: 'Garden care', slug: 'garden-care' },
      { name: 'Gardening', slug: 'gardening' },
      { name: 'Landscaping', slug: 'landscaping' },
      { name: 'Fumigation', slug: 'fumigation' },
      { name: 'Laundry', slug: 'laundry' },
      { name: 'Move-in cleaning', slug: 'move-in-cleaning' },
      { name: 'Move-out cleaning', slug: 'move-out-cleaning' },
    ],
  },
];

const seedCatalog = async () => {
  let created = 0;
  let updated = 0;

  for (const [index, entry] of CATALOG.entries()) {
    const [category, wasCreated] = await Category.findOrCreate({
      where: { slug: entry.slug },
      defaults: {
        name: entry.name,
        slug: entry.slug,
        icon: entry.icon,
        image_url: entry.imageUrl ?? null,
        description: entry.description,
        display_order: index,
      },
    });

    if (wasCreated) {
      created += 1;
    } else {
      await category.update({
        name: entry.name,
        icon: entry.icon,
        image_url: entry.imageUrl ?? null,
        description: entry.description,
        display_order: index,
      });
      updated += 1;
    }

    for (const service of entry.services) {
      const [row, serviceCreated] = await CatalogService.findOrCreate({
        where: { slug: service.slug },
        defaults: {
          category_id: category.id,
          name: service.name,
          slug: service.slug,
          section: service.section ?? null,
        },
      });
      if (serviceCreated) created += 1;
      else await row.update({ category_id: category.id, section: service.section ?? null });
    }
  }

  console.log(`[seed] catalogue ready (${created} created, ${updated} categories updated)`);
};

module.exports = { seedCatalog, CATALOG };

if (require.main === module) {
  seedCatalog()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[seed] catalogue seed failed:', error.message);
      process.exit(1);
    });
}