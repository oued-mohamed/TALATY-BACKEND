const calculateBusinessScore = (businessInfo) => {
  if (!businessInfo) {
    return {
      score: 0,
      factors: [],
      businessRisk: 'very_high'
    };
  }

  const {
    businessSector,
    yearEstablished,
    numberOfEmployees,
    annualRevenue,
    registrationNumber
  } = businessInfo;

  const factors = [];
  let totalScore = 0;

  // Business sector risk score (25%)
  const sectorScore = calculateSectorScore(businessSector);
  factors.push({
    factor: 'Business Sector',
    value: businessSector,
    weight: 0.25,
    score: sectorScore
  });
  totalScore += sectorScore * 0.25;

  // Business age score (25%)
  const ageScore = calculateBusinessAgeScore(yearEstablished);
  factors.push({
    factor: 'Business Age',
    value: new Date().getFullYear() - (yearEstablished || new Date().getFullYear()),
    weight: 0.25,
    score: ageScore
  });
  totalScore += ageScore * 0.25;

  // Company size score (20%)
  const sizeScore = calculateCompanySizeScore(numberOfEmployees);
  factors.push({
    factor: 'Company Size',
    value: numberOfEmployees || 0,
    weight: 0.2,
    score: sizeScore
  });
  totalScore += sizeScore * 0.2;

  // Revenue score (20%)
  const revenueScore = calculateAnnualRevenueScore(annualRevenue);
  factors.push({
    factor: 'Annual Revenue',
    value: annualRevenue || 0,
    weight: 0.2,
    score: revenueScore
  });
  totalScore += revenueScore * 0.2;

  // Legal compliance score (10%)
  const complianceScore = calculateComplianceScore(registrationNumber);
  factors.push({
    factor: 'Legal Compliance',
    value: registrationNumber ? 'Registered' : 'Not Registered',
    weight: 0.1,
    score: complianceScore
  });
  totalScore += complianceScore * 0.1;

  const finalScore = Math.round(totalScore);

  return {
    score: finalScore,
    factors,
    businessRisk: getBusinessRiskLevel(finalScore),
    sectorAnalysis: getSectorAnalysis(businessSector),
    recommendations: generateBusinessRecommendations(factors, finalScore)
  };
};

const calculateSectorScore = (businessSector) => {
  const sectorScores = {
    'Technology': 95,
    'Healthcare': 90,
    'Education': 85,
    'Finance': 80,
    'Manufacturing': 75,
    'Commerce': 70,
    'Services': 70,
    'Real Estate': 65,
    'Agriculture': 60,
    'Tourism': 55,
    'Construction': 50,
    'Transport': 50,
    'Other': 45
  };

  return sectorScores[businessSector] || 45;
};

const calculateBusinessAgeScore = (yearEstablished) => {
  if (!yearEstablished) return 30;
  
  const currentYear = new Date().getFullYear();
  const businessAge = currentYear - yearEstablished;
  
  if (businessAge >= 10) return 100;
  if (businessAge >= 5) return 85;
  if (businessAge >= 3) return 70;
  if (businessAge >= 2) return 60;
  if (businessAge >= 1) return 50;
  return 40; // Less than 1 year
};

const calculateCompanySizeScore = (numberOfEmployees) => {
  if (!numberOfEmployees || numberOfEmployees <= 0) return 40;
  
  if (numberOfEmployees >= 50) return 100;
  if (numberOfEmployees >= 20) return 90;
  if (numberOfEmployees >= 10) return 80;
  if (numberOfEmployees >= 5) return 70;
  if (numberOfEmployees >= 2) return 60;
  return 50; // Solo entrepreneur
};

const calculateAnnualRevenueScore = (annualRevenue) => {
  if (!annualRevenue || annualRevenue <= 0) return 30;
  
  // Annual revenue scoring tiers (in MAD)
  if (annualRevenue >= 10000000) return 100; // 10M+ MAD
  if (annualRevenue >= 5000000) return 90;   // 5M-10M MAD
  if (annualRevenue >= 2000000) return 80;   // 2M-5M MAD
  if (annualRevenue >= 1000000) return 70;   // 1M-2M MAD
  if (annualRevenue >= 500000) return 60;    // 500K-1M MAD
  if (annualRevenue >= 200000) return 50;    // 200K-500K MAD
  return 40; // Below 200K MAD
};

const calculateComplianceScore = (registrationNumber) => {
  return registrationNumber ? 100 : 30;
};

const getBusinessRiskLevel = (score) => {
  if (score >= 80) return 'low';
  if (score >= 65) return 'medium';
  if (score >= 45) return 'high';
  return 'very_high';
};

const getSectorAnalysis = (businessSector) => {
  const sectorAnalyses = {
    'Technology': {
      growth: 'high',
      stability: 'medium',
      trends: 'Growing rapidly with digital transformation',
      risks: 'Technology disruption, competition'
    },
    'Healthcare': {
      growth: 'high',
      stability: 'high',
      trends: 'Steady demand, aging population',
      risks: 'Regulatory changes, insurance dependencies'
    },
    'Commerce': {
      growth: 'medium',
      stability: 'medium',
      trends: 'Shift to online, competitive market',
      risks: 'Market saturation, economic sensitivity'
    },
    'Manufacturing': {
      growth: 'medium',
      stability: 'high',
      trends: 'Automation, supply chain optimization',
      risks: 'Raw material costs, environmental regulations'
    }
  };

  return sectorAnalyses[businessSector] || {
    growth: 'medium',
    stability: 'medium',
    trends: 'Standard business sector',
    risks: 'General market risks'
  };
};

const generateBusinessRecommendations = (factors, finalScore) => {
  const recommendations = [];
  
  factors.forEach(factor => {
    if (factor.score < 60) {
      switch (factor.factor) {
        case 'Business Sector':
          recommendations.push('Consider diversifying into higher-growth sectors or adding value-added services');
          break;
        case 'Business Age':
          recommendations.push('Focus on building business stability and track record over time');
          break;
        case 'Company Size':
          recommendations.push('Consider strategic hiring to grow the business and increase operational capacity');
          break;
        case 'Annual Revenue':
          recommendations.push('Develop strategies to increase annual revenue through market expansion or new products');
          break;
        case 'Legal Compliance':
          recommendations.push('Ensure proper business registration and maintain compliance with regulations');
          break;
      }
    }
  });
  
  if (finalScore < 65) {
    recommendations.push('Focus on business fundamentals: registration, steady revenue, and operational efficiency');
    recommendations.push('Consider business mentoring or consulting to improve overall business performance');
  }
  
  return recommendations;
};

module.exports = { calculateBusinessScore };