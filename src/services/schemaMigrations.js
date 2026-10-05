/**
 * Additive schema migrations.
 *
 * `sequelize.sync()` only creates missing tables in production (alter is off),
 * so enum values added to a model are never applied to an existing database.
 * These migrations run once at boot and are idempotent (`ADD VALUE IF NOT EXISTS`).
 *
 * Adding a value to an existing Postgres enum is safe: it does not rewrite rows
 * and cannot be rolled back, but it does not invalidate existing data either.
 */
const sequelize = require('../config/database');

const ENUM_MIGRATIONS = [
  {
    type: 'enum_bookings_status',
    values: ['on-the-way', 'arrived'],
  },
];

const applyEnumMigrations = async () => {
  for (const { type, values } of ENUM_MIGRATIONS) {
    for (const value of values) {
      try {
        await sequelize.query(`ALTER TYPE "${type}" ADD VALUE IF NOT EXISTS '${value}'`);
        console.log(`[migration] enum ${type} now includes '${value}'`);
      } catch (error) {
        // Missing enum type (fresh database that sync() has not created yet) or a
        // locked type: log and continue, sync() will create the type with all values.
        console.warn(`[migration] skipped ${type}.${value}: ${error.message}`);
      }
    }
  }
};

/**
 * Columns added to existing models after the database was first created. New
 * tables need no entry here because sync() creates them; new columns on an
 * existing table do, since production runs with alter disabled.
 */
const COLUMN_MIGRATIONS = [
  { table: 'bookings', column: 'quoted_price', definition: 'DECIMAL(10, 2)' },
  { table: 'categories', column: 'slug', definition: 'VARCHAR(255)' },
  { table: 'categories', column: 'image_url', definition: 'VARCHAR(255)' },
  { table: 'categories', column: 'display_order', definition: 'INTEGER' },
  { table: 'services', column: 'catalog_service_id', definition: 'UUID' },
];

const applyColumnMigrations = async () => {
  for (const { table, column, definition } of COLUMN_MIGRATIONS) {
    try {
      await sequelize.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${definition}`);
      console.log(`[migration] ${table}.${column} ready`);
    } catch (error) {
      console.warn(`[migration] skipped ${table}.${column}: ${error.message}`);
    }
  }
};

/**
 * Categories that predate the slug column still need one, backfilled from the
 * name, and the column is only unique-safe once every row has a value.
 */
const backfillCategorySlugs = async () => {
  try {
    const [rows] = await sequelize.query(
      `SELECT id, name FROM "categories" WHERE slug IS NULL OR slug = ''`,
    );
    if (rows.length === 0) return;

    for (const row of rows) {
      const slug = String(row.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      await sequelize.query(`UPDATE "categories" SET slug = :slug WHERE id = :id`, {
        replacements: { slug: slug || `category-${row.id.slice(0, 8)}`, id: row.id },
      });
    }
    console.log(`[migration] backfilled slugs for ${rows.length} categor(ies)`);
  } catch (error) {
    console.warn(`[migration] category slug backfill skipped: ${error.message}`);
  }
};

const applyCatalogMigrations = async () => {
  await applyColumnMigrations();
  await backfillCategorySlugs();

  try {
    await sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_unique" ON "categories" (slug)`,
    );
  } catch (error) {
    console.warn(`[migration] categories slug index skipped: ${error.message}`);
  }
};

module.exports = { applyEnumMigrations, applyColumnMigrations, applyCatalogMigrations };