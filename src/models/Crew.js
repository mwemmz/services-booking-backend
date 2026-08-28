const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Crew = sequelize.define('Crew', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  leader_id: { type: DataTypes.UUID, allowNull: false }, // Provider ID
  name: { type: DataTypes.STRING, allowNull: false },
  rating: { type: DataTypes.DECIMAL(3, 2), defaultValue: 0 },
}, { tableName: 'crews', timestamps: true });

module.exports = Crew;
