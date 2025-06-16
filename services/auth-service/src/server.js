// services/auth-service/src/server.js - COMPLETE TWILIO-ENABLED VERSION
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const twilio = require('twilio');

const app = express();
const PORT = process.env.PORT || 3001;

// ===== TWILIO CONFIGURATION =====
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Initialize Twilio client
let twilioClient = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    console.log('✅ Twilio client initialized');
  } catch (error) {
    console.error('❌ Twilio initialization error:', error.message);
    console.log('⚠️ Falling back to test mode');
  }
} else {
  console.log('⚠️ Twilio credentials missing - using test mode');
}

// In-memory storage for OTP codes (use Redis in production)
const otpStorage = new Map();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request body:', req.body);
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'auth-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    twilio: twilioClient ? 'connected' : 'test_mode'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Auth Service is running',
    service: 'auth-service',
    version: '1.0.0',
    twilio: twilioClient ? 'enabled' : 'test_mode',
    endpoints: [
      'POST /api/auth/send-sms-otp',
      'POST /api/auth/send-whatsapp-otp',
      'POST /api/auth/verify-otp',
      'GET /health'
    ]
  });
});

// ===== HELPER FUNCTIONS =====

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Store OTP with expiration
function storeOTP(phoneNumber, otp, method = 'sms') {
  const key = `${phoneNumber}-${method}`;
  const data = {
    otp,
    method,
    phoneNumber,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    attempts: 0,
    verified: false
  };
  
  otpStorage.set(key, data);
  
  // Clean up expired OTPs
  setTimeout(() => {
    otpStorage.delete(key);
  }, 10 * 60 * 1000);
  
  return data;
}

// Get stored OTP
function getStoredOTP(phoneNumber, method = 'sms') {
  const key = `${phoneNumber}-${method}`;
  return otpStorage.get(key);
}

// Validate phone number format
function isValidPhoneNumber(phoneNumber) {
  // Basic international phone number validation
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber);
}

// ===== OTP ENDPOINTS =====

// Send SMS OTP
app.post('/api/auth/send-sms-otp', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    console.log('📱 SMS OTP request for:', phoneNumber);
    
    // Validate input
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }
    
    if (!isValidPhoneNumber(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Use international format (+212...)'
      });
    }
    
    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP
    const otpData = storeOTP(phoneNumber, otp, 'sms');
    
    if (twilioClient && TWILIO_PHONE_NUMBER) {
      try {
        // Send real SMS via Twilio
        const message = await twilioClient.messages.create({
          body: `Your verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`,
          from: TWILIO_PHONE_NUMBER,
          to: phoneNumber
        });
        
        console.log('✅ SMS sent successfully via Twilio:', message.sid);
        
        res.json({
          success: true,
          message: 'SMS OTP sent successfully',
          messageId: message.sid,
          data: {
            phoneNumber,
            method: 'sms',
            expiresAt: otpData.expiresAt
          }
        });
        
      } catch (twilioError) {
        console.error('❌ Twilio SMS error:', twilioError);
        
        // Return test mode response if Twilio fails
        console.log(`📱 Test SMS OTP: ${otp} (for testing)`);
        
        res.json({
          success: true,
          message: 'SMS OTP sent successfully (test mode - Twilio error)',
          messageId: `test-sms-${Date.now()}`,
          testOTP: process.env.NODE_ENV === 'development' ? otp : undefined,
          error: twilioError.message,
          data: {
            phoneNumber,
            method: 'sms',
            expiresAt: otpData.expiresAt
          }
        });
      }
    } else {
      // Test mode - no real SMS sent
      console.log(`📱 Test SMS OTP: ${otp} (for testing)`);
      
      res.json({
        success: true,
        message: 'SMS OTP sent successfully (test mode)',
        messageId: `test-sms-${Date.now()}`,
        testOTP: process.env.NODE_ENV === 'development' ? otp : undefined,
        data: {
          phoneNumber,
          method: 'sms',
          expiresAt: otpData.expiresAt
        }
      });
    }
    
  } catch (error) {
    console.error('❌ SMS OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send SMS OTP'
    });
  }
});

// Send WhatsApp OTP
app.post('/api/auth/send-whatsapp-otp', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    console.log('📱 WhatsApp OTP request for:', phoneNumber);
    
    // Validate input
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }
    
    if (!isValidPhoneNumber(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Use international format (+212...)'
      });
    }
    
    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP
    const otpData = storeOTP(phoneNumber, otp, 'whatsapp');
    
    if (twilioClient && TWILIO_PHONE_NUMBER) {
      try {
        // Send real WhatsApp message via Twilio
        const message = await twilioClient.messages.create({
          body: `Your verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`,
          from: `whatsapp:${TWILIO_PHONE_NUMBER}`,
          to: `whatsapp:${phoneNumber}`
        });
        
        console.log('✅ WhatsApp message sent successfully via Twilio:', message.sid);
        
        res.json({
          success: true,
          message: 'WhatsApp OTP sent successfully',
          messageId: message.sid,
          data: {
            phoneNumber,
            method: 'whatsapp',
            expiresAt: otpData.expiresAt
          }
        });
        
      } catch (twilioError) {
        console.error('❌ Twilio WhatsApp error:', twilioError);
        
        // Return test mode response if Twilio fails
        console.log(`📱 Test WhatsApp OTP: ${otp} (for testing)`);
        
        res.json({
          success: true,
          message: 'WhatsApp OTP sent successfully (test mode - Twilio error)',
          messageId: `test-whatsapp-${Date.now()}`,
          testOTP: process.env.NODE_ENV === 'development' ? otp : undefined,
          error: twilioError.message,
          data: {
            phoneNumber,
            method: 'whatsapp',
            expiresAt: otpData.expiresAt
          }
        });
      }
    } else {
      // Test mode - no real WhatsApp sent
      console.log(`📱 Test WhatsApp OTP: ${otp} (for testing)`);
      
      res.json({
        success: true,
        message: 'WhatsApp OTP sent successfully (test mode)',
        messageId: `test-whatsapp-${Date.now()}`,
        testOTP: process.env.NODE_ENV === 'development' ? otp : undefined,
        data: {
          phoneNumber,
          method: 'whatsapp',
          expiresAt: otpData.expiresAt
        }
      });
    }
    
  } catch (error) {
    console.error('❌ WhatsApp OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send WhatsApp OTP'
    });
  }
});

// Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { phoneNumber, otp, method = 'sms' } = req.body;
    
    console.log('🔐 OTP verification request:', { phoneNumber, method, otp: '***' });
    
    // Validate input
    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP are required'
      });
    }
    
    // Get stored OTP
    const storedOTPData = getStoredOTP(phoneNumber, method);
    
    if (!storedOTPData) {
      return res.status(400).json({
        success: false,
        message: 'No OTP found or OTP has expired'
      });
    }
    
    // Check if already verified
    if (storedOTPData.verified) {
      return res.status(400).json({
        success: false,
        message: 'OTP has already been used'
      });
    }
    
    // Check expiration
    if (new Date() > storedOTPData.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired'
      });
    }
    
    // Check attempts limit
    if (storedOTPData.attempts >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Request a new OTP.'
      });
    }
    
    // Verify OTP
    if (otp !== storedOTPData.otp) {
      storedOTPData.attempts += 1;
      
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
        attemptsRemaining: 3 - storedOTPData.attempts
      });
    }
    
    // OTP is valid - mark as verified
    storedOTPData.verified = true;
    storedOTPData.verifiedAt = new Date();
    
    console.log('✅ OTP verified successfully for:', phoneNumber);
    
    res.json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        phoneNumber,
        method,
        verifiedAt: storedOTPData.verifiedAt
      }
    });
    
  } catch (error) {
    console.error('❌ OTP verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP'
    });
  }
});

// ===== ADMIN/DEBUG ENDPOINTS =====

// Get all stored OTPs (development only)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/auth/debug/otps', (req, res) => {
    const otps = [];
    for (const [key, value] of otpStorage.entries()) {
      otps.push({
        key,
        phoneNumber: value.phoneNumber,
        method: value.method,
        createdAt: value.createdAt,
        expiresAt: value.expiresAt,
        attempts: value.attempts,
        verified: value.verified,
        otp: '***' // Hide actual OTP in debug output for security
      });
    }
    
    res.json({
      success: true,
      data: otps,
      count: otps.length,
      twilioStatus: twilioClient ? 'connected' : 'test_mode'
    });
  });

  // Test Twilio connection
  app.get('/api/auth/debug/twilio-test', async (req, res) => {
    if (!twilioClient) {
      return res.json({
        success: false,
        message: 'Twilio not configured',
        credentials: {
          accountSid: !!TWILIO_ACCOUNT_SID,
          authToken: !!TWILIO_AUTH_TOKEN,
          phoneNumber: !!TWILIO_PHONE_NUMBER
        }
      });
    }

    try {
      // Test Twilio connection by fetching account info
      const account = await twilioClient.api.accounts(TWILIO_ACCOUNT_SID).fetch();
      
      res.json({
        success: true,
        message: 'Twilio connection successful',
        account: {
          sid: account.sid,
          friendlyName: account.friendlyName,
          status: account.status
        }
      });
    } catch (error) {
      res.json({
        success: false,
        message: 'Twilio connection failed',
        error: error.message
      });
    }
  });
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Auth Service error:', error);
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Auth Service running successfully!');
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📱 Twilio status: ${twilioClient ? '✅ Connected' : '⚠️ Test mode'}`);
  console.log('📋 Available endpoints:');
  console.log('   POST /api/auth/send-sms-otp');
  console.log('   POST /api/auth/send-whatsapp-otp');
  console.log('   POST /api/auth/verify-otp');
  console.log('   GET  /health');
  
  if (process.env.NODE_ENV === 'development') {
    console.log('   GET  /api/auth/debug/otps (debug only)');
    console.log('   GET  /api/auth/debug/twilio-test (debug only)');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;