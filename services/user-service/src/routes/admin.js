const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Apply authentication and admin check to all routes
router.use(authenticateToken);
router.use(requireAdmin);

// Admin routes
router.get('/applications', adminController.getAllApplications);
router.get('/applications/stats', adminController.getApplicationStats);
router.get('/applications/export', adminController.exportApplications);
router.get('/applications/:userId', adminController.getApplicationDetails);
router.get('/applications/:userId/documents', adminController.getUserDocuments);
router.put('/applications/:userId/status', adminController.updateApplicationStatus);

module.exports = router;