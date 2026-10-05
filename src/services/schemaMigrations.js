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
    values: ['on_the_way', 'arrived'],
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

module.exports = { applyEnumMigrations };