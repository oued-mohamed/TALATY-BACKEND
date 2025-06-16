// services/user-service/src/controllers/userController.js - UPDATED VERSION
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { publishEvent } = require('../services/eventPublisher');

// ✅ UPDATED: Get user profile (compatible with both User and UserProfile)
exports.getProfile = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.user?.id;
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }

    // Format response to match UserProfile structure for compatibility
    const profile = {
      userId: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified || user.emailVerified,
      isPhoneVerified: user.isPhoneVerified || user.phoneVerified,
      profileCompletion: user.profileCompletion,
      kycStatus: user.kycStatus,
      kycScore: user.kycScore,
      businessInfo: user.businessInfo,
      role: user.role,
      permissions: user.permissions,
      applicationStatus: user.applicationStatus,
      documentsUploaded: user.documentsUploaded,
      ...user.toObject()
    };

    res.status(200).json({
      success: true,
      data: { profile }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile'
    });
  }
};

// ✅ UPDATED: Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const userId = req.headers['x-user-id'] || req.user?.id;
    const updates = req.body;

    // Remove sensitive fields that shouldn't be updated via this endpoint
    delete updates.password;
    delete updates.role;
    delete updates.permissions;
    delete updates.kycStatus;
    delete updates.kycScore;
    delete updates.adminMetadata;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Recalculate profile completion
    user.calculateProfileCompletion();
    await user.save();

    // Publish profile updated event
    await publishEvent('user.profile.updated', {
      userId,
      profileCompletion: user.profileCompletion,
      updates
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { profile: user }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during profile update'
    });
  }
};

// ✅ UPDATED: Update business information
exports.updateBusinessInfo = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const userId = req.headers['x-user-id'] || req.user?.id;
    const businessData = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { businessInfo: businessData } },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Recalculate profile completion
    user.calculateProfileCompletion();
    await user.save();

    // Publish business info updated event
    await publishEvent('user.business.updated', {
      userId,
      businessInfo: user.businessInfo,
      profileCompletion: user.profileCompletion
    });

    res.status(200).json({
      success: true,
      message: 'Business information updated successfully',
      data: { 
        businessInfo: user.businessInfo,
        profileCompletion: user.profileCompletion
      }
    });
  } catch (error) {
    console.error('Update business info error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during business info update'
    });
  }
};

// ✅ UPDATED: Get dashboard data
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.user?.id;

    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const dashboardData = {
      user: user.getDashboardSummary(),
      businessInfo: user.businessInfo,
      quickActions: [
        {
          id: 'complete_profile',
          title: 'Compléter mes informations',
          progress: user.profileCompletion,
          enabled: user.profileCompletion < 100
        },
        {
          id: 'start_kyc',
          title: 'Commencer la vérification KYC',
          enabled: user.kycStatus === 'pending' && user.isReadyForKYC()
        },
        {
          id: 'upload_documents',
          title: 'Télécharger des documents',
          enabled: true
        }
      ],
      applicationStatus: user.applicationStatus,
      kycProgress: {
        status: user.kycStatus,
        score: user.kycScore,
        completedAt: user.kycCompletedAt
      }
    };

    res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard data'
    });
  }
};

// ✅ UPDATED: Update verification status
exports.updateVerificationStatus = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const { type, status } = req.body;

    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.updateVerificationStatus(type, status);
    await user.save();

    // Publish verification updated event
    await publishEvent('user.verification.updated', {
      userId,
      type,
      status,
      profileCompletion: user.profileCompletion
    });

    const responseField = type === 'email' ? 'isEmailVerified' : 'isPhoneVerified';

    res.status(200).json({
      success: true,
      message: 'Verification status updated',
      data: { 
        [responseField]: status,
        profileCompletion: user.profileCompletion
      }
    });
  } catch (error) {
    console.error('Update verification status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during verification status update'
    });
  }
};

// ✅ UPDATED: Update KYC status
exports.updateKYCStatus = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const { status, score, reviewedBy } = req.body;

    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.updateKYCStatus(status, score, reviewedBy);
    await user.save();

    // Publish KYC status updated event
    await publishEvent('user.kyc.updated', {
      userId,
      kycStatus: status,
      kycScore: score
    });

    res.status(200).json({
      success: true,
      message: 'KYC status updated',
      data: { 
        kycStatus: user.kycStatus,
        kycScore: user.kycScore
      }
    });
  } catch (error) {
    console.error('Update KYC status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during KYC status update'
    });
  }
};

// ✅ NEW: Mark document as uploaded
exports.markDocumentUploaded = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const { documentType } = req.body;

    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.markDocumentUploaded(documentType);
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Document upload status updated',
      data: { 
        documentsUploaded: user.documentsUploaded,
        profileCompletion: user.profileCompletion
      }
    });
  } catch (error) {
    console.error('Mark document uploaded error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during document status update'
    });
  }
};

// ✅ NEW: Get user statistics
exports.getUserStats = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.user?.id;

    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const stats = {
      profileCompletion: user.profileCompletion,
      kycStatus: user.kycStatus,
      kycScore: user.kycScore,
      documentsUploaded: user.documentsUploaded,
      applicationStatus: user.applicationStatus,
      verificationStatus: {
        email: user.isEmailVerified || user.emailVerified,
        phone: user.isPhoneVerified || user.phoneVerified
      },
      accountAge: Math.floor((Date.now() - user.createdAt) / (1000 * 60 * 60 * 24)), // days
      lastLoginDays: user.lastLoginAt ? Math.floor((Date.now() - user.lastLoginAt) / (1000 * 60 * 60 * 24)) : null
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user statistics'
    });
  }
};

// ✅ UPDATED: Delete user profile
exports.deleteProfile = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.user?.id;

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Publish profile deleted event
    await publishEvent('user.profile.deleted', { userId });

    res.status(200).json({
      success: true,
      message: 'Profile deleted successfully'
    });
  } catch (error) {
    console.error('Delete profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during profile deletion'
    });
  }
};

// ✅ NEW: Update communication preferences
exports.updateCommunicationPreferences = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const preferences = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { communicationPreferences: preferences } },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Communication preferences updated',
      data: { 
        communicationPreferences: user.communicationPreferences
      }
    });
  } catch (error) {
    console.error('Update communication preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during preferences update'
    });
  }
};

module.exports = {
  getProfile: exports.getProfile,
  updateProfile: exports.updateProfile,
  updateBusinessInfo: exports.updateBusinessInfo,
  getDashboard: exports.getDashboard,
  updateVerificationStatus: exports.updateVerificationStatus,
  updateKYCStatus: exports.updateKYCStatus,
  markDocumentUploaded: exports.markDocumentUploaded,
  getUserStats: exports.getUserStats,
  deleteProfile: exports.deleteProfile,
  updateCommunicationPreferences: exports.updateCommunicationPreferences
};