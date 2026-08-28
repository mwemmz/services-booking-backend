const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Dispute = sequelize.define('Dispute', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  booking_id: { type: DataTypes.UUID, allowNull: false },
  reporter_id: { type: DataTypes.UUID, allowNull: false }, // User ID
  provider_id: { type: DataTypes.UUID, allowNull: false },
  type: { type: DataTypes.ENUM('dispute', 'safety'), defaultValue: 'dispute' },
  reason: { type: DataTypes.TEXT, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.ENUM('open', 'resolved', 'closed'), defaultValue: 'open' },
  resolution_note: { type: DataTypes.TEXT, allowNull: true },
  reported_at: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'disputes', timestamps: true });

module.exports = Dispute;