const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * What a provider pays the platform to stay listed. This is the platform's own
 * revenue (customer payments for jobs belong to the provider).
 */
const SubscriptionPayment = sequelize.define('SubscriptionPayment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  provider_id: { type: DataTypes.UUID, allowNull: false },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  method: { type: DataTypes.STRING, allowNull: true },
  reference: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.STRING, defaultValue: 'paid' },
  period_start: { type: DataTypes.DATE, allowNull: false },
  period_end: { type: DataTypes.DATE, allowNull: false },
}, { tableName: 'subscription_payments', timestamps: true });

module.exports = SubscriptionPayment;
