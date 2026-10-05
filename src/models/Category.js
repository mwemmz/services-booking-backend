const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'URL and lookup key, e.g. beauty-cosmetics',
  },
  image_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  display_order: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Lower sorts first on the customer home page',
  },
  icon: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'categories',
  timestamps: true,
});

module.exports = Category;
