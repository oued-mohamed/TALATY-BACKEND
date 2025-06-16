// services/user-service/src/models/User.js - UPDATED VERSION
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // ✅ EXISTING: Basic user information
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    match: /^\+212[0-9]{9}$/
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false
  },
  
  // ✅ EXISTING: Verification status
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  
  // ✅ UPDATED: Enhanced role system
  role: {
    type: String,
    enum: ['user', 'admin', 'super_admin'],
    default: 'user'
  },
  
  // ✅ NEW: Admin permissions
  permissions: [{
    type: String,
    enum: [
      'view_applications',
      'manage_applications', 
      'view_documents',
      'manage_documents',
      'view_users',
      'manage_users',
      'system_settings'
    ]
  }],
  
  // ✅ NEW: Admin metadata
  adminMetadata: {
    assignedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    assignedAt: Date,
    department: String,
    lastAdminLogin: Date
  },
  
  // ✅ EXISTING: Account status and security
  isActive: {
    type: Boolean,
    default: true
  },
  lastLoginAt: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  
  // ✅ NEW: Profile completion and KYC status
  profileCompletion: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // ✅ NEW: KYC and verification info
  kycStatus: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected', 'incomplete'],
    default: 'pending'
  },
  kycScore: {
    type: Number,
    min: 0,
    max: 100
  },
  kycCompletedAt: Date,
  
  // ✅ NEW: OTP and verification method tracking
  phoneVerified: {
    type: Boolean,
    default: false
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  verificationMethod: {
    type: String,
    enum: ['sms', 'whatsapp', 'email'],
    default: 'sms'
  },
  
  // ✅ NEW: Business information (embedded for performance)
  businessInfo: {
    companyName: String,
    businessType: {
      type: String,
      enum: ['sole_proprietorship', 'llc', 'corporation', 'partnership', 'other']
    },
    registrationNumber: String,
    taxId: String,
    industry: String,
    establishedYear: Number,
    numberOfEmployees: {
      type: String,
      enum: ['1', '2-10', '11-50', '51-200', '201-500', '500+']
    },
    monthlyRevenue: {
      type: String,
      enum: ['0-10k', '10k-50k', '50k-100k', '100k-500k', '500k+']
    },
    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: {
        type: String,
        default: 'Morocco'
      }
    },
    website: String,
    description: String
  },
  
  // ✅ NEW: Application tracking
  applicationStatus: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected'],
    default: 'draft'
  },
  submittedAt: Date,
  reviewedAt: Date,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewNotes: String,
  
  // ✅ NEW: Document tracking
  documentsUploaded: {
    nationalId: { type: Boolean, default: false },
    passport: { type: Boolean, default: false },
    businessRegistration: { type: Boolean, default: false },
    bankStatement: { type: Boolean, default: false },
    selfie: { type: Boolean, default: false },
    proofOfAddress: { type: Boolean, default: false }
  },
  
  // ✅ NEW: Communication preferences
  communicationPreferences: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
    whatsapp: { type: Boolean, default: false },
    marketing: { type: Boolean, default: false }
  },
  
  // ✅ NEW: Tracking and analytics
  metadata: {
    registrationSource: String,
    deviceInfo: String,
    ipAddress: String,
    userAgent: String,
    referrer: String
  }
}, {
  timestamps: true,
  // ✅ Enable virtuals in JSON
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ✅ EXISTING: Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });
userSchema.index({ kycStatus: 1 });
userSchema.index({ applicationStatus: 1 });
userSchema.index({ createdAt: -1 });

// ✅ EXISTING: Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// ✅ NEW: Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// ✅ NEW: Virtual for admin status
userSchema.virtual('isAdmin').get(function() {
  return ['admin', 'super_admin'].includes(this.role);
});

// ✅ EXISTING: Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ✅ NEW: Calculate profile completion before saving
userSchema.pre('save', function(next) {
  if (this.isModified('firstName') || this.isModified('lastName') || this.isModified('email') || 
      this.isModified('phone') || this.isModified('businessInfo') || this.isModified('isEmailVerified') || 
      this.isModified('isPhoneVerified')) {
    this.calculateProfileCompletion();
  }
  next();
});

// ✅ EXISTING: Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// ✅ EXISTING: Increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: {
        lockUntil: 1
      },
      $set: {
        loginAttempts: 1
      }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // If we're at max attempts and it's not locked yet, lock account
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = {
      lockUntil: Date.now() + 30 * 60 * 1000 // 30 minutes
    };
  }
  
  return this.updateOne(updates);
};

// ✅ NEW: Admin helper methods
userSchema.methods.hasPermission = function(permission) {
  if (this.role === 'super_admin') return true;
  return this.permissions && this.permissions.includes(permission);
};

userSchema.methods.canManageApplications = function() {
  return this.hasPermission('manage_applications') || this.role === 'super_admin';
};

userSchema.methods.canViewDocuments = function() {
  return this.hasPermission('view_documents') || this.role === 'super_admin';
};

// ✅ NEW: Profile completion calculation
userSchema.methods.calculateProfileCompletion = function() {
  let completion = 0;
  const weights = {
    basicInfo: 30,    // firstName, lastName, email, phone
    verification: 20, // email and phone verification
    businessInfo: 30, // business details
    documents: 20     // required documents
  };
  
  // Basic info (30%)
  if (this.firstName && this.lastName && this.email && this.phone) {
    completion += weights.basicInfo;
  }
  
  // Verification (20%)
  let verificationScore = 0;
  if (this.isEmailVerified || this.emailVerified) verificationScore += 10;
  if (this.isPhoneVerified || this.phoneVerified) verificationScore += 10;
  completion += verificationScore;
  
  // Business info (30%)
  if (this.businessInfo) {
    let businessScore = 0;
    const requiredBusinessFields = ['companyName', 'businessType', 'industry'];
    const totalBusinessFields = 8; // Total important business fields
    
    requiredBusinessFields.forEach(field => {
      if (this.businessInfo[field]) businessScore += 10;
    });
    
    // Additional fields worth 5 points each
    if (this.businessInfo.registrationNumber) businessScore += 5;
    if (this.businessInfo.address && this.businessInfo.address.city) businessScore += 5;
    if (this.businessInfo.numberOfEmployees) businessScore += 5;
    if (this.businessInfo.monthlyRevenue) businessScore += 5;
    if (this.businessInfo.description) businessScore += 5;
    
    completion += Math.min(businessScore, weights.businessInfo);
  }
  
  // Documents (20%)
  if (this.documentsUploaded) {
    const requiredDocs = ['nationalId', 'businessRegistration', 'selfie'];
    const uploadedRequiredDocs = requiredDocs.filter(doc => this.documentsUploaded[doc]).length;
    completion += (uploadedRequiredDocs / requiredDocs.length) * weights.documents;
  }
  
  this.profileCompletion = Math.round(completion);
  return this.profileCompletion;
};

// ✅ NEW: Update verification status
userSchema.methods.updateVerificationStatus = function(type, status) {
  if (type === 'email') {
    this.isEmailVerified = status;
    this.emailVerified = status;
  } else if (type === 'phone') {
    this.isPhoneVerified = status;
    this.phoneVerified = status;
  }
  
  this.calculateProfileCompletion();
};

// ✅ NEW: Update KYC status
userSchema.methods.updateKYCStatus = function(status, score, reviewedBy) {
  this.kycStatus = status;
  if (score !== undefined) this.kycScore = score;
  if (status === 'approved' || status === 'rejected') {
    this.kycCompletedAt = new Date();
    this.reviewedAt = new Date();
    if (reviewedBy) this.reviewedBy = reviewedBy;
  }
};

// ✅ NEW: Mark document as uploaded
userSchema.methods.markDocumentUploaded = function(documentType) {
  if (!this.documentsUploaded) {
    this.documentsUploaded = {};
  }
  this.documentsUploaded[documentType] = true;
  this.calculateProfileCompletion();
};

// ✅ NEW: Check if ready for KYC
userSchema.methods.isReadyForKYC = function() {
  return this.profileCompletion >= 60 && 
         (this.isEmailVerified || this.emailVerified) && 
         (this.isPhoneVerified || this.phoneVerified);
};

// ✅ NEW: Get dashboard summary
userSchema.methods.getDashboardSummary = function() {
  return {
    profileCompletion: this.profileCompletion,
    kycStatus: this.kycStatus,
    applicationStatus: this.applicationStatus,
    documentsCount: this.documentsUploaded ? Object.values(this.documentsUploaded).filter(Boolean).length : 0,
    isReadyForKYC: this.isReadyForKYC(),
    fullName: this.fullName,
    isAdmin: this.isAdmin
  };
};

// ✅ NEW: Static method to get applications for admin
userSchema.statics.getApplicationsForAdmin = function(filters = {}) {
  const query = {};
  
  if (filters.status) {
    query.kycStatus = filters.status;
  }
  
  if (filters.search) {
    query.$or = [
      { firstName: { $regex: filters.search, $options: 'i' } },
      { lastName: { $regex: filters.search, $options: 'i' } },
      { email: { $regex: filters.search, $options: 'i' } },
      { phone: { $regex: filters.search, $options: 'i' } }
    ];
  }
  
  return this.find(query)
    .select('-password')
    .sort({ createdAt: -1 });
};

// ✅ NEW: Static method to get admin statistics
userSchema.statics.getAdminStats = async function() {
  const [
    totalUsers,
    verifiedUsers,
    kycStats,
    recentRegistrations
  ] = await Promise.all([
    this.countDocuments(),
    this.countDocuments({ 
      $and: [
        { $or: [{ isEmailVerified: true }, { emailVerified: true }] },
        { $or: [{ isPhoneVerified: true }, { phoneVerified: true }] }
      ]
    }),
    this.aggregate([
      {
        $group: {
          _id: '$kycStatus',
          count: { $sum: 1 }
        }
      }
    ]),
    this.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    })
  ]);
  
  return {
    totalApplications: totalUsers,
    verifiedUsers,
    pendingVerification: totalUsers - verifiedUsers,
    conversionRate: totalUsers > 0 ? ((verifiedUsers / totalUsers) * 100).toFixed(2) : '0',
    statusBreakdown: kycStats,
    recentRegistrations
  };
};

module.exports = mongoose.model('User', userSchema);