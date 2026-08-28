const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Dispute = sequelize.define('Dispute', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  booking_id: { type: DataTypes.UUID, allowNull: false },
  reporter_id: { type: DataTypes.UUID, allowNull: false }, // User ID
  provider_id: { type: DataTypes.UUID, allowNull: false },
  reason: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.ENUM('open', 'resolved', 'closed'), defaultValue: 'open' },
}, { tableName: 'disputes', timestamps: true });

module.exports = Dispute;
