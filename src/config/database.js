const { Sequelize } = require('sequelize');
const config = require('./config');

const dbOptions = {
  dialect: 'postgres',
  logging: config.nodeEnv === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
};

if (config.db.ssl) {
  dbOptions.ssl = true;
  dbOptions.dialectOptions = {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  };
}

const sequelize = config.db.url
  ? new Sequelize(config.db.url, dbOptions)
  : new Sequelize(
      config.db.name,
      config.db.user,
      config.db.password,
      {
        ...dbOptions,
        host: config.db.host,
        port: config.db.port,
      }
    );

module.exports = sequelize;
