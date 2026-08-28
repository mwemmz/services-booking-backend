const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const http = require('http');
require('dotenv').config();

const config = require('./config/config');
const sequelize = require('./config/database');
const { initSocket } = require('./config/socket');
const errorHandler = require('./middleware/errorHandler');
const { scheduleBookingExpiry } = require('./services/bookingExpiryCron');
const { UPLOAD_DIR } = require('./services/uploadService');

const authRoutes = require('./routes/auth');
const providerRoutes = require('./routes/providers');
const serviceRoutes = require('./routes/services');
const bookingRoutes = require('./routes/bookings');
const paymentRoutes = require('./routes/payments');
const reviewRoutes = require('./routes/reviews');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const locationRoutes = require('./routes/locations');
const categoryRoutes = require('./routes/categories');
const uploadRoutes = require('./routes/uploads');
const certificationRoutes = require('./routes/certifications');
const crewRoutes = require('./routes/crews');
const disputeRoutes = require('./routes/disputes');

const app = express();
const server = http.createServer(app);

initSocket(server);

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
});
app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many auth attempts, please try again later.',
});
app.use('/api/auth', authLimiter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/certifications', certificationRoutes);
app.use('/api/crews', crewRoutes);
app.use('/api/disputes', disputeRoutes);

// Serve uploaded files (base64 uploads) statically.
app.use('/uploads', express.static(UPLOAD_DIR));

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use(errorHandler);

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    await sequelize.sync({ alter: config.nodeEnv === 'development' });
    console.log('Database synced.');

    scheduleBookingExpiry();

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
