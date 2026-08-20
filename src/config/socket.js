const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('./config');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);

    socket.join(`user:${socket.userId}`);

    socket.on('join-booking', (bookingId) => {
      socket.join(`booking:${bookingId}`);
    });

    socket.on('leave-booking', (bookingId) => {
      socket.leave(`booking:${bookingId}`);
    });

    socket.on('location-update', (data) => {
      const { bookingId, latitude, longitude } = data;
      if (socket.userRole === 'provider') {
        io.to(`booking:${bookingId}`).emit('provider-location', {
          providerId: socket.userId,
          latitude,
          longitude,
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.on('booking-action', (data) => {
      const { bookingId, action } = data;
      io.to(`booking:${bookingId}`).emit('booking-status-update', {
        bookingId,
        action,
        updatedBy: socket.userId,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

module.exports = { initSocket, getIO };
