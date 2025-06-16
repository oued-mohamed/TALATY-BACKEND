const mongoose = require('mongoose');

const kycVerificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'rejected'],
    default: 'pending'
  },
  currentStep: {
    type: String,
    enum: ['profile_setup', 'document_upload', 'identity_verification', 'phone_verification', 'final_review'],
    default: 'profile_setup'
  },
  completedSteps: [{
    step: String,
    completedAt: { type: Date, default: Date.now },
    data: mongoose.Schema.Types.Mixed
  }],
  identityVerification: {
    idDocument: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document'
    },
    selfie: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document'
    },
    faceMatchScore: Number,
    nfcVerified: {
      type: Boolean,
      default: false
    },
    nfcData: {
      documentNumber: String,
      digitalSignature: Boolean,
      certificateValid: Boolean
    },
    extractedInfo: {
      fullName: String,
      dateOfBirth: Date,
      nationality: String,
      documentNumber: String,
      expiryDate: Date,
      placeOfBirth: String
    },
    verificationMethod: {
      type: String,
      enum: ['manual', 'automatic', 'nfc'],
      default: 'automatic'
    }
  },
  phoneVerification: {
    phoneNumber: String,
    verificationCode: String,
    codeExpiresAt: Date,
    isVerified: {
      type: Boolean,
      default: false
    },
    attempts: {
      type: Number,
      default: 0
    },
    verifiedAt: Date
  },
  businessVerification: {
    registrationDocument: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document'
    },
    bankStatements: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document'
    }],
    rib: String,
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    },
    verifiedAt: Date
  },
  riskAssessment: {
    score: {
      type: Number,
      min: 0,
      max: 100
    },
    level: {
      type: String,
      enum: ['low', 'medium', 'high', 'very_high']
    },
    factors: [{
      factor: String,
      weight: Number,
      score: Number,
      description: String
    }],
    recommendation: {
      type: String,
      enum: ['approve', 'review', 'reject']
    },
    calculatedAt: Date
  },
  reviewNotes: [{
    note: String,
    addedBy: String,
    addedAt: { type: Date, default: Date.now }
  }],
  metadata: {
    ipAddress: String,
    userAgent: String,
    geolocation: {
      country: String,
      city: String,
      latitude: Number,
      longitude: Number
    },
    deviceFingerprint: String
  },
  completedAt: Date,
  expiresAt: Date,
  rejectionReason: String
}, {
  timestamps: true
});

// Indexes
kycVerificationSchema.index({ userId: 1 });
kycVerificationSchema.index({ status: 1 });
kycVerificationSchema.index({ currentStep: 1 });
kycVerificationSchema.index({ createdAt: -1 });

// Auto-set expiry date
kycVerificationSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  }
  next();
});

// Method to complete a step
kycVerificationSchema.methods.completeStep = function(step, data = {}) {
  // Add to completed steps if not already completed
  const existingStep = this.completedSteps.find(s => s.step === step);
  if (!existingStep) {
    this.completedSteps.push({ step, data });
  }

  // Update current step based on completion
  const stepOrder = ['profile_setup', 'document_upload', 'identity_verification', 'phone_verification', 'final_review'];
  const currentIndex = stepOrder.indexOf(step);
  if (currentIndex < stepOrder.length - 1) {
    this.currentStep = stepOrder[currentIndex + 1];
  } else {
    this.currentStep = 'final_review';
    this.status = 'completed';
    this.completedAt = new Date();
  }

  return this;
};

// Method to calculate progress percentage
kycVerificationSchema.methods.getProgress = function() {
  const totalSteps = 5;
  const completedCount = this.completedSteps.length;
  return Math.round((completedCount / totalSteps) * 100);
};

// Method to check if step is completed
kycVerificationSchema.methods.isStepCompleted = function(step) {
  return this.completedSteps.some(s => s.step === step);
};

module.exports = mongoose.model('KYCVerification', kycVerificationSchema);