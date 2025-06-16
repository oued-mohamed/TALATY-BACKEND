const math = require('mathjs');

const calculateFinancialScore = (financialData) => {
  const {
    monthlyRevenue,
    averageBalance,
    transactionVolume,
    cashFlow,
    debtToIncomeRatio,
    creditHistory
  } = financialData;

  const factors = [];
  let totalScore = 0;

  // Revenue score (30%)
  const revenueScore = calculateRevenueScore(monthlyRevenue);
  factors.push({
    factor: 'Monthly Revenue',
    value: monthlyRevenue,
    weight: 0.3,
    score: revenueScore
  });
  totalScore += revenueScore * 0.3;

  // Balance score (25%)
  const balanceScore = calculateBalanceScore(averageBalance);
  factors.push({
    factor: 'Average Balance',
    value: averageBalance,
    weight: 0.25,
    score: balanceScore
  });
  totalScore += balanceScore * 0.25;

  // Transaction volume score (20%)
  const volumeScore = calculateVolumeScore(transactionVolume);
  factors.push({
    factor: 'Transaction Volume',
    value: transactionVolume,
    weight: 0.2,
    score: volumeScore
  });
  totalScore += volumeScore * 0.2;

  // Cash flow score (15%)
  const cashFlowScore = calculateCashFlowScore(cashFlow);
  factors.push({
    factor: 'Cash Flow Stability',
    value: cashFlow?.net || 0,
    weight: 0.15,
    score: cashFlowScore
  });
  totalScore += cashFlowScore * 0.15;

  // Credit history score (10%)
  const creditScore = calculateCreditHistoryScore(creditHistory);
  factors.push({
    factor: 'Credit History',
    value: creditHistory?.score || 0,
    weight: 0.1,
    score: creditScore
  });
  totalScore += creditScore * 0.1;

  const finalScore = Math.round(totalScore);

  return {
    score: finalScore,
    factors,
    riskLevel: getRiskLevel(finalScore),
    financialStability: getStabilityRating(finalScore),
    recommendations: generateRecommendations(factors, finalScore)
  };
};

const calculateRevenueScore = (monthlyRevenue) => {
  if (!monthlyRevenue || monthlyRevenue <= 0) return 0;
  
  // Revenue scoring tiers (in MAD)
  if (monthlyRevenue >= 500000) return 100; // 500K+ MAD
  if (monthlyRevenue >= 200000) return 90;  // 200K-500K MAD
  if (monthlyRevenue >= 100000) return 80;  // 100K-200K MAD
  if (monthlyRevenue >= 50000) return 70;   // 50K-100K MAD
  if (monthlyRevenue >= 25000) return 60;   // 25K-50K MAD
  if (monthlyRevenue >= 10000) return 50;   // 10K-25K MAD
  if (monthlyRevenue >= 5000) return 40;    // 5K-10K MAD
  return 30; // Below 5K MAD
};

const calculateBalanceScore = (averageBalance) => {
  if (!averageBalance || averageBalance <= 0) return 0;
  
  // Balance scoring tiers (in MAD)
  if (averageBalance >= 200000) return 100; // 200K+ MAD
  if (averageBalance >= 100000) return 90;  // 100K-200K MAD
  if (averageBalance >= 50000) return 80;   // 50K-100K MAD
  if (averageBalance >= 25000) return 70;   // 25K-50K MAD
  if (averageBalance >= 10000) return 60;   // 10K-25K MAD
  if (averageBalance >= 5000) return 50;    // 5K-10K MAD
  if (averageBalance >= 2000) return 40;    // 2K-5K MAD
  return 30; // Below 2K MAD
};

const calculateVolumeScore = (transactionVolume) => {
  if (!transactionVolume || transactionVolume <= 0) return 0;
  
  // Transaction volume scoring (transactions per month)
  if (transactionVolume >= 500) return 100;
  if (transactionVolume >= 250) return 90;
  if (transactionVolume >= 100) return 80;
  if (transactionVolume >= 50) return 70;
  if (transactionVolume >= 25) return 60;
  if (transactionVolume >= 10) return 50;
  return 40;
};

const calculateCashFlowScore = (cashFlow) => {
  if (!cashFlow || !cashFlow.net) return 50; // Neutral if no data
  
  const { inflow, outflow, net } = cashFlow;
  
  // Cash flow stability score
  if (net <= 0) return 20; // Negative cash flow
  
  const cashFlowRatio = net / inflow;
  
  if (cashFlowRatio >= 0.3) return 100; // 30%+ net cash flow
  if (cashFlowRatio >= 0.2) return 85;  // 20-30% net cash flow
  if (cashFlowRatio >= 0.15) return 75; // 15-20% net cash flow
  if (cashFlowRatio >= 0.1) return 65;  // 10-15% net cash flow
  if (cashFlowRatio >= 0.05) return 55; // 5-10% net cash flow
  return 40; // Less than 5% net cash flow
};

const calculateCreditHistoryScore = (creditHistory) => {
  if (!creditHistory) return 50; // Neutral if no history
  
  const { score, paymentHistory, creditUtilization, creditAge } = creditHistory;
  
  let historyScore = 0;
  
  // Credit score (40% of credit history score)
  if (score >= 750) historyScore += 40;
  else if (score >= 700) historyScore += 35;
  else if (score >= 650) historyScore += 30;
  else if (score >= 600) historyScore += 25;
  else historyScore += 20;
  
  // Payment history (30% of credit history score)
  if (paymentHistory >= 95) historyScore += 30;
  else if (paymentHistory >= 90) historyScore += 25;
  else if (paymentHistory >= 85) historyScore += 20;
  else historyScore += 15;
  
  // Credit utilization (20% of credit history score)
  if (creditUtilization <= 10) historyScore += 20;
  else if (creditUtilization <= 30) historyScore += 15;
  else if (creditUtilization <= 50) historyScore += 10;
  else historyScore += 5;
  
  // Credit age (10% of credit history score)
  if (creditAge >= 5) historyScore += 10;
  else if (creditAge >= 2) historyScore += 7;
  else historyScore += 5;
  
  return historyScore;
};

const getRiskLevel = (score) => {
  if (score >= 80) return 'low';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'high';
  return 'very_high';
};

const getStabilityRating = (score) => {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 55) return 'fair';
  if (score >= 40) return 'poor';
  return 'very_poor';
};

const generateRecommendations = (factors, finalScore) => {
  const recommendations = [];
  
  // Analyze each factor and provide recommendations
  factors.forEach(factor => {
    if (factor.score < 50) {
      switch (factor.factor) {
        case 'Monthly Revenue':
          recommendations.push('Consider strategies to increase monthly revenue through business expansion or new revenue streams');
          break;
        case 'Average Balance':
          recommendations.push('Maintain higher cash reserves to improve financial stability');
          break;
        case 'Transaction Volume':
          recommendations.push('Increase business activity and transaction frequency');
          break;
        case 'Cash Flow Stability':
          recommendations.push('Improve cash flow management and reduce unnecessary expenses');
          break;
        case 'Credit History':
          recommendations.push('Build credit history through timely payments and responsible credit usage');
          break;
      }
    }
  });
  
  // Overall recommendations based on final score
  if (finalScore < 60) {
    recommendations.push('Consider working with a financial advisor to improve overall financial health');
    recommendations.push('Focus on building business revenue and maintaining consistent cash flow');
  } else if (finalScore < 80) {
    recommendations.push('Continue current financial practices while looking for improvement opportunities');
  }
  
  return recommendations;
};

module.exports = { calculateFinancialScore };