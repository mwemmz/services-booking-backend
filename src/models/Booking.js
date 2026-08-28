const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  customer_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  provider_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  service_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  booking_time: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM(
      'pending', 'assigned', 'accepted', 'rejected',
      'in-progress', 'completed', 'paid', 'cancelled', 'expired'
    ),
    defaultValue: 'pending',
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  location_lat: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
  },
  location_lng: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  estimated_arrival: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  is_confirmed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'bookings',
  timestamps: true,
});

module.exports = Booking;
