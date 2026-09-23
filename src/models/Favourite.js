const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Favourite = sequelize.define('Favourite', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  provider_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
}, {
  tableName: 'favourites',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['user_id', 'provider_id'] },
  ],
});

module.exports = Favourite;