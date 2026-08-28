const cron = require('node-cron');
const { Op } = require('sequelize');
const { Booking } = require('../models');

/**
 * Marks pending bookings past their expires_at as 'expired'.
 * Runs every minute by default. Configurable schedule via BOOKING_EXPIRE_CRON.
 */
const scheduleBookingExpiry = (schedule = process.env.BOOKING_EXPIRE_CRON || '* * * * *') => {
  const task = cron.schedule(schedule, async () => {
    try {
      const now = new Date();
      const [updated] = await Booking.update(
        { status: 'expired' },
        {
          where: {
            status: 'pending',
            expires_at: { [Op.lt]: now },
          },
        }
      );
      if (updated > 0) {
        console.log(`[cron] Expired ${updated} pending booking(s).`);
      }
    } catch (error) {
      console.error('[cron] Booking expiry job failed:', error.message);
    }
  });

  console.log('[cron] Booking expiry scheduler started.');
  return task;
};

module.exports = { scheduleBookingExpiry };
