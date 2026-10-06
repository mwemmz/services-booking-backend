const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const errorHandler = require('./middleware/errorHandler');
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
const nationalIdRoutes = require('./routes/nationalIds');
const insightRoutes = require('./routes/insights');
const endorsementRoutes = require('./routes/endorsements');
const addressRoutes = require('./routes/addresses');
const portfolioRoutes = require('./routes/portfolio');
const geoRoutes = require('./routes/geo');
const messageRoutes = require('./routes/messages');
const favouriteRoutes = require('./routes/favourites');
const catalogRoutes = require('./routes/catalog');

/**
 * The BFF inside this same process calls back over loopback. Those requests
 * carry their own Bearer token, come from one address, and would otherwise
 * spend the whole rate-limit budget on behalf of every visitor.
 */
const isLoopback = (req) => {
  const ip = req.ip || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
};

const notFound = (req, res) => {
  res.status(404).json({ message: 'Route not found' });
};

/**
 * Builds the Express app.
 *
 * `nextDispatch` runs before the routers and is mounted at the root rather
 * than under `/api`, so the path and URL it hands to Next still carry the
 * `/api` prefix. `nextFallback` takes everything Express does not own (pages,
 * `/_next` assets). Without them this is the plain mobile/API server.
 */
function createApp({ nextDispatch, nextFallback, corsOptions } = {}) {
  const app = express();

  // Render terminates TLS, so X-Forwarded-For has to be trusted for
  // per-client rate limiting instead of lumping everyone behind the proxy.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(morgan('dev'));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.',
    skip: isLoopback,
  });
  app.use('/api', limiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many auth attempts, please try again later.',
    skip: isLoopback,
  });
  app.use('/api/auth', authLimiter);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Before body parsing: the Next handlers read the body themselves, and a
  // stream the parser has already consumed would fail in their hands.
  if (nextDispatch) app.use(nextDispatch);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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
  app.use('/api/national-id', nationalIdRoutes);
  app.use('/api/insights', insightRoutes);
  app.use('/api/endorsements', endorsementRoutes);
  app.use('/api/addresses', addressRoutes);
  app.use('/api/portfolio', portfolioRoutes);
  app.use('/api/geo', geoRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/favourites', favouriteRoutes);
  app.use('/api/catalog', catalogRoutes);

  // Serve uploaded files (base64 uploads) statically.
  app.use('/uploads', express.static(UPLOAD_DIR));
  app.use('/uploads', notFound);

  // Unknown API paths stay JSON for the mobile clients; everything else is a
  // page or asset that belongs to the web app.
  app.use('/api', notFound);
  if (nextFallback) app.use(nextFallback);
  else app.use(notFound);

  app.use(errorHandler);

  return app;
}

module.exports = { createApp, isLoopback };
