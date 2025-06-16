const Notification = require('../models/Notification');
const { sendEmail } = require('../services/emailService');
const { sendSMS } = require('../services/smsService');
const { sendPushNotification } = require('../services/pushService');

// Get user notifications
exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { type, category, status, page = 1, limit = 20 } = req.query;

    let query = { userId };
    if (type) query.type = type;
    if (category) query.category = category;
    if (status) query.status = status;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ 
      userId, 
      status: { $in: ['sent', 'delivered'] } 
    });

    res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications'
    });
  }
};

// Mark notification as read
exports.markNotificationAsRead = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { notificationId } = req.params;

    const notification = await Notification.findOne({
      _id: notificationId,
      userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.markAsRead();

    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating notification'
    });
  }
};

// Mark all notifications as read
exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];

    await Notification.updateMany(
      { 
        userId, 
        status: { $in: ['sent', 'delivered'] } 
      },
      { 
        $set: { 
          status: 'read',
          readAt: new Date()
        } 
      }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating notifications'
    });
  }
};

// Send notification
exports.sendNotification = async (req, res) => {
  try {
    const {
      userId,
      type,
      category,
      title,
      message,
      data,
      recipient,
      priority = 'normal',
      scheduledAt
    } = req.body;

    const notification = new Notification({
      userId,
      type,
      category,
      title,
      message,
      data,
      recipient,
      priority,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date()
    });

    await notification.save();

    // Send immediately if not scheduled
    if (!scheduledAt || new Date(scheduledAt) <= new Date()) {
      await processNotification(notification);
    }

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: { notification }
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending notification'
    });
  }
};

// Process notification based on type
const processNotification = async (notification) => {
  try {
    notification.status = 'sent';
    notification.sentAt = new Date();

    switch (notification.type) {
      case 'email':
        await sendEmail(notification);
        break;
      case 'sms':
        await sendSMS(notification);
        break;
      case 'push':
        await sendPushNotification(notification);
        break;
      case 'in_app':
        // In-app notifications are stored and displayed in the app
        notification.status = 'delivered';
        notification.deliveredAt = new Date();
        break;
    }

    await notification.save();
  } catch (error) {
    console.error('Process notification error:', error);
    await notification.markAsFailed(error.message);
  }
};

// Get notification statistics
exports.getNotificationStats = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];

    const stats = await Notification.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const typeStats = await Notification.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    const categoryStats = await Notification.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        byStatus: stats,
        byType: typeStats,
        byCategory: categoryStats
      }
    });
  } catch (error) {
console.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notification statistics'
    });
  }
};

module.exports = {
  getUserNotifications: exports.getUserNotifications,
  markNotificationAsRead: exports.markNotificationAsRead,
  markAllNotificationsAsRead: exports.markAllNotificationsAsRead,
  sendNotification: exports.sendNotification,
  getNotificationStats: exports.getNotificationStats
};