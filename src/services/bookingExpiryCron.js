const cron = require('node-cron');
const { Op } = require('sequelize');
const { Booking, Provider } = require('../models');
const { notifyBookingUpdate } = require('./notificationService');

/**
 * Marks pending bookings past their expires_at as 'expired'.
 * Runs every minute by default. Configurable schedule via BOOKING_EXPIRE_CRON.
 */
const scheduleBookingExpiry = (schedule = process.env.BOOKING_EXPIRE_CRON || '* * * * *') => {
  const task = cron.schedule(schedule, async () => {
    try {
      const now = new Date();
      const where = {
        status: 'pending',
        expires_at: { [Op.lt]: now },
      };
      const expired = await Booking.findAll({
        where,
        attributes: ['id', 'customer_id', 'provider_id'],
      });
      if (expired.length === 0) return;

      const [updated] = await Booking.update({ status: 'expired' }, { where });
      console.log(`[cron] Expired ${updated} pending booking(s).`);

      for (const booking of expired) {
        await notifyBookingUpdate(booking.customer_id, 'expired', booking.id);
        const profile = await Provider.findByPk(booking.provider_id, { attributes: ['user_id'] });
        if (profile) await notifyBookingUpdate(profile.user_id, 'expired', booking.id);
      }
    } catch (error) {
      console.error('[cron] Booking expiry job failed:', error.message);
    }
  });

  console.log('[cron] Booking expiry scheduler started.');
  return task;
};

module.exports = { scheduleBookingExpiry };
