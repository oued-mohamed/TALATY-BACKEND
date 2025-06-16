// Event types for microservices communication
const EventTypes = {
  // User events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_VERIFIED: 'user.verified',
  USER_DELETED: 'user.deleted',

  // Authentication events
  LOGIN_ATTEMPT: 'auth.login_attempt',
  LOGIN_SUCCESS: 'auth.login_success',
  LOGIN_FAILED: 'auth.login_failed',
  PASSWORD_CHANGED: 'auth.password_changed',
  OTP_SENT: 'auth.otp_sent',
  OTP_VERIFIED: 'auth.otp_verified',

  // Document events
  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_PROCESSED: 'document.processed',
  DOCUMENT_VERIFIED: 'document.verified',
  DOCUMENT_REJECTED: 'document.rejected',
  OCR_COMPLETED: 'ocr.completed',

  // KYC events
  KYC_STARTED: 'kyc.started',
  KYC_COMPLETED: 'kyc.completed',
  KYC_APPROVED: 'kyc.approved',
  KYC_REJECTED: 'kyc.rejected',
  FACE_MATCH_COMPLETED: 'kyc.face_match_completed',
  RISK_ASSESSMENT_COMPLETED: 'kyc.risk_assessment_completed',

  // Scoring events
  SCORING_REQUESTED: 'scoring.requested',
  SCORING_COMPLETED: 'scoring.completed',
  CREDIT_APPLICATION_SUBMITTED: 'scoring.application_submitted',
  CREDIT_APPLICATION_APPROVED: 'scoring.application_approved',
  CREDIT_APPLICATION_REJECTED: 'scoring.application_rejected',

  // Notification events
  NOTIFICATION_SENT: 'notification.sent',
  EMAIL_SENT: 'notification.email_sent',
  SMS_SENT: 'notification.sms_sent',
  PUSH_NOTIFICATION_SENT: 'notification.push_sent'
};

// Event payload schemas
const EventSchemas = {
  [EventTypes.USER_CREATED]: {
    userId: 'string',
    email: 'string',
    timestamp: 'date'
  },

  [EventTypes.DOCUMENT_UPLOADED]: {
    userId: 'string',
    documentId: 'string',
    documentType: 'string',
    fileName: 'string',
    timestamp: 'date'
  },

  [EventTypes.KYC_COMPLETED]: {
    userId: 'string',
    kycId: 'string',
    status: 'string',
    score: 'number',
    riskLevel: 'string',
    timestamp: 'date'
  },

  [EventTypes.SCORING_COMPLETED]: {
    userId: 'string',
    applicationId: 'string',
    creditScore: 'number',
    riskAssessment: 'object',
    timestamp: 'date'
  }
};

module.exports = {
  EventTypes,
  EventSchemas
};