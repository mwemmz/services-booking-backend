const admin = require('firebase-admin');
const { Notification, User } = require('../models');

const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  if (!fcmToken) return;

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, String(value)])
      ),
    });
  } catch (error) {
    console.error('FCM push notification failed:', error.message);
  }
};

const createNotification = async (userId, type, title, body, data = null) => {
  try {
    return await Notification.create({
      user_id: userId,
      type,
      title,
      body,
      data,
    });
  } catch (error) {
    console.error('Failed to create notification record:', error.message);
    return null;
  }
};

const notifyBookingUpdate = async (userId, status, bookingId) => {
  const statusMessages = {
    pending: { title: 'Booking Submitted', body: 'Your booking request has been submitted.' },
    assigned: { title: 'Provider Assigned', body: 'A provider has been assigned to your booking.' },
    accepted: { title: 'Booking Accepted', body: 'Your booking has been accepted by the provider.' },
    rejected: { title: 'Booking Rejected', body: 'Your booking has been rejected by the provider.' },
    'in-progress': { title: 'Service In Progress', body: 'Your service is now in progress.' },
    'on-the-way': { title: 'Provider On The Way', body: 'Your provider is on the way to you.' },
    'arrived': { title: 'Provider Arrived', body: 'Your provider has arrived at the location.' },
    completed: { title: 'Service Completed', body: 'Your service has been completed.' },
    paid: { title: 'Payment Confirmed', body: 'Your payment has been confirmed.' },
    cancelled: { title: 'Booking Cancelled', body: 'Your booking has been cancelled.' },
    expired: { title: 'Booking Expired', body: 'Your booking has expired.' },
  };

  const { title, body } = statusMessages[status] || {
    title: 'Booking Update',
    body: `Your booking status has been updated to ${status}.`,
  };

  const data = { bookingId, status };

  const user = await User.findByPk(userId);
  if (user && user.fcm_token) {
    await sendPushNotification(user.fcm_token, title, body, data);
  }

  await createNotification(userId, 'booking_update', title, body, data);
};

module.exports = {
  sendPushNotification,
  createNotification,
  notifyBookingUpdate,
};
