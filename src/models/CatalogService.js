const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * The catalogue entry a provider can offer: "Braids", under Beauty & Cosmetics.
 *
 * Distinct from Service, which is one provider's priced, bookable version of a
 * catalogue entry. A provider keeps their price and duration on the Service; this
 * is the shared thing customers browse and search.
 */
const CatalogService = sequelize.define('CatalogService', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  category_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  section: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Optional grouping within a category, e.g. "Hair" under Beauty',
  },
}, {
  tableName: 'catalog_services',
  timestamps: true,
});

module.exports = CatalogService;