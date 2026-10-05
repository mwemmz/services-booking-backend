const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * A provider's recurring working hours. Bookings can only be placed inside these
 * windows, and the slots a customer sees are generated from them.
 *
 * One row per weekday per provider: a provider works a single window per day, so
 * (provider_id, day_of_week) is unique.
 */
const ProviderAvailability = sequelize.define('ProviderAvailability', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  provider_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  day_of_week: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '0 = Sunday through 6 = Saturday',
  },
  start_time: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '24h HH:MM',
  },
  end_time: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '24h HH:MM',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'provider_availability',
  timestamps: true,
  indexes: [{ unique: true, fields: ['provider_id', 'day_of_week'] }],
});

module.exports = ProviderAvailability;