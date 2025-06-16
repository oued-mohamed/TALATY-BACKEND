const mongoose = require('mongoose');

const userProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true,
    index: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true,
    unique: true
  },
  profileCompletion: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  businessInfo: {
    companyName: String,
    businessSector: String,
    registrationNumber: String,
    rib: {
      type: String,
      match: /^\d{3}-\d{3}-\d{16}-\d{2}$/
    },
    address: {
      street: String,
      city: String,
      postalCode: String,
      country: { type: String, default: 'Morocco' }
    },
    yearEstablished: Number,
    numberOfEmployees: Number,
    annualRevenue: Number
  },
  preferences: {
    language: { type: String, default: 'fr' },
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    currency: { type: String, default: 'MAD' }
  },
  kycStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'rejected'],
    default: 'pending'
  },
  kycScore: {
    type: Number,
    min: 0,
    max: 100
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  lastActivityAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Calculate profile completion
userProfileSchema.methods.calculateProfileCompletion = function() {
  let completion = 0;
  
  if (this.firstName && this.lastName) completion += 20;
  if (this.isEmailVerified) completion += 20;
  if (this.isPhoneVerified) completion += 20;
  if (this.businessInfo.companyName && this.businessInfo.businessSector) completion += 20;
  if (this.businessInfo.rib) completion += 20;
  
  this.profileCompletion = completion;
  return completion;
};

module.exports = mongoose.model('UserProfile', userProfileSchema);