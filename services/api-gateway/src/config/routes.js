module.exports = {
  services: {
    'auth-service': process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    'user-service': process.env.USER_SERVICE_URL || 'http://localhost:3002',
    'document-service': process.env.DOCUMENT_SERVICE_URL || 'http://localhost:3003',
    'kyc-service': process.env.KYC_SERVICE_URL || 'http://localhost:3004',
    'scoring-service': process.env.SCORING_SERVICE_URL || 'http://localhost:3005',
    'notification-service': process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006'
  },
  
  routes: {
    '/api/auth': {
      service: 'auth-service',
      auth: false,
      // ✅ FIXED: Keep the auth path as-is since auth-service expects /api/auth
      // No pathRewrite for auth-service
    },
    '/api/users': {
      service: 'user-service',
      auth: true,
      pathRewrite: { '^/api/users': '' }  // Keep this if user-service expects root paths
    },
    '/api/documents': {
      service: 'document-service',
      auth: true,
      pathRewrite: { '^/api/documents': '' }  // Keep this if document-service expects root paths
    },
    '/api/kyc': {
      service: 'kyc-service',
      auth: true,
      pathRewrite: { '^/api/kyc': '' }  // Keep this if kyc-service expects root paths
    },
    '/api/scoring': {
      service: 'scoring-service',
      auth: true,
      pathRewrite: { '^/api/scoring': '' }  // Keep this if scoring-service expects root paths
    },
    '/api/notifications': {
      service: 'notification-service',
      auth: true,
      pathRewrite: { '^/api/notifications': '' }  // Keep this if notification-service expects root paths
    }
  }
};