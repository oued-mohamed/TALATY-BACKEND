const express = require('express');
const { AuthController, otpLimiter } = require('../controllers/authController');

const router = express.Router();
const authController = new AuthController();

// Existing routes...
// router.post('/login', authController.login);
// router.post('/register', authController.register);

// ✅ NEW: OTP Routes
router.post('/send-sms-otp', otpLimiter, authController.sendSMSOTP.bind(authController));
router.post('/send-whatsapp-otp', otpLimiter, authController.sendWhatsAppOTP.bind(authController));
router.post('/verify-otp', authController.verifyOTP.bind(authController));

module.exports = router;