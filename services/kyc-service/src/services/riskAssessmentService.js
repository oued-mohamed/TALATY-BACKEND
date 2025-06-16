const axios = require('axios');

const calculateRiskScore = async (kycVerification) => {
  try {
    const factors = [];
    let totalScore = 0;

    // Identity verification factor (40%)
    const identityScore = calculateIdentityScore(kycVerification.identityVerification);
    factors.push({
      factor: 'Identity Verification',
      weight: 0.4,
      score: identityScore,
      description: 'Face matching, document authenticity, and NFC verification'
    });
    totalScore += identityScore * 0.4;

    // Phone verification factor (20%)
    const phoneScore = kycVerification.phoneVerification.isVerified ? 100 : 0;
    factors.push({
      factor: 'Phone Verification',
      weight: 0.2,
      score: phoneScore,
      description: 'SMS verification completion'
    });
    totalScore += phoneScore * 0.2;

    // Document quality factor (25%)
    const documentScore = await calculateDocumentScore(kycVerification.userId);
    factors.push({
      factor: 'Document Quality',
      weight: 0.25,
      score: documentScore,
      description: 'Document authenticity and OCR confidence'
    });
    totalScore += documentScore * 0.25;

    // Behavioral factors (15%)
    const behavioralScore = calculateBehavioralScore(kycVerification);
    factors.push({
      factor: 'Behavioral Analysis',
      weight: 0.15,
      score: behavioralScore,
      description: 'User behavior during KYC process'
    });
    totalScore += behavioralScore * 0.15;

    const finalScore = Math.round(totalScore);
    const level = getRiskLevel(finalScore);
    const recommendation = getRecommendation(finalScore);

    return {
      score: finalScore,
      level,
      factors,
      recommendation,
      calculatedAt: new Date()
    };
  } catch (error) {
    console.error('Risk score calculation error:', error);
    throw new Error('Failed to calculate risk score');
  }
};

const calculateIdentityScore = (identityVerification) => {
  let score = 0;

  // Face match score (50% of identity score)
  if (identityVerification.faceMatchScore) {
    score += identityVerification.faceMatchScore * 0.5;
  }

  // NFC verification (30% of identity score)
  if (identityVerification.nfcVerified) {
    score += 30;
  }

  // Document data extraction quality (20% of identity score)
  if (identityVerification.extractedInfo && identityVerification.extractedInfo.fullName) {
    score += 20;
  }

  return Math.min(score, 100);
};

const calculateDocumentScore = async (userId) => {
  try {
    // Get document statistics from document service
    const response = await axios.get(`${process.env.DOCUMENT_SERVICE_URL}/stats`, {
      headers: { 'x-user-id': userId }
    });

    const stats = response.data.data;
    const totalDocs = stats.total || 0;
    const verifiedDocs = stats.byStatus.find(s => s._id === 'verified')?.count || 0;

    if (totalDocs === 0) return 0;

    // Base score from verification ratio
    const verificationRatio = verifiedDocs / totalDocs;
    let score = verificationRatio * 70;

    // Bonus for having required documents
    const requiredTypes = ['national_id', 'selfie', 'business_registration'];
    const hasRequiredDocs = stats.byType.filter(t => 
      requiredTypes.includes(t._id) && t.verified > 0
    ).length;

    score += (hasRequiredDocs / requiredTypes.length) * 30;

    return Math.min(score, 100);
  } catch (error) {
    console.error('Error calculating document score:', error);
    return 50; // Default score if service unavailable
  }
};

const calculateBehavioralScore = (kycVerification) => {
  let score = 100;

  // Reduce score for multiple attempts or suspicious behavior
  if (kycVerification.phoneVerification.attempts > 2) {
    score -= 20;
  }

  // Check completion time (too fast might be suspicious)
  const completionTime = kycVerification.completedAt - kycVerification.createdAt;
  const completionMinutes = completionTime / (1000 * 60);

  if (completionMinutes < 5) {
    score -= 30; // Suspiciously fast completion
  } else if (completionMinutes > 60 * 24) {
    score -= 10; // Very slow completion
  }

  // Check if all steps were completed in order
  const expectedSteps = ['profile_setup', 'document_upload', 'identity_verification', 'phone_verification'];
  const completedSteps = kycVerification.completedSteps.map(s => s.step);
  
  if (expectedSteps.every(step => completedSteps.includes(step))) {
    score += 10; // Bonus for completing all steps
  }

  return Math.max(0, Math.min(score, 100));
};

const getRiskLevel = (score) => {
  if (score >= 85) return 'low';
  if (score >= 70) return 'medium';
  if (score >= 50) return 'high';
  return 'very_high';
};

const getRecommendation = (score) => {
  if (score >= 80) return 'approve';
  if (score >= 60) return 'review';
  return 'reject';
};

module.exports = { calculateRiskScore };