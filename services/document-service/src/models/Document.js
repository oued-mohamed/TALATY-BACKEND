const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['national_id', 'passport', 'driving_license', 'business_registration', 'bank_statement', 'selfie']
  },
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  url: String, // For cloud storage
  size: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  uploadProgress: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'processing', 'verified', 'rejected'],
    default: 'pending'
  },
  extractedData: {
    type: mongoose.Schema.Types.Mixed
  },
  verificationNotes: String,
  metadata: {
    extractedText: String,
    confidence: Number,
    faceMatch: Number,
    documentQuality: Number,
    securityFeatures: {
      digitalSignature: Boolean,
      watermarks: Boolean,
      rfidChip: Boolean
    }
  },
  processingHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    processedBy: String,
    notes: String
  }],
  expiresAt: Date, // For temporary documents
  tags: [String]
}, {
  timestamps: true
});

// Indexes
documentSchema.index({ userId: 1, type: 1 });
documentSchema.index({ verificationStatus: 1 });
documentSchema.index({ createdAt: -1 });

// Virtual for document age
documentSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt;
});

// Method to add processing history
documentSchema.methods.addProcessingHistory = function(status, processedBy, notes) {
  this.processingHistory.push({
    status,
    processedBy,
    notes,
    timestamp: new Date()
  });
};

// Method to update verification status
documentSchema.methods.updateVerificationStatus = function(status, notes) {
  this.verificationStatus = status;
  if (notes) {
    this.verificationNotes = notes;
  }
  this.addProcessingHistory(status, 'system', notes);
};

module.exports = mongoose.model('Document', documentSchema);