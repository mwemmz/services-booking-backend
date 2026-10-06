const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { sequelize } = require('./src/models');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { initializeSocket } = require('./src/socket');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    credentials: true,
  },
});

initializeSocket(io);

app.use(cors({ origin: process.env.CLIENT_URL || true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use('/api', require('./src/routes'));

const webDir = path.join(__dirname, 'web');
const nextBuildPath = path.join(webDir, '.next');
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  const next = require('next');
  const nextApp = next({ dev: false, dir: webDir });
  const handle = nextApp.getRequestHandler();
  nextApp.prepare().then(() => {
    app.get('*', (req, res) => {
      if (req.url.startsWith('/api/')) return;
      handle(req, res);
    });
  });
} else {
  app.get('*', (req, res) => {
    if (req.url.startsWith('/api/')) return;
    res.sendFile(path.join(webDir, 'public', 'placeholder.txt'));
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected');
  } catch (err) {
    console.error('DB connection error:', err);
  }
  console.log(`Server running on port ${PORT}`);
});
