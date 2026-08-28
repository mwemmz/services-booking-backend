const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Certification = sequelize.define('Certification', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  provider_id: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  issuing_body: { type: DataTypes.STRING, allowNull: false },
  expiry_date: { type: DataTypes.DATE, allowNull: true },
  is_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
  document_url: { type: DataTypes.STRING, allowNull: true },
}, { tableName: 'certifications', timestamps: true });

module.exports = Certification;
