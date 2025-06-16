const express = require('express');
const { body } = require('express-validator');
const scoringController = require('../controllers/scoringController');

const router = express.Router();

// Validation rules
const createApplicationValidation = [
  body('requestedAmount').optional().isNumeric().isFloat({ min: 0 }),
  body('purpose').optional().isIn(['working_capital', 'equipment', 'expansion', 'refinancing', 'other'])
];

const updateProgressValidation = [
  body('step').isIn(['bank_connection', 'financial_analysis', 'identity_verification', 'submit_application']),
  body('data').isObject()
];

const preliminaryScoreValidation = [
  body('financialData').isObject(),
  body('financialData.monthlyRevenue').isNumeric(),
  body('financialData.averageBalance').isNumeric(),
  body('financialData.transactionVolume').isNumeric()
];

// Routes
router.post('/applications', createApplicationValidation, scoringController.createCreditApplication);
router.get('/applications', scoringController.getUserApplications);
router.get('/applications/:applicationId', scoringController.getApplicationStatus);
router.put('/applications/:applicationId/progress', updateProgressValidation, scoringController.updateApplicationProgress);
router.post('/applications/:applicationId/submit', scoringController.submitApplication);
router.post('/calculate-preliminary', preliminaryScoreValidation, scoringController.calculatePreliminaryScore);

module.exports = router;