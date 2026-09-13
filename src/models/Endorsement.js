const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * A peer-worker endorsement (the second half of the anti-fraud rule).
 * A booking only becomes verified work history once BOTH:
 *  1. the customer left a review/rating, AND
 *  2. a DIFFERENT worker (not the one who did the job) confirms it happened.
 */
const Endorsement = sequelize.define('Endorsement', {
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
  requester_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Provider.id of the worker who did the job',
  },
  peer_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Provider.id of the second worker vouching for the job',
  },
  peer_user_email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'declined'),
    defaultValue: 'pending',
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  responded_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'endorsements',
  timestamps: true,
});

module.exports = Endorsement;