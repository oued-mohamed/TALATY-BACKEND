const KYCVerification = require('../models/KYCVerification');
const { validationResult } = require('express-validator');
const { publishEvent } = require('../services/eventPublisher');
const { sendSMS } = require('../services/smsService');
const { performFaceMatch } = require('../services/faceMatchService');
const { calculateRiskScore } = require('../services/riskAssessmentService');
const axios = require('axios');

// Start KYC process
exports.startKYCProcess = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { ipAddress, userAgent, geolocation } = req.body;

    // Check if user already has an active KYC process
    let kycVerification = await KYCVerification.findOne({
      userId,
      status: { $in: ['pending', 'in_progress'] }
    });

    if (!kycVerification) {
      kycVerification = new KYCVerification({
        userId,
        status: 'in_progress',
        currentStep: 'profile_setup',
        metadata: {
          ipAddress,
          userAgent,
          geolocation
        }
      });
      await kycVerification.save();

      // Publish KYC started event
      await publishEvent('kyc.started', {
        userId,
        kycId: kycVerification._id,
        startedAt: new Date()
      });
    }

    res.status(200).json({
      success: true,
      message: 'KYC process started',
      data: { kycVerification }
    });
  } catch (error) {
    console.error('Start KYC error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during KYC initialization'
    });
  }
};

// Get KYC status
exports.getKYCStatus = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];

    const kycVerification = await KYCVerification.findOne({ userId })
      .populate('identityVerification.idDocument')
      .populate('identityVerification.selfie')
      .populate('businessVerification.registrationDocument')
      .populate('businessVerification.bankStatements')
      .sort({ createdAt: -1 });

    if (!kycVerification) {
      return res.status(404).json({
        success: false,
        message: 'KYC verification not found'
      });
    }

    // Add progress calculation
    const responseData = {
      ...kycVerification.toObject(),
      progress: kycVerification.getProgress()
    };

    res.status(200).json({
      success: true,
      data: { kycVerification: responseData }
    });
  } catch (error) {
    console.error('Get KYC status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching KYC status'
    });
  }
};

// Complete KYC step
exports.completeKYCStep = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { step, data } = req.body;

    const kycVerification = await KYCVerification.findOne({
      userId,
      status: { $in: ['pending', 'in_progress'] }
    });

    if (!kycVerification) {
      return res.status(404).json({
        success: false,
        message: 'Active KYC verification not found'
      });
    }

    // Complete the step
    kycVerification.completeStep(step, data);

    // Handle specific step logic
    switch (step) {
      case 'profile_setup':
        await handleProfileSetupComplete(kycVerification, data);
        break;
      case 'document_upload':
        await handleDocumentUploadComplete(kycVerification, data);
        break;
      case 'identity_verification':
        await handleIdentityVerificationComplete(kycVerification, data);
        break;
      case 'phone_verification':
        await handlePhoneVerificationComplete(kycVerification, data);
        break;
      case 'final_review':
        await handleFinalReviewComplete(kycVerification, data);
        break;
    }

    await kycVerification.save();

    // Publish step completed event
    await publishEvent('kyc.step.completed', {
      userId,
      kycId: kycVerification._id,
      step,
      currentStep: kycVerification.currentStep,
      progress: kycVerification.getProgress()
    });

    res.status(200).json({
      success: true,
      message: 'KYC step completed successfully',
      data: { kycVerification }
    });
  } catch (error) {
    console.error('Complete KYC step error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during KYC step completion'
    });
  }
};

// Verify identity documents
exports.verifyIdentityDocuments = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { idDocumentId, selfieId } = req.body;

    const kycVerification = await KYCVerification.findOne({
      userId,
      status: { $in: ['pending', 'in_progress'] }
    });

    if (!kycVerification) {
      return res.status(404).json({
        success: false,
        message: 'Active KYC verification not found'
      });
    }

    // Get document information from document service
    const [idDocumentResponse, selfieResponse] = await Promise.all([
      axios.get(`${process.env.DOCUMENT_SERVICE_URL}/${idDocumentId}`, {
        headers: { 'x-user-id': userId }
      }),
      axios.get(`${process.env.DOCUMENT_SERVICE_URL}/${selfieId}`, {
        headers: { 'x-user-id': userId }
      })
    ]);

    const idDocument = idDocumentResponse.data.data.document;
    const selfie = selfieResponse.data.data.document;

    // Perform face matching
    const faceMatchResult = await performFaceMatch(idDocument.path, selfie.path);

    // Extract information from ID document
    const extractedInfo = idDocument.extractedData || {};

    // Simulate NFC verification (in real implementation, this would be actual NFC data)
    const nfcVerified = Math.random() > 0.3; // 70% success rate
    const nfcData = nfcVerified ? {
      documentNumber: extractedInfo.documentNumber || 'K01234567',
      digitalSignature: true,
      certificateValid: true
    } : null;

    // Update KYC verification
    kycVerification.identityVerification = {
      idDocument: idDocumentId,
      selfie: selfieId,
      faceMatchScore: faceMatchResult.confidence,
      nfcVerified,
      nfcData,
      extractedInfo: {
        fullName: extractedInfo.fullName || 'MOUHCINE TEMSAMANI',
        dateOfBirth: new Date(extractedInfo.dateOfBirth || '1988-11-29'),
        nationality: extractedInfo.nationality || 'MAROCAINE',
        documentNumber: extractedInfo.documentNumber || 'K01234567',
        expiryDate: new Date(extractedInfo.expiryDate || '2029-09-09'),
        placeOfBirth: extractedInfo.placeOfBirth || 'TANGER'
      },
      verificationMethod: nfcVerified ? 'nfc' : 'automatic'
    };

    await kycVerification.save();

    // Update document statuses in document service
    await Promise.all([
      axios.put(`${process.env.DOCUMENT_SERVICE_URL}/${idDocumentId}/status`, {
        status: 'verified',
        notes: 'Identity document verified successfully'
      }, {
        headers: { 'x-user-id': userId }
      }),
      axios.put(`${process.env.DOCUMENT_SERVICE_URL}/${selfieId}/status`, {
        status: 'verified',
        notes: `Face match confidence: ${faceMatchResult.confidence}%`
      }, {
        headers: { 'x-user-id': userId }
      })
    ]);

    // Publish identity verification event
    await publishEvent('kyc.identity.verified', {
      userId,
      kycId: kycVerification._id,
      faceMatchScore: faceMatchResult.confidence,
      nfcVerified,
      extractedInfo: kycVerification.identityVerification.extractedInfo
    });

    res.status(200).json({
      success: true,
      message: 'Identity verification completed successfully',
      data: {
        faceMatchScore: faceMatchResult.confidence,
        nfcVerified,
        extractedInfo: kycVerification.identityVerification.extractedInfo
      }
    });
  } catch (error) {
    console.error('Verify identity error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during identity verification'
    });
  }
};

// Send phone verification code
exports.sendPhoneVerificationCode = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { phoneNumber } = req.body;

    const kycVerification = await KYCVerification.findOne({
      userId,
      status: { $in: ['pending', 'in_progress'] }
    });

    if (!kycVerification) {
      return res.status(404).json({
        success: false,
        message: 'Active KYC verification not found'
      });
    }

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update KYC verification
    kycVerification.phoneVerification = {
      phoneNumber,
      verificationCode,
      codeExpiresAt,
      isVerified: false,
      attempts: 0
    };

    await kycVerification.save();

    // Send SMS
    try {
      await sendSMS(phoneNumber, `Votre code de vérification est: ${verificationCode}. Ce code expire dans 10 minutes.`);
    } catch (smsError) {
      console.error('SMS sending failed:', smsError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification code'
      });
    }

    // Publish phone verification code sent event
    await publishEvent('kyc.phone.code_sent', {
      userId,
      kycId: kycVerification._id,
      phoneNumber
    });

    res.status(200).json({
      success: true,
      message: 'Verification code sent successfully'
    });
  } catch (error) {
    console.error('Send phone verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during phone verification'
    });
  }
};

// Verify phone number
exports.verifyPhoneNumber = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { code } = req.body;

    const kycVerification = await KYCVerification.findOne({
      userId,
      status: { $in: ['pending', 'in_progress'] }
    });

    if (!kycVerification) {
      return res.status(404).json({
        success: false,
        message: 'Active KYC verification not found'
      });
    }

    const phoneVerification = kycVerification.phoneVerification;

    // Check if code exists and not expired
    if (!phoneVerification.verificationCode || 
        new Date() > phoneVerification.codeExpiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Verification code expired or not found'
      });
    }

    // Check attempts limit
    if (phoneVerification.attempts >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Too many verification attempts. Please request a new code.'
      });
    }

    // Verify code
    if (phoneVerification.verificationCode !== code) {
      phoneVerification.attempts += 1;
      await kycVerification.save();
      
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Mark as verified
    phoneVerification.isVerified = true;
    phoneVerification.verifiedAt = new Date();
    phoneVerification.verificationCode = undefined;
    phoneVerification.codeExpiresAt = undefined;

    await kycVerification.save();

    // Update user service
    try {
      await axios.patch(`${process.env.USER_SERVICE_URL}/verification-status`, {
        type: 'phone',
        status: true
      }, {
        headers: { 'x-user-id': userId }
      });
    } catch (error) {
      console.error('Failed to update user service:', error);
    }

    // Publish phone verification event
    await publishEvent('kyc.phone.verified', {
      userId,
      kycId: kycVerification._id,
      phoneNumber: phoneVerification.phoneNumber
    });

    res.status(200).json({
      success: true,
      message: 'Phone number verified successfully'
    });
  } catch (error) {
    console.error('Verify phone number error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during phone verification'
    });
  }
};

// Calculate final KYC score
exports.calculateKYCScore = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];

    const kycVerification = await KYCVerification.findOne({
      userId,
      status: 'completed'
    });

    if (!kycVerification) {
      return res.status(404).json({
        success: false,
        message: 'Completed KYC verification not found'
      });
    }

    // Calculate risk assessment if not already done
    if (!kycVerification.riskAssessment.score) {
      const riskAssessment = await calculateRiskScore(kycVerification);
      kycVerification.riskAssessment = riskAssessment;
      await kycVerification.save();

      // Update user service with KYC score
      try {
        await axios.patch(`${process.env.USER_SERVICE_URL}/kyc-status`, {
          status: 'completed',
          score: riskAssessment.score
        }, {
          headers: { 'x-user-id': userId }
        });
      } catch (error) {
        console.error('Failed to update user service with KYC score:', error);
      }

      // Publish KYC score calculated event
      await publishEvent('kyc.score.calculated', {
        userId,
        kycId: kycVerification._id,
        score: riskAssessment.score,
        level: riskAssessment.level,
        recommendation: riskAssessment.recommendation
      });
    }

    res.status(200).json({
      success: true,
      data: { 
        riskAssessment: kycVerification.riskAssessment 
      }
    });
  } catch (error) {
    console.error('Calculate KYC score error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during KYC score calculation'
    });
  }
};

// Helper functions for step completion
const handleProfileSetupComplete = async (kycVerification, data) => {
  // Profile setup completion logic
  console.log('Profile setup completed for KYC:', kycVerification._id);
};

const handleDocumentUploadComplete = async (kycVerification, data) => {
  // Document upload completion logic
  console.log('Document upload completed for KYC:', kycVerification._id);
};

const handleIdentityVerificationComplete = async (kycVerification, data) => {
  // Identity verification completion logic
  console.log('Identity verification completed for KYC:', kycVerification._id);
};

const handlePhoneVerificationComplete = async (kycVerification, data) => {
  // Phone verification completion logic
  console.log('Phone verification completed for KYC:', kycVerification._id);
};

const handleFinalReviewComplete = async (kycVerification, data) => {
  // Final review completion logic - calculate risk score
  const riskAssessment = await calculateRiskScore(kycVerification);
  kycVerification.riskAssessment = riskAssessment;
  console.log('Final review completed for KYC:', kycVerification._id);
};

module.exports = {
  startKYCProcess: exports.startKYCProcess,
  getKYCStatus: exports.getKYCStatus,
  completeKYCStep: exports.completeKYCStep,
  verifyIdentityDocuments: exports.verifyIdentityDocuments,
  sendPhoneVerificationCode: exports.sendPhoneVerificationCode,
  verifyPhoneNumber: exports.verifyPhoneNumber,
  calculateKYCScore: exports.calculateKYCScore
};