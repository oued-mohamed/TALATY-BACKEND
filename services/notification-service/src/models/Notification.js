const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['email', 'sms', 'push', 'in_app']
  },
  category: {
    type: String,
    required: true,
    enum: ['kyc', 'application', 'document', 'security', 'marketing', 'system']
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed
  },
  recipient: {
    email: String,
    phone: String,
    deviceToken: String
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  scheduledAt: Date,
  sentAt: Date,
  deliveredAt: Date,
  readAt: Date,
  failureReason: String,
  retryCount: {
    type: Number,
    default: 0
  },
  expiresAt: Date
}, {
  timestamps: true
});

// Indexes
notificationSchema.index({ userId: 1, status: 1 });
notificationSchema.index({ type: 1, status: 1 });
notificationSchema.index({ scheduledAt: 1 });
notificationSchema.index({ createdAt: -1 });

// Mark as read
notificationSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

// Mark as delivered
notificationSchema.methods.markAsDelivered = function() {
  this.status = 'delivered';
  this.deliveredAt = new Date();
  return this.save();
};

// Mark as failed
notificationSchema.methods.markAsFailed = function(reason) {
  this.status = 'failed';
  this.failureReason = reason;
  this.retryCount += 1;
  return this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);