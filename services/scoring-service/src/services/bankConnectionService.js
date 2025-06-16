// Simulate bank connection service
const simulateBankConnection = async (bankName) => {
  // Simulate connection delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Simulate different bank connection success rates
  const bankSuccessRates = {
    'Attijariwafa Bank': 0.95,
    'Banque Populaire': 0.90,
    'BMCE Bank': 0.88,
    'BMCI': 0.85,
    'CIH Bank': 0.82,
    'Crédit Agricole du Maroc': 0.80,
    'Société Générale Maroc': 0.78,
    'Bank of Africa': 0.75,
    'CFG Bank': 0.70,
    'Crédit du Maroc': 0.72,
    'Al Barid Bank': 0.65
  };

  const successRate = bankSuccessRates[bankName] || 0.60;
  const isSuccess = Math.random() < successRate;

  if (isSuccess) {
    return {
      success: true,
      bankName,
      connectionId: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      accountsCount: Math.floor(Math.random() * 3) + 1, // 1-3 accounts
      dataQuality: Math.floor(Math.random() * 20) + 80, // 80-100% quality
      lastSyncAt: new Date(),
      availableData: {
        transactions: true,
        balances: true,
        statements: true,
        creditHistory: Math.random() > 0.3 // 70% chance
      }
    };
  } else {
    return {
      success: false,
      bankName,
      error: 'Connection failed',
      errorCode: 'BANK_CONNECTION_ERROR',
      retryable: true
    };
  }
};

// Simulate fetching financial data
const fetchFinancialData = async (connectionId) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Generate realistic financial data
  const baseRevenue = Math.floor(Math.random() * 200000) + 50000; // 50K-250K MAD
  const variation = 0.2; // 20% variation

  const monthlyData = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    
    const revenue = baseRevenue * (1 + (Math.random() - 0.5) * variation);
    const expenses = revenue * (0.6 + Math.random() * 0.3); // 60-90% of revenue
    
    monthlyData.push({
      month: date.toISOString().substr(0, 7), // YYYY-MM format
      revenue: Math.round(revenue),
      expenses: Math.round(expenses),
      netIncome: Math.round(revenue - expenses),
      transactionCount: Math.floor(Math.random() * 100) + 50
    });
  }

  // Calculate aggregated metrics
  const totalRevenue = monthlyData.reduce((sum, month) => sum + month.revenue, 0);
  const totalExpenses = monthlyData.reduce((sum, month) => sum + month.expenses, 0);
  const totalTransactions = monthlyData.reduce((sum, month) => sum + month.transactionCount, 0);

  return {
    connectionId,
    lastUpdated: new Date(),
    summary: {
      monthlyRevenue: Math.round(totalRevenue / 12),
      averageBalance: Math.round(baseRevenue * 0.3), // Assume 30% of monthly revenue as balance
      transactionVolume: Math.round(totalTransactions / 12),
      cashFlow: {
        inflow: totalRevenue,
        outflow: totalExpenses,
        net: totalRevenue - totalExpenses
      }
    },
    monthlyData,
    accountDetails: {
      accountsAnalyzed: Math.floor(Math.random() * 3) + 1,
      dataCompleteness: Math.floor(Math.random() * 20) + 80,
      analysisConfidence: Math.floor(Math.random() * 15) + 85
    }
  };
};

// Simulate credit history check
const fetchCreditHistory = async (userId) => {
  // Simulate credit bureau API delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  const baseScore = Math.floor(Math.random() * 200) + 600; // 600-800 range

  return {
    userId,
    creditScore: baseScore,
    paymentHistory: Math.floor(Math.random() * 15) + 85, // 85-100%
    creditUtilization: Math.floor(Math.random() * 40) + 10, // 10-50%
    creditAge: Math.floor(Math.random() * 8) + 1, // 1-8 years
    recentInquiries: Math.floor(Math.random() * 5), // 0-4 inquiries
    publicRecords: Math.random() > 0.9 ? 1 : 0, // 10% chance of public record
    lastUpdated: new Date()
  };
};

module.exports = {
  simulateBankConnection,
  fetchFinancialData,
  fetchCreditHistory
};