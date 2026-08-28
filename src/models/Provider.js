const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Provider = sequelize.define('Provider', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
  },
  business_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  is_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_online: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  rating: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0,
  },
  total_reviews: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  location_lat: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
  },
  location_lng: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
  },
  location_accuracy: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'GPS accuracy in meters of the last fix',
  },
  last_location_update: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  service_radius: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
  },
  verification_documents: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  working_hours: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
}, {
  tableName: 'providers',
  timestamps: true,
});

module.exports = Provider;
