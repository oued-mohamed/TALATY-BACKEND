const CreditApplication = require('../models/CreditApplication');
const { validationResult } = require('express-validator');
const { publishEvent } = require('../services/eventPublisher');
const { calculateFinancialScore } = require('../services/financialScoringService');
const { calculateBusinessScore } = require('../services/businessScoringService');
const { simulateBankConnection } = require('../services/bankConnectionService');
const axios = require('axios');

// Create credit application
exports.createCreditApplication = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { requestedAmount, purpose } = req.body;

    // Check if user has completed KYC
    try {
      const userResponse = await axios.get(`${process.env.USER_SERVICE_URL}/profile`, {
        headers: { 'x-user-id': userId }
      });
      
      const user = userResponse.data.data.profile;
      if (user.kycStatus !== 'completed') {
        return res.status(400).json({
          success: false,
          message: 'KYC verification must be completed before applying for credit'
        });
      }
    } catch (error) {
      console.error('Error checking user KYC status:', error);
      return res.status(500).json({
        success: false,
        message: 'Unable to verify user status'
      });
    }

    // Check for existing active application
    const existingApplication = await CreditApplication.findOne({
      userId,
      status: { $in: ['draft', 'submitted', 'under_review'] }
    });

    if (existingApplication) {
      return res.status(200).json({
        success: true,
        message: 'Active application found',
        data: { application: existingApplication }
      });
    }

    // Create new application
    const application = new CreditApplication({
      userId,
      requestedAmount,
      purpose,
      status: 'draft',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });

    application.updateProgress();
    await application.save();

    // Publish application created event
    await publishEvent('application.created', {
      userId,
      applicationId: application._id,
      applicationNumber: application.applicationNumber
    });

    res.status(201).json({
      success: true,
      message: 'Credit application created successfully',
      data: { application }
    });
  } catch (error) {
    console.error('Create credit application error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during application creation'
    });
  }
};

// Get application status
exports.getApplicationStatus = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { applicationId } = req.params;

    const application = await CreditApplication.findOne({
      _id: applicationId,
      userId
    }).populate('additionalDocuments');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { application }
    });
  } catch (error) {
    console.error('Get application status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching application status'
    });
  }
};

// Update application progress
exports.updateApplicationProgress = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { applicationId } = req.params;
    const { step, data } = req.body;

    const application = await CreditApplication.findOne({
      _id: applicationId,
      userId
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Update progress based on step
    let updated = false;

    switch (step) {
      case 'bank_connection':
        await handleBankConnection(application, data);
        updated = true;
        break;

      case 'financial_analysis':
        await handleFinancialAnalysis(application, data);
        updated = true;
        break;

      case 'identity_verification':
        await handleIdentityVerification(application, data);
        updated = true;
        break;

      case 'submit_application':
        await handleApplicationSubmission(application, data);
        updated = true;
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid step'
        });
    }

    if (updated) {
      application.updateProgress();
      await application.save();

      // Publish progress update event
      await publishEvent('application.progress.updated', {
        userId,
        applicationId: application._id,
        step,
        progress: application.progress,
        status: application.status
      });
    }

    res.status(200).json({
      success: true,
      message: 'Application updated successfully',
      data: { application }
    });
  } catch (error) {
    console.error('Update application progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during application update'
    });
  }
};

// Calculate preliminary score
exports.calculatePreliminaryScore = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { financialData } = req.body;

    // Get user profile
    const userResponse = await axios.get(`${process.env.USER_SERVICE_URL}/profile`, {
      headers: { 'x-user-id': userId }
    });
    const userProfile = userResponse.data.data.profile;

    // Calculate preliminary financial score
    const financialScore = calculateFinancialScore(financialData);
    const businessScore = calculateBusinessScore(userProfile.businessInfo);

    // Combine scores (60% financial, 40% business)
    const preliminaryScore = Math.round(
      financialScore.score * 0.6 + businessScore.score * 0.4
    );

    const scoreData = {
      score: preliminaryScore,
      components: {
        financial: financialScore,
        business: businessScore
      },
      riskLevel: getRiskLevel(preliminaryScore),
      recommendation: getRecommendation(preliminaryScore)
    };

    res.status(200).json({
      success: true,
      message: 'Preliminary score calculated',
      data: scoreData
    });
  } catch (error) {
    console.error('Calculate preliminary score error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during score calculation'
    });
  }
};

// Get user applications
exports.getUserApplications = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { status, limit = 10, page = 1 } = req.query;

    let query = { userId };
    if (status) {
      query.status = status;
    }

    const applications = await CreditApplication.find(query)
      .populate('additionalDocuments')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await CreditApplication.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        applications,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get user applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching applications'
    });
  }
};

// Submit final application
exports.submitApplication = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { applicationId } = req.params;

    const application = await CreditApplication.findOne({
      _id: applicationId,
      userId
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    if (application.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Application has already been submitted'
      });
    }

    // Validate required steps completion
    if (application.progress < 75) {
      return res.status(400).json({
        success: false,
        message: 'Please complete all required steps before submission'
      });
    }

    // Calculate final score
    const finalScore = await calculateFinalScore(application);
    
    application.status = 'submitted';
    application.submittedAt = new Date();
    application.progress = 100;
    application.creditScoring = finalScore;

    await application.save();

    // Publish application submitted event
    await publishEvent('application.submitted', {
      userId,
      applicationId: application._id,
      score: finalScore.finalScore,
      recommendation: finalScore.recommendation
    });

    res.status(200).json({
      success: true,
      message: 'Application submitted successfully',
      data: {
        application,
        finalScore: finalScore.finalScore,
        recommendation: finalScore.recommendation
      }
    });
  } catch (error) {
    console.error('Submit application error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during application submission'
    });
  }
};

// Helper functions
const handleBankConnection = async (application, data) => {
  // Simulate bank connection
  const connectionResult = await simulateBankConnection(data.bankName);
  
  application.bankConnection = {
    status: connectionResult.success ? 'connected' : 'failed',
    bankName: data.bankName,
    connectionMethod: 'API',
    lastSyncAt: new Date(),
    accountsConnected: connectionResult.accountsCount || 0,
    dataQuality: connectionResult.dataQuality || 0
  };
};

const handleFinancialAnalysis = async (application, data) => {
  const analysisResult = calculateFinancialScore(data);
  
  application.financialAnalysis = {
    status: 'completed',
    monthlyRevenue: data.monthlyRevenue,
    averageBalance: data.averageBalance,
    transactionVolume: data.transactionVolume,
    cashFlow: data.cashFlow || {},
    financialHealth: {
      score: analysisResult.score,
      factors: analysisResult.factors
    },
    analyzedAt: new Date()
  };
};

const handleIdentityVerification = async (application, data) => {
  // Get KYC status from KYC service
  try {
    const kycResponse = await axios.get(`${process.env.KYC_SERVICE_URL}/status`, {
      headers: { 'x-user-id': application.userId }
    });
    
    const kycData = kycResponse.data.data.kycVerification;
    
    application.identityVerification = {
      status: kycData.status === 'completed' ? 'completed' : 'failed',
      kycId: kycData._id,
      verifiedAt: kycData.completedAt ? new Date(kycData.completedAt) : new Date()
    };
  } catch (error) {
    console.error('Error getting KYC status:', error);
    application.identityVerification.status = 'failed';
  }
};

const handleApplicationSubmission = async (application, data) => {
  application.status = 'submitted';
  application.submittedAt = new Date();
};

const calculateFinalScore = async (application) => {
  // Get components
  const financialScore = application.financialAnalysis.financialHealth.score || 0;
  const identityScore = await getIdentityScore(application.userId);
  const businessScore = await getBusinessScore(application.userId);

  const components = {
    financial: { score: financialScore, weight: 0.5 },
    identity: { score: identityScore, weight: 0.3 },
    business: { score: businessScore, weight: 0.2 }
  };

  // Calculate weighted final score
  const finalScore = Math.round(
    components.financial.score * components.financial.weight +
    components.identity.score * components.identity.weight +
    components.business.score * components.business.weight
  );

  return {
    finalScore,
    components,
    riskLevel: getRiskLevel(finalScore),
    recommendation: getRecommendation(finalScore),
    calculatedAt: new Date()
  };
};

const getIdentityScore = async (userId) => {
  try {
    const response = await axios.get(`${process.env.KYC_SERVICE_URL}/calculate-score`, {
      headers: { 'x-user-id': userId }
    });
    return response.data.data.riskAssessment.score || 0;
  } catch (error) {
    console.error('Error getting identity score:', error);
    return 0;
  }
};

const getBusinessScore = async (userId) => {
  try {
    const response = await axios.get(`${process.env.USER_SERVICE_URL}/profile`, {
      headers: { 'x-user-id': userId }
    });
    const businessInfo = response.data.data.profile.businessInfo;
    return calculateBusinessScore(businessInfo).score;
  } catch (error) {
    console.error('Error getting business score:', error);
    return 0;
  }
};

const getRiskLevel = (score) => {
  if (score >= 80) return 'low';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'high';
  return 'very_high';
};

const getRecommendation = (score) => {
  if (score >= 75) return 'approve';
  if (score >= 60) return 'conditional_approve';
  return 'reject';
};

module.exports = {
  createCreditApplication: exports.createCreditApplication,
  getApplicationStatus: exports.getApplicationStatus,
  updateApplicationProgress: exports.updateApplicationProgress,
  calculatePreliminaryScore: exports.calculatePreliminaryScore,
  getUserApplications: exports.getUserApplications,
  submitApplication: exports.submitApplication
};