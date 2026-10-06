require('dotenv').config();

const http = require('http');

const config = require('./config/config');
const sequelize = require('./config/database');
const { initSocket } = require('./config/socket');
const { createApp } = require('./app');
const { scheduleBookingExpiry } = require('./services/bookingExpiryCron');
const { applyEnumMigrations, applyCatalogMigrations } = require('./services/schemaMigrations');
const { bootstrapAdmin } = require('./services/bootstrapAdmin');

const app = createApp();
const server = http.createServer(app);

initSocket(server);

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    await applyEnumMigrations();
    await applyCatalogMigrations();

    await sequelize.sync({ alter: config.nodeEnv === 'development' });
    console.log('Database synced.');

    scheduleBookingExpiry();
    await bootstrapAdmin();

    server.listen(config.port, () => {
      console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server };
