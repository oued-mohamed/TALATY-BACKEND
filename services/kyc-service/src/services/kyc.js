const express = require('express');
const { body } = require('express-validator');
const kycController = require('../controllers/kycController');

const router = express.Router();

// Validation rules
const completeStepValidation = [
  body('step').isIn(['profile_setup', 'document_upload', 'identity_verification', 'phone_verification', 'final_review']),
  body('data').optional().isObject()
];

const verifyIdentityValidation = [
  body('idDocumentId').isMongoId(),
  body('selfieId').isMongoId()
];

const phoneVerificationValidation = [
  body('phoneNumber').matches(/^\+212[0-9]{9}$/)
];

const verifyPhoneValidation = [
  body('code').isLength({ min: 6, max: 6 }).isNumeric()
];

// Routes
router.post('/start', kycController.startKYCProcess);
router.get('/status', kycController.getKYCStatus);
router.post('/complete-step', completeStepValidation, kycController.completeKYCStep);
router.post('/verify-identity', verifyIdentityValidation, kycController.verifyIdentityDocuments);
router.post('/send-phone-code', phoneVerificationValidation, kycController.sendPhoneVerificationCode);
router.post('/verify-phone', verifyPhoneValidation, kycController.verifyPhoneNumber);
router.get('/calculate-score', kycController.calculateKYCScore);

module.exports = router;