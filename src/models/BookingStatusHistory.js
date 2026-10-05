const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Append-only record of every booking status change, so the app can show a
 * timeline ("request sent", "provider accepted at K400", "arrived") instead of
 * only the current status.
 */
const BookingStatusHistory = sequelize.define('BookingStatusHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  booking_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM(
      'pending', 'assigned', 'accepted', 'rejected',
      'on-the-way', 'arrived', 'in-progress',
      'completed', 'paid', 'cancelled', 'expired'
    ),
    allowNull: false,
  },
  note: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Null when the change came from an automated job (expiry cron) rather than a person.
  actor_user_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'booking_status_history',
  timestamps: true,
  indexes: [
    { fields: ['booking_id'] },
  ],
});

module.exports = BookingStatusHistory;