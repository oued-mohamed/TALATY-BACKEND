// UPDATE: services/auth-service/src/controllers/authController.js
// ========================================

const otpService = require('../services/otpService');
const rateLimit = require('express-rate-limit');

// Rate limiter for OTP endpoints
const otpLimiter = rateLimit({
  windowMs: (process.env.OTP_RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: process.env.OTP_RATE_LIMIT_MAX || 3,
  message: {
    success: false,
    message: 'Too many OTP requests. Please try again later.'
  }
});

class AuthController {
  // ... existing methods ...

  // ✅ NEW: Send SMS OTP
  async sendSMSOTP(req, res, next) {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
      }

      const result = await otpService.sendSMSOTP(phoneNumber);
      
      res.json({
        success: true,
        message: result.message,
        messageId: result.messageId
      });
    } catch (error) {
      console.error('SMS OTP Controller Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send SMS OTP',
        error: error.message
      });
    }
  }

  // ✅ NEW: Send WhatsApp OTP
  async sendWhatsAppOTP(req, res, next) {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
      }

      const result = await otpService.sendWhatsAppOTP(phoneNumber);
      
      res.json({
        success: true,
        message: result.message,
        messageId: result.messageId
      });
    } catch (error) {
      console.error('WhatsApp OTP Controller Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send WhatsApp OTP',
        error: error.message
      });
    }
  }

  // ✅ NEW: Verify OTP
  async verifyOTP(req, res, next) {
    try {
      const { phoneNumber, otp, method = 'sms' } = req.body;
      
      if (!phoneNumber || !otp) {
        return res.status(400).json({
          success: false,
          message: 'Phone number and OTP are required'
        });
      }

      const isValid = await otpService.verifyOTP(phoneNumber, otp, method);
      
      if (isValid) {
        res.json({
          success: true,
          message: 'OTP verified successfully',
          verified: true
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP',
          verified: false
        });
      }
    } catch (error) {
      console.error('OTP Verification Controller Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify OTP',
        error: error.message
      });
    }
  }
}

module.exports = { AuthController, otpLimiter };
