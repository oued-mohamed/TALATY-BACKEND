// services/kyc-service/src/server.js - CLEAN VERSION (NO PROXY CODE)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request body:', req.body);
  }
  next();
});

// In-memory storage for demo (replace with database in production)
const kycData = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'kyc-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'KYC Service is running',
    service: 'kyc-service',
    version: '1.0.0',
    endpoints: [
      'GET /api/kyc/status',
      'POST /api/kyc/start',
      'POST /api/kyc/complete-step',
      'POST /api/kyc/verify-identity',
      'POST /api/kyc/send-phone-code',
      'POST /api/kyc/verify-phone',
      'GET /api/kyc/calculate-score',
      'GET /health'
    ]
  });
});

// ===== KYC ENDPOINTS =====

// Get KYC Status
app.get('/api/kyc/status', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'default';
    const userKyc = kycData.get(userId) || {
      status: 'not_started',
      currentStep: null,
      completedSteps: [],
      nextStep: 'profile_setup',
      createdAt: new Date().toISOString()
    };

    console.log('✅ KYC status retrieved for user:', userId);
    res.json({
      success: true,
      data: userKyc
    });
  } catch (error) {
    console.error('❌ Error getting KYC status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get KYC status'
    });
  }
});

// Start KYC Process
app.post('/api/kyc/start', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'default';
    const { userData } = req.body;

    const kycSession = {
      status: 'in_progress',
      currentStep: 'profile_setup',
      completedSteps: [],
      nextStep: 'document_upload',
      sessionId: `kyc_${userId}_${Date.now()}`,
      userData: userData || {},
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    kycData.set(userId, kycSession);

    console.log('✅ KYC process started for user:', userId);
    res.json({
      success: true,
      data: kycSession
    });
  } catch (error) {
    console.error('❌ Error starting KYC:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start KYC process'
    });
  }
});

// Complete KYC Step
app.post('/api/kyc/complete-step', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'default';
    const { step, data } = req.body;

    let userKyc = kycData.get(userId) || {
      status: 'in_progress',
      currentStep: null,
      completedSteps: [],
      nextStep: 'profile_setup'
    };

    // Add step to completed steps
    if (!userKyc.completedSteps.includes(step)) {
      userKyc.completedSteps.push(step);
    }

    // Update step data
    userKyc[`${step}_data`] = data;

    // Determine next step
    const stepOrder = [
      'profile_setup',
      'document_upload',
      'identity_verification',
      'phone_verification',
      'final_review'
    ];

    const currentIndex = stepOrder.indexOf(step);
    const nextStep = currentIndex < stepOrder.length - 1 ? stepOrder[currentIndex + 1] : 'completed';

    userKyc.currentStep = nextStep === 'completed' ? 'completed' : nextStep;
    userKyc.nextStep = nextStep;
    userKyc.updatedAt = new Date().toISOString();

    if (nextStep === 'completed') {
      userKyc.status = 'completed';
      userKyc.completedAt = new Date().toISOString();
    }

    kycData.set(userId, userKyc);

    console.log(`✅ KYC step '${step}' completed for user:`, userId);
    res.json({
      success: true,
      data: {
        step,
        completedAt: new Date().toISOString(),
        nextStep,
        currentStatus: userKyc.status
      }
    });
  } catch (error) {
    console.error('❌ Error completing KYC step:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete KYC step'
    });
  }
});

// Verify Identity
app.post('/api/kyc/verify-identity', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'default';
    const { idDocumentId, selfieId } = req.body;

    // Simulate identity verification
    const verificationResult = {
      verified: true,
      confidence: 95,
      faceMatchScore: 0.95,
      documentValid: true,
      identityMatch: true,
      verificationId: `verify_${Date.now()}`,
      verifiedAt: new Date().toISOString()
    };

    // Update KYC data
    let userKyc = kycData.get(userId) || {};
    userKyc.identityVerification = verificationResult;
    userKyc.updatedAt = new Date().toISOString();
    kycData.set(userId, userKyc);

    console.log('✅ Identity verification completed for user:', userId);
    res.json({
      success: true,
      data: verificationResult
    });
  } catch (error) {
    console.error('❌ Error verifying identity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify identity'
    });
  }
});

// Send Phone Verification Code
app.post('/api/kyc/send-phone-code', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'default';
    const { phoneNumber } = req.body;

    // Simulate phone code sending
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationData = {
      phoneNumber,
      code,
      sentAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      attempts: 0
    };

    // Store verification data (in production, store in database)
    let userKyc = kycData.get(userId) || {};
    userKyc.phoneVerification = verificationData;
    kycData.set(userId, userKyc);

    console.log(`✅ Phone verification code sent to ${phoneNumber} for user:`, userId);
    console.log(`📱 Code: ${code} (for testing)`);

    res.json({
      success: true,
      message: 'Phone verification code sent successfully',
      data: {
        phoneNumber,
        sentAt: verificationData.sentAt,
        expiresAt: verificationData.expiresAt
      }
    });
  } catch (error) {
    console.error('❌ Error sending phone code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send phone verification code'
    });
  }
});

// Verify Phone Code
app.post('/api/kyc/verify-phone', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'default';
    const { code } = req.body;

    const userKyc = kycData.get(userId);
    const phoneVerification = userKyc?.phoneVerification;

    if (!phoneVerification) {
      return res.status(400).json({
        success: false,
        message: 'No phone verification in progress'
      });
    }

    // Check if code has expired
    if (new Date() > new Date(phoneVerification.expiresAt)) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired'
      });
    }

    // Check if code matches
    if (code !== phoneVerification.code) {
      phoneVerification.attempts = (phoneVerification.attempts || 0) + 1;
      kycData.set(userId, userKyc);

      return res.status(400).json({
        success: false,
        message: 'Invalid verification code',
        attemptsRemaining: 3 - phoneVerification.attempts
      });
    }

    // Code is valid
    phoneVerification.verified = true;
    phoneVerification.verifiedAt = new Date().toISOString();
    userKyc.phoneVerification = phoneVerification;
    kycData.set(userId, userKyc);

    console.log('✅ Phone verification completed for user:', userId);
    res.json({
      success: true,
      message: 'Phone number verified successfully',
      data: {
        phoneNumber: phoneVerification.phoneNumber,
        verifiedAt: phoneVerification.verifiedAt
      }
    });
  } catch (error) {
    console.error('❌ Error verifying phone:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify phone number'
    });
  }
});

// Calculate Risk Score
app.get('/api/kyc/calculate-score', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'default';
    const userKyc = kycData.get(userId);

    // Simulate risk assessment calculation
    let baseScore = 50;
    const factors = [];

    if (userKyc?.completedSteps.includes('profile_setup')) {
      baseScore += 15;
      factors.push('Profile completed');
    }

    if (userKyc?.completedSteps.includes('document_upload')) {
      baseScore += 20;
      factors.push('Documents uploaded');
    }

    if (userKyc?.identityVerification?.verified) {
      baseScore += 25;
      factors.push('Identity verified');
    }

    if (userKyc?.phoneVerification?.verified) {
      baseScore += 15;
      factors.push('Phone verified');
    }

    const score = Math.min(baseScore, 100);
    const level = score >= 80 ? 'low' : score >= 60 ? 'medium' : 'high';
    const recommendation = score >= 70 ? 'approved' : score >= 50 ? 'review' : 'rejected';

    const riskAssessment = {
      score,
      level,
      recommendation,
      factors,
      calculatedAt: new Date().toISOString(),
      confidence: 0.85
    };

    console.log('✅ Risk score calculated for user:', userId, 'Score:', score);
    res.json({
      success: true,
      data: {
        riskAssessment
      }
    });
  } catch (error) {
    console.error('❌ Error calculating score:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate risk score'
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ KYC Service error:', error);
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 KYC Service running successfully!');
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log('📋 Available endpoints:');
  console.log('   GET  /api/kyc/status');
  console.log('   POST /api/kyc/start');
  console.log('   POST /api/kyc/complete-step');
  console.log('   POST /api/kyc/verify-identity');
  console.log('   POST /api/kyc/send-phone-code');
  console.log('   POST /api/kyc/verify-phone');
  console.log('   GET  /api/kyc/calculate-score');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;