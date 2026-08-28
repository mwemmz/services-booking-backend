const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Location = sequelize.define('Location', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  booking_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  provider_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false,
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false,
  },
  accuracy: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'GPS accuracy in meters',
  },
  heading: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: 'Compass heading in degrees',
  },
  speed: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
    comment: 'Speed in m/s',
  },
  is_accurate: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether the fix passed the accuracy threshold',
  },
}, {
  tableName: 'locations',
  timestamps: true,
  indexes: [
    { fields: ['booking_id'] },
    { fields: ['provider_id'] },
    { fields: ['is_accurate'] },
  ],
});

module.exports = Location;
