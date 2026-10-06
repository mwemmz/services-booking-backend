require('dotenv').config();

const http = require('http');
const path = require('path');

const config = require('./src/config/config');
const sequelize = require('./src/config/database');
const { initSocket } = require('./src/config/socket');
const { createApp } = require('./src/app');
const { scanNextApiRoutes, matchesNextApiRoute } = require('./src/nextBffRoutes');
const { scheduleBookingExpiry } = require('./src/services/bookingExpiryCron');
const { applyEnumMigrations, applyCatalogMigrations } = require('./src/services/schemaMigrations');
const { bootstrapAdmin } = require('./src/services/bootstrapAdmin');

const WEB_DIR = path.join(__dirname, 'web');

const startServer = async () => {
  const next = require(require.resolve('next', { paths: [WEB_DIR] }));
  const nextApp = next({ dev: process.env.NODE_ENV !== 'production', dir: WEB_DIR });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  const nextApiRoutes = scanNextApiRoutes(WEB_DIR);
  console.log(`[next] Serving ${nextApiRoutes.length} BFF routes from ${WEB_DIR}`);

  /**
   * Both apps own paths under /api: the Express API for mobile/Bearer clients
   * and the Next BFF for the browser, which only holds an httpOnly cookie.
   * A request that carries an Authorization header is an API client and goes
   * to Express; anything else that matches a BFF route goes to Next; the rest
   * falls through to Express. Authenticated Express routes would otherwise
   * answer 401 to the cookie-only browser, and Express's 404 would swallow the
   * BFF routes Express does not define.
   *
   * Mounted at the root (not under /api) so req.url still carries the /api
   * prefix when it reaches Next.
   */
  const nextDispatch = (req, res, next) => {
    if (req.headers.authorization) return next();
    if (matchesNextApiRoute(nextApiRoutes, req.path)) return handle(req, res);
    next();
  };

  const clientUrl = process.env.CLIENT_URL;
  const app = createApp({
    nextDispatch,
    nextFallback: (req, res) => handle(req, res),
    corsOptions: clientUrl ? { origin: clientUrl, credentials: true } : undefined,
  });

  const server = http.createServer(app);
  initSocket(server, { cors: { origin: clientUrl || true, methods: ['GET', 'POST'] } });

  await sequelize.authenticate();
  console.log('Database connected successfully.');

  await applyEnumMigrations();
  await applyCatalogMigrations();

  await sequelize.sync({ alter: config.nodeEnv === 'development' });
  console.log('Database synced.');

  scheduleBookingExpiry();
  await bootstrapAdmin();

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Combined Express + Next server running on port ${port} in ${config.nodeEnv} mode`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
