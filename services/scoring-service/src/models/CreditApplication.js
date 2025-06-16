const mongoose = require('mongoose');

const creditApplicationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  applicationNumber: {
    type: String,
    unique: true,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'cancelled'],
    default: 'draft'
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  requestedAmount: {
    type: Number,
    min: 0
  },
  purpose: {
    type: String,
    enum: ['working_capital', 'equipment', 'expansion', 'refinancing', 'other']
  },
  bankConnection: {
    status: {
      type: String,
      enum: ['pending', 'connected', 'failed'],
      default: 'pending'
    },
    bankName: String,
    connectionMethod: String,
    lastSyncAt: Date,
    accountsConnected: Number,
    dataQuality: Number
  },
  financialAnalysis: {
    status: {
      type: String,
      enum: ['pending', 'analyzing', 'completed', 'failed'],
      default: 'pending'
    },
    monthlyRevenue: Number,
    averageBalance: Number,
    transactionVolume: Number,
    cashFlow: {
      inflow: Number,
      outflow: Number,
      net: Number
    },
    financialHealth: {
      score: Number,
      factors: [{
        factor: String,
        value: Number,
        weight: Number
      }]
    },
    analyzedAt: Date
  },
  identityVerification: {
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed'],
      default: 'pending'
    },
    kycId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'KYCVerification'
    },
    verifiedAt: Date
  },
  additionalDocuments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }],
  creditScoring: {
    finalScore: {
      type: Number,
      min: 0,
      max: 100
    },
    components: {
      financial: {
        score: Number,
        weight: Number
      },
      identity: {
        score: Number,
        weight: Number
      },
      business: {
        score: Number,
        weight: Number
      },
      behavioral: {
        score: Number,
        weight: Number
      }
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'very_high']
    },
    recommendation: {
      type: String,
      enum: ['approve', 'conditional_approve', 'reject']
    },
    calculatedAt: Date
  },
  decision: {
    outcome: {
      type: String,
      enum: ['approved', 'rejected', 'pending']
    },
    approvedAmount: Number,
    interestRate: Number,
    terms: {
      duration: Number, // in months
      paymentSchedule: String,
      collateralRequired: Boolean
    },
    conditions: [String],
    decidedBy: String,
    decidedAt: Date,
    reason: String
  },
  submittedAt: Date,
  reviewedAt: Date,
  expiresAt: Date
}, {
  timestamps: true
});

// Indexes
creditApplicationSchema.index({ userId: 1 });
creditApplicationSchema.index({ status: 1 });
creditApplicationSchema.index({ applicationNumber: 1 });
creditApplicationSchema.index({ createdAt: -1 });

// Generate application number
creditApplicationSchema.pre('save', async function(next) {
  if (this.isNew && !this.applicationNumber) {
    const count = await this.constructor.countDocuments();
    this.applicationNumber = `CA${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Method to update progress
creditApplicationSchema.methods.updateProgress = function() {
  let progress = 0;
  
  if (this.bankConnection.status === 'connected') progress += 25;
  if (this.financialAnalysis.status === 'completed') progress += 25;
  if (this.identityVerification.status === 'completed') progress += 25;
  if (this.status === 'submitted') progress += 25;
  
  this.progress = progress;
  return progress;
};

// Method to calculate final score
creditApplicationSchema.methods.calculateFinalScore = function() {
  const components = this.creditScoring.components;
  
  if (!components.financial || !components.identity) {
    return null;
  }
  
  let finalScore = 0;
  finalScore += (components.financial.score * components.financial.weight);
  finalScore += (components.identity.score * components.identity.weight);
  
  if (components.business) {
    finalScore += (components.business.score * components.business.weight);
  }
  
  if (components.behavioral) {
    finalScore += (components.behavioral.score * components.behavioral.weight);
  }
  
  this.creditScoring.finalScore = Math.round(finalScore);
  this.creditScoring.calculatedAt = new Date();
  
  return this.creditScoring.finalScore;
};

module.exports = mongoose.model('CreditApplication', creditApplicationSchema);