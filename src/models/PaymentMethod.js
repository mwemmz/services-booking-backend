const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/** A mobile-money number or card the customer saved for paying providers. Only the last 4 digits of a card are kept. */
const PaymentMethod = sequelize.define('PaymentMethod', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id: { type: DataTypes.UUID, allowNull: false },
  network: { type: DataTypes.STRING, allowNull: false },
  detail: { type: DataTypes.STRING, allowNull: false },
}, { tableName: 'payment_methods' });

module.exports = PaymentMethod;
