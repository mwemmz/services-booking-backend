const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Service = sequelize.define('Service', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  provider_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Duration in minutes',
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  catalog_service_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'The catalogue entry this provider is offering, when they picked one',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  image: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'services',
  timestamps: true,
});

module.exports = Service;
