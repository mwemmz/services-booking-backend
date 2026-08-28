const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CrewMember = sequelize.define('CrewMember', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  crew_id: { type: DataTypes.UUID, allowNull: false },
  provider_id: { type: DataTypes.UUID, allowNull: false },
}, { tableName: 'crew_members', timestamps: true });

module.exports = CrewMember;
