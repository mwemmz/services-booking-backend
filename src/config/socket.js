const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('./config');
const { Booking, Provider } = require('../models');

let io;

/** Mirrors TOKEN_COOKIE in web/src/lib/cookieNames.ts (same host, httpOnly). */
const WEB_TOKEN_COOKIE = 'zam_token';

const parseCookies = (header) => {
  const cookies = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
};

const initSocket = (server, options = {}) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      ...options.cors,
    },
  });

  io.use((socket, next) => {
    // Mobile sends the token in the handshake; the web app on the combined
    // host can only offer the httpOnly cookie, which rides along same-origin.
    const cookies = parseCookies(socket.handshake.headers.cookie || '');
    const token = socket.handshake.auth?.token || cookies[WEB_TOKEN_COOKIE];
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

    // Only the customer, the assigned provider or an admin may watch a booking's room.
    const mayAccessBooking = async (bookingId) => {
      try {
        if (!bookingId) return false;
        if (socket.userRole === 'admin') return true;
        const booking = await Booking.findByPk(bookingId, {
          attributes: ['id', 'customer_id', 'provider_id'],
          include: [{ model: Provider, as: 'provider', attributes: ['user_id'] }],
        });
        if (!booking) return false;
        return booking.customer_id === socket.userId || booking.provider?.user_id === socket.userId;
      } catch (err) {
        return false;
      }
    };

    socket.on('join-booking', async (bookingId) => {
      if (await mayAccessBooking(bookingId)) socket.join(`booking:${bookingId}`);
    });

    socket.on('leave-booking', (bookingId) => {
      socket.leave(`booking:${bookingId}`);
    });

    socket.on('location-update', async (data) => {
      const { bookingId, latitude, longitude, accuracy, heading, isAccurate } = data || {};
      if (socket.userRole === 'provider' && isAccurate !== false && (await mayAccessBooking(bookingId))) {
        io.to(`booking:${bookingId}`).emit('provider-location', {
          providerId: socket.userId,
          latitude,
          longitude,
          accuracy: accuracy != null ? accuracy : null,
          heading: heading != null ? heading : null,
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.on('booking-action', async (data) => {
      const { bookingId, action } = data || {};
      if (!(await mayAccessBooking(bookingId))) return;
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

/** Push an event to a single user's room (used by HTTP controllers for real-time delivery). */
const emitToUser = (userId, event, payload) => {
  if (io) io.to(`user:${userId}`).emit(event, payload);
};

/** Push an event to everyone currently viewing a booking. */
const emitToBooking = (bookingId, event, payload) => {
  if (io) io.to(`booking:${bookingId}`).emit(event, payload);
};

module.exports = { initSocket, getIO, emitToUser, emitToBooking };
