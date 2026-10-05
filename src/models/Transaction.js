const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Money owed to a provider for a booking. Created as PENDING when the request is
 * made, re-priced if the provider quotes a different amount, EARNED once the job
 * completes, and VOID if the booking is declined or cancelled.
 */
const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  booking_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
  },
  provider_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  customer_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'EARNED', 'VOID'),
    defaultValue: 'PENDING',
  },
  earned_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'transactions',
  timestamps: true,
  indexes: [
    { fields: ['provider_id'] },
    { fields: ['status'] },
  ],
});

module.exports = Transaction;