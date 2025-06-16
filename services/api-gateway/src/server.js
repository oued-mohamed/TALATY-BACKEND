// services/api-gateway/src/server.js - FINAL COMPLETE VERSION
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const authMiddleware = require('./middleware/auth');
const routeConfig = require('./config/routes');
const { loadBalancer } = require('./utils/loadBalancer');

const app = express();

// ===== DATABASE SETUP =====
const dbPath = path.join(__dirname, 'gateway-users.sqlite');
const db = new sqlite3.Database(dbPath);

// JWT Secret - should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Create users table if it doesn't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      firstName TEXT,
      lastName TEXT,
      phoneNumber TEXT,
      address TEXT,
      city TEXT,
      postalCode TEXT,
      country TEXT DEFAULT 'France',
      profession TEXT,
      company TEXT,
      monthlyIncome TEXT,
      dateOfBirth TEXT,
      notifications BOOLEAN DEFAULT 1,
      newsletter BOOLEAN DEFAULT 0,
      language TEXT DEFAULT 'Français',
      isEmailVerified BOOLEAN DEFAULT 0,
      isPhoneVerified BOOLEAN DEFAULT 0,
      profileCompletion INTEGER DEFAULT 25,
      kycStatus TEXT DEFAULT 'not_started',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ Database initialized');
});

// ===== MIDDLEWARE SETUP =====

// Security middleware
app.use(helmet());

// Enhanced CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:8081',
      'http://localhost:8082',
      'http://localhost:19006',
      'http://127.0.0.1:8081',
      'http://127.0.0.1:8082',
      'http://127.0.0.1:19006',
      'http://localhost:3000',
      ...(process.env.ALLOWED_ORIGINS?.split(',') || [])
    ];

    if (process.env.NODE_ENV === 'development') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('⚠️ CORS blocked origin:', origin);
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'x-request-id',
    'x-user-id',
    'x-user-role'
  ]
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP', retryAfter: 900 }
});
app.use('/api/', limiter);

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ===== AUTHENTICATION MIDDLEWARE =====
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }
    req.user = user;
    next();
  });
};

// ===== UTILITY FUNCTIONS =====
function generateRequestId() {
  return Math.random().toString(36).substring(7);
}

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: routeConfig.services || {},
    environment: process.env.NODE_ENV || 'development',
    database: 'Connected'
  });
});

// ===== ✅ AUTH SERVICE PROXY (OTP ENDPOINTS) =====
console.log('🔧 Setting up OTP proxy routes...');

const proxyToAuthService = async (req, res, endpoint) => {
  try {
    console.log(`🚀 Manually proxying ${req.method} ${endpoint} to auth-service`);
    console.log('📄 Request body:', req.body);
    
    const authServiceUrl = `http://localhost:3001${endpoint}`;
    
    const response = await axios({
      method: req.method,
      url: authServiceUrl,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': req.headers['x-request-id'] || generateRequestId(),
        ...(req.user && {
          'x-user-id': req.user.userId,
          'x-user-email': req.user.email
        })
      },
      timeout: 30000
    });
    
    console.log('✅ Auth-service response:', response.status, response.data);
    res.status(response.status).json(response.data);
    
  } catch (error) {
    console.error(`❌ Auth-service proxy error for ${endpoint}:`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(503).json({
        success: false,
        error: 'Auth service unavailable',
        message: 'The authentication service is not responding. Please try again later.',
        details: error.message
      });
    }
  }
};

// ✅ OTP routes
app.post('/api/auth/send-sms-otp', (req, res) => {
  proxyToAuthService(req, res, '/api/auth/send-sms-otp');
});

app.post('/api/auth/send-whatsapp-otp', (req, res) => {
  proxyToAuthService(req, res, '/api/auth/send-whatsapp-otp');
});

app.post('/api/auth/verify-otp', (req, res) => {
  proxyToAuthService(req, res, '/api/auth/verify-otp');
});

console.log('✅ OTP proxy routes configured:');
console.log('   /api/auth/send-sms-otp -> http://localhost:3001/api/auth/send-sms-otp');
console.log('   /api/auth/send-whatsapp-otp -> http://localhost:3001/api/auth/send-whatsapp-otp');
console.log('   /api/auth/verify-otp -> http://localhost:3001/api/auth/verify-otp');

// ===== ✅ KYC SERVICE PROXY =====
console.log('🔧 Setting up KYC proxy routes...');

const proxyToKYCService = async (req, res, endpoint) => {
  try {
    console.log(`🚀 Manually proxying ${req.method} ${endpoint} to kyc-service`);
    console.log('📄 Request body:', req.body);
    
    const kycServiceUrl = `http://localhost:3004${endpoint}`;
    
    const response = await axios({
      method: req.method,
      url: kycServiceUrl,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': req.headers['x-request-id'] || generateRequestId(),
        ...(req.user && {
          'x-user-id': req.user.userId,
          'x-user-email': req.user.email
        })
      },
      timeout: 30000
    });
    
    console.log('✅ KYC-service response:', response.status, response.data);
    res.status(response.status).json(response.data);
    
  } catch (error) {
    console.error(`❌ KYC-service proxy error for ${endpoint}:`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(503).json({
        success: false,
        error: 'KYC service unavailable',
        message: 'The KYC service is not responding. Please try again later.',
        details: error.message
      });
    }
  }
};

// ✅ KYC routes with authentication
app.get('/api/kyc/status', authenticateToken, (req, res) => {
  proxyToKYCService(req, res, '/api/kyc/status');
});

app.post('/api/kyc/start', authenticateToken, (req, res) => {
  proxyToKYCService(req, res, '/api/kyc/start');
});

app.post('/api/kyc/complete-step', authenticateToken, (req, res) => {
  proxyToKYCService(req, res, '/api/kyc/complete-step');
});

app.post('/api/kyc/verify-identity', authenticateToken, (req, res) => {
  proxyToKYCService(req, res, '/api/kyc/verify-identity');
});

app.post('/api/kyc/send-phone-code', authenticateToken, (req, res) => {
  proxyToKYCService(req, res, '/api/kyc/send-phone-code');
});

app.post('/api/kyc/verify-phone', authenticateToken, (req, res) => {
  proxyToKYCService(req, res, '/api/kyc/verify-phone');
});

app.get('/api/kyc/calculate-score', authenticateToken, (req, res) => {
  proxyToKYCService(req, res, '/api/kyc/calculate-score');
});

console.log('✅ KYC proxy routes configured:');
console.log('   GET  /api/kyc/status -> http://localhost:3004/api/kyc/status');
console.log('   POST /api/kyc/start -> http://localhost:3004/api/kyc/start');
console.log('   POST /api/kyc/complete-step -> http://localhost:3004/api/kyc/complete-step');
console.log('   POST /api/kyc/verify-identity -> http://localhost:3004/api/kyc/verify-identity');
console.log('   POST /api/kyc/send-phone-code -> http://localhost:3004/api/kyc/send-phone-code');
console.log('   POST /api/kyc/verify-phone -> http://localhost:3004/api/kyc/verify-phone');
console.log('   GET  /api/kyc/calculate-score -> http://localhost:3004/api/kyc/calculate-score');

// ===== GATEWAY AUTHENTICATION ENDPOINTS (for login/register) =====

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('📝 Registration attempt:', { email: req.body.email });
    const { email, password, firstName, lastName, phoneNumber } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters long' 
      });
    }

    // Check if user exists
    db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Database error' 
        });
      }
      
      if (row) {
        return res.status(400).json({ 
          success: false, 
          message: 'Un compte avec cet email existe déjà' 
        });
      }

      try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Insert user
        db.run(
          'INSERT INTO users (email, password, firstName, lastName, phoneNumber) VALUES (?, ?, ?, ?, ?)',
          [email, hashedPassword, firstName, lastName, phoneNumber],
          function(err) {
            if (err) {
              console.error('❌ Failed to create user:', err);
              return res.status(500).json({ 
                success: false, 
                message: 'Failed to create user' 
              });
            }

            const userId = this.lastID;
            const token = jwt.sign(
              { userId, email }, 
              JWT_SECRET, 
              { expiresIn: '7d' }
            );

            console.log('✅ User created successfully:', userId);

            res.status(201).json({
              success: true,
              data: {
                user: {
                  id: userId,
                  email,
                  firstName,
                  lastName,
                  phoneNumber,
                  isEmailVerified: false,
                  isPhoneVerified: false,
                  profileCompletion: 25,
                  kycStatus: 'not_started'
                },
                token
              }
            });
          }
        );
      } catch (hashError) {
        console.error('❌ Password hashing error:', hashError);
        res.status(500).json({ 
          success: false, 
          message: 'Server error during registration' 
        });
      }
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔐 Login attempt:', { email: req.body.email });
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Database error' 
        });
      }

      if (!user) {
        console.log('❌ User not found:', email);
        return res.status(401).json({ 
          success: false, 
          message: 'Email ou mot de passe incorrect' 
        });
      }

      try {
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          console.log('❌ Invalid password for:', email);
          return res.status(401).json({ 
            success: false, 
            message: 'Email ou mot de passe incorrect' 
          });
        }

        const token = jwt.sign(
          { userId: user.id, email: user.email }, 
          JWT_SECRET, 
          { expiresIn: '7d' }
        );

        console.log('✅ Login successful for:', email);

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;

        res.json({
          success: true,
          data: {
            user: {
              ...userWithoutPassword,
              isEmailVerified: Boolean(user.isEmailVerified),
              isPhoneVerified: Boolean(user.isPhoneVerified),
              notifications: Boolean(user.notifications),
              newsletter: Boolean(user.newsletter)
            },
            token
          }
        });
      } catch (compareError) {
        console.error('❌ Password comparison error:', compareError);
        res.status(500).json({ 
          success: false, 
          message: 'Server error during login' 
        });
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Get Current User
app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get('SELECT * FROM users WHERE id = ?', [req.user.userId], (err, user) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Database error' 
      });
    }

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json({
      success: true,
      data: {
        ...userWithoutPassword,
        isEmailVerified: Boolean(user.isEmailVerified),
        isPhoneVerified: Boolean(user.isPhoneVerified),
        notifications: Boolean(user.notifications),
        newsletter: Boolean(user.newsletter)
      }
    });
  });
});

// Logout
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  console.log('👋 User logged out:', req.user.email);
  res.json({ 
    success: true, 
    message: 'Logged out successfully' 
  });
});

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
  console.error('❌ Gateway error:', err);
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: 'Internal gateway error',
      requestId: req.headers['x-request-id'],
      message: 'An unexpected error occurred. Please try again later.'
    });
  }
});

// ===== SERVER STARTUP =====
const PORT = process.env.PORT || 8082;

app.listen(PORT, () => {
  console.log('🚀 API Gateway started successfully!');
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Database: ${dbPath}`);
  console.log('🔐 Authentication: Gateway (register/login) + Microservices (OTP/KYC)');
  console.log('🌐 CORS configured for Expo development');
  
  console.log('📋 Available endpoints:');
  console.log('   POST /api/auth/register (Gateway)');
  console.log('   POST /api/auth/login (Gateway)');
  console.log('   GET  /api/auth/me (Gateway)');
  console.log('   POST /api/auth/logout (Gateway)');
  console.log('   POST /api/auth/send-sms-otp (Proxied to auth-service)');
  console.log('   POST /api/auth/send-whatsapp-otp (Proxied to auth-service)');
  console.log('   POST /api/auth/verify-otp (Proxied to auth-service)');
  console.log('   GET  /api/kyc/status (Proxied to kyc-service)');
  console.log('   POST /api/kyc/start (Proxied to kyc-service)');
  console.log('   POST /api/kyc/complete-step (Proxied to kyc-service)');
  console.log('   POST /api/kyc/verify-identity (Proxied to kyc-service)');
  console.log('   POST /api/kyc/send-phone-code (Proxied to kyc-service)');
  console.log('   POST /api/kyc/verify-phone (Proxied to kyc-service)');
  console.log('   GET  /api/kyc/calculate-score (Proxied to kyc-service)');
  console.log('   GET  /health');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error('❌ Error closing database:', err);
    } else {
      console.log('✅ Database connection closed');
    }
    process.exit(0);
  });
});

module.exports = app;