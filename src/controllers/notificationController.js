const { Notification } = require('../models');
const { paginate, buildPaginationResponse } = require('../utils/pagination');

exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const query = paginate({
      where: { user_id: req.user.id },
      order: [['createdAt', 'DESC']],
    }, { page, limit });

    const { count, rows: notifications } = await Notification.findAndCountAll(query);

    return res.json({
      notifications,
      pagination: buildPaginationResponse(count, page, limit),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch notifications.', error: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: { id: req.params.id, user_id: req.user.id },
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    await notification.update({ read: true });

    return res.json({ message: 'Notification marked as read.', notification });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to mark notification as read.', error: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.update(
      { read: true },
      { where: { user_id: req.user.id, read: false } }
    );

    return res.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to mark notifications.', error: error.message });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: { id: req.params.id, user_id: req.user.id },
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    await notification.destroy();

    return res.json({ message: 'Notification deleted.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete notification.', error: error.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.count({
      where: { user_id: req.user.id, read: false },
    });

    return res.json({ unreadCount: count });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to get unread count.', error: error.message });
  }
};
