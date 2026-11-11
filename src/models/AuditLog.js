const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/** Append-only record of security-relevant events, shown to admins. */
const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  actor_id: { type: DataTypes.UUID, allowNull: true },
  actor_name: { type: DataTypes.STRING, allowNull: true },
  action: { type: DataTypes.STRING, allowNull: false },
  target_type: { type: DataTypes.STRING, allowNull: true },
  target_id: { type: DataTypes.STRING, allowNull: true },
  detail: { type: DataTypes.TEXT, allowNull: true },
  ip: { type: DataTypes.STRING, allowNull: true },
}, {
  tableName: 'audit_logs',
  timestamps: true,
  updatedAt: false,
});

module.exports = AuditLog;
