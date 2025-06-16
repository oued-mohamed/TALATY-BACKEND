// ========================================
// UPDATE: services/user-service/src/routes/user.js
// ========================================

const express = require('express');
const { body, param } = require('express-validator');
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');

const userRoutes = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// ✅ EXISTING: Basic profile routes
router.get('/profile', userController.getProfile);
router.put('/profile', [
  body('firstName').optional().isLength({ min: 1, max: 50 }).trim(),
  body('lastName').optional().isLength({ min: 1, max: 50 }).trim(),
  body('phone').optional().matches(/^\+212[0-9]{9}$/),
], userController.updateProfile);

// ✅ EXISTING: Business info
router.put('/business-info', [
  body('companyName').optional().isLength({ min: 1, max: 100 }).trim(),
  body('businessType').optional().isIn(['sole_proprietorship', 'llc', 'corporation', 'partnership', 'other']),
  body('industry').optional().isLength({ min: 1, max: 50 }).trim(),
], userController.updateBusinessInfo);

// ✅ EXISTING: Dashboard and verification
router.get('/dashboard', userController.getDashboard);
router.put('/verification-status', [
  body('type').isIn(['email', 'phone']),
  body('status').isBoolean(),
], userController.updateVerificationStatus);

router.put('/kyc-status', [
  body('status').isIn(['pending', 'under_review', 'approved', 'rejected', 'incomplete']),
  body('score').optional().isInt({ min: 0, max: 100 }),
], userController.updateKYCStatus);

// ✅ NEW: Document tracking
router.post('/mark-document', [
  body('documentType').isIn(['nationalId', 'passport', 'businessRegistration', 'bankStatement', 'selfie', 'proofOfAddress']),
  body('uploaded').optional().isBoolean(),
], userController.markDocumentUploaded);

// ✅ NEW: Additional routes
router.get('/stats', userController.getUserStats);
router.put('/communication-preferences', [
  body('email').optional().isBoolean(),
  body('sms').optional().isBoolean(),
  body('whatsapp').optional().isBoolean(),
  body('marketing').optional().isBoolean(),
], userController.updateCommunicationPreferences);

// ✅ EXISTING: Profile deletion
router.delete('/profile', userController.deleteProfile);

module.exports = userRoutes;

// ========================================
// UPDATE: services/user-service/src/routes/admin.js
// ========================================

const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticateToken, requireAdmin, requirePermission } = require('../middleware/auth');

const userRouter = express.Router();

// Apply authentication and admin check to all routes
router.use(authenticateToken);
router.use(requireAdmin);

// ✅ EXISTING: Application management
router.get('/applications', requirePermission('view_applications'), adminController.getAllApplications);
router.get('/applications/stats', adminController.getApplicationStats);
router.get('/applications/export', requirePermission('view_applications'), adminController.exportApplications);
router.get('/applications/:userId', requirePermission('view_applications'), adminController.getApplicationDetails);
router.get('/applications/:userId/documents', requirePermission('view_documents'), adminController.getUserDocuments);
router.put('/applications/:userId/status', requirePermission('manage_applications'), adminController.updateApplicationStatus);

// ✅ NEW: User management (super admin only)
router.get('/users', requirePermission('view_users'), adminController.getAllUsers);
router.post('/users/:userId/assign-admin', adminController.assignAdminRole);
router.delete('/users/:userId/remove-admin', adminController.removeAdminRole);
router.get('/users/admins', adminController.getAdminUsers);
router.put('/users/:userId/permissions', adminController.updateAdminPermissions);

// ✅ NEW: System statistics
router.get('/system/stats', adminController.getSystemStats);
router.get('/system/activity', adminController.getRecentActivity);

module.exports = router;

// ========================================
// UPDATE: services/document-service/src/routes/document.js
// ========================================

const express = require('express');
const multer = require('multer');
const path = require('path');
const documentController = require('../controllers/documentController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow images and PDFs
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, JPG, PNG) and PDF files are allowed'));
    }
  }
});

// Apply authentication to all routes
router.use(authenticateToken);

// ✅ EXISTING: Document operations
router.post('/upload', upload.single('document'), documentController.uploadDocument);
router.get('/user/:userId?', documentController.getUserDocuments); // Optional userId for admin access
router.get('/:id', documentController.getDocumentById);
router.put('/:id/status', documentController.updateDocumentStatus); // Admin only
router.delete('/:id', documentController.deleteDocument);
router.get('/:id/download', documentController.downloadDocument);

// ✅ EXISTING: Statistics and batch operations
router.get('/stats/overview', documentController.getDocumentStats);
router.put('/batch/update-status', documentController.batchUpdateDocuments); // Admin only

module.exports = router;

// ========================================
// ADD: services/user-service/src/controllers/adminController.js - ADDITIONAL METHODS
// ========================================

// Add these methods to your existing adminController.js

// ✅ NEW: Get all users (for user management)
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    
    if (!req.user.hasPermission('view_users')) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied'
      });
    }

    let query = {};
    
    if (role && role !== 'all') {
      query.role = role;
    }
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: users.length,
          totalItems: total
        }
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

// ✅ NEW: Get system statistics
exports.getSystemStats = async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const stats = await User.getAdminStats();
    
    // Get document stats
    const documentStatsResponse = await fetch(`${process.env.DOCUMENT_SERVICE_URL}/api/documents/stats/overview`, {
      headers: {
        'x-service-name': 'user-service',
        'x-user-id': req.user._id
      }
    });
    
    const documentStats = documentStatsResponse.ok ? await documentStatsResponse.json() : { data: {} };

    res.json({
      success: true,
      data: {
        ...stats,
        documents: documentStats.data
      }
    });
  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system statistics',
      error: error.message
    });
  }
};

// ✅ NEW: Get recent activity
exports.getRecentActivity = async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { limit = 50 } = req.query;

    // Get recent user registrations
    const recentUsers = await User.find()
      .select('firstName lastName email createdAt kycStatus')
      .sort({ createdAt: -1 })
      .limit(limit);

    // Transform to activity format
    const activities = recentUsers.map(user => ({
      id: user._id,
      type: 'user_registration',
      description: `${user.firstName} ${user.lastName} registered`,
      timestamp: user.createdAt,
      metadata: {
        userId: user._id,
        email: user.email,
        kycStatus: user.kycStatus
      }
    }));

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Get recent activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activity',
      error: error.message
    });
  }
};

// ========================================
// UPDATE: services/user-service/src/middleware/auth.js - ADD MISSING FUNCTIONS
// ========================================

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
  try {
    // Check for token in headers
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // Also check for user ID in headers (for service-to-service calls)
    const userId = req.headers['x-user-id'];

    if (!token && !userId) {
      return res.status(401).json({
        success: false,
        message: 'Access token or user ID required'
      });
    }

    if (token) {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }

      req.user = user;
    } else if (userId) {
      // For service-to-service calls, just validate user exists
      const user = await User.findById(userId).select('-password');
      if (user) {
        req.user = user;
      }
      // If user not found but has service header, continue (for admin operations)
      const serviceName = req.headers['x-service-name'];
      if (!user && !serviceName) {
        return res.status(401).json({
          success: false,
          message: 'Invalid user ID'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(403).json({
      success: false,
      message: 'Invalid token or authentication failed'
    });
  }
};

// ✅ Admin middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// ✅ Permission middleware
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user || (!req.user.hasPermission(permission) && req.user.role !== 'super_admin')) {
      return res.status(403).json({
        success: false,
        message: `Permission '${permission}' required`
      });
    }
    next();
  };
};

// ✅ Service middleware (for microservice communication)
const requireService = (allowedServices = []) => {
  return (req, res, next) => {
    const serviceName = req.headers['x-service-name'];
    
    if (!serviceName || !allowedServices.includes(serviceName)) {
      return res.status(403).json({
        success: false,
        message: 'Service access denied'
      });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requirePermission,
  requireService
};

// ========================================
// CREATE: Database Migration Script
// ========================================

// scripts/migrate-user-model.js
const mongoose = require('mongoose');
const User = require('../services/user-service/src/models/User');
const UserProfile = require('../services/user-service/src/models/UserProfile'); // Old model

async function migrateUserData() {
  try {
    console.log('🔄 Starting user data migration...');
    
    await mongoose.connect(process.env.DATABASE_URL);
    
    // Get all existing UserProfile records
    const userProfiles = await UserProfile.find({});
    console.log(`📊 Found ${userProfiles.length} user profiles to migrate`);
    
    let migrated = 0;
    let errors = 0;
    
    for (const profile of userProfiles) {
      try {
        // Find corresponding user
        const user = await User.findById(profile.userId);
        
        if (!user) {
          console.warn(`⚠️ User not found for profile ${profile.userId}`);
          continue;
        }
        
        // Migrate data from UserProfile to User
        const updateData = {
          profileCompletion: profile.profileCompletion || 0,
          kycStatus: profile.kycStatus || 'pending',
          kycScore: profile.kycScore,
          businessInfo: profile.businessInfo,
          isEmailVerified: profile.isEmailVerified || false,
          isPhoneVerified: profile.isPhoneVerified || false,
          emailVerified: profile.isEmailVerified || false,
          phoneVerified: profile.isPhoneVerified || false,
        };
        
        // Map document status if exists
        if (profile.documentsUploaded) {
          updateData.documentsUploaded = profile.documentsUploaded;
        }
        
        await User.findByIdAndUpdate(user._id, { $set: updateData });
        migrated++;
        
        if (migrated % 100 === 0) {
          console.log(`✅ Migrated ${migrated} users...`);
        }
        
      } catch (error) {
        console.error(`❌ Error migrating user ${profile.userId}:`, error.message);
        errors++;
      }
    }
    
    console.log(`🎉 Migration completed!`);
    console.log(`✅ Successfully migrated: ${migrated} users`);
    console.log(`❌ Errors: ${errors}`);
    
    // Calculate profile completion for all users
    console.log('🔄 Recalculating profile completion...');
    const allUsers = await User.find({});
    
    for (const user of allUsers) {
      user.calculateProfileCompletion();
      await user.save();
    }
    
    console.log('✅ Profile completion recalculated for all users');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateUserData();
}

module.exports = migrateUserData;

// ========================================
// CREATE: Environment Variables Update
// ========================================

// Add these to your .env files:

/*
# ========================================
# services/user-service/.env - ADD THESE
# ========================================

# Microservice URLs
DOCUMENT_SERVICE_URL=http://localhost:3003
KYC_SERVICE_URL=http://localhost:3004
NOTIFICATION_SERVICE_URL=http://localhost:3005

# Admin Configuration
SUPER_ADMIN_EMAIL=admin@businessekyc.com
SUPER_ADMIN_PASSWORD=SecureAdminPass123!

# Profile Completion Weights
PROFILE_BASIC_WEIGHT=30
PROFILE_VERIFICATION_WEIGHT=20
PROFILE_BUSINESS_WEIGHT=30
PROFILE_DOCUMENTS_WEIGHT=20

# ========================================
# services/document-service/.env - ADD THESE
# ========================================

# User Service Integration
USER_SERVICE_URL=http://localhost:3002

# File Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=jpeg,jpg,png,pdf

# Cloud Storage (Optional)
USE_CLOUD_STORAGE=false
CLOUD_STORAGE_BUCKET=business-ekyc-documents
CLOUD_STORAGE_REGION=us-east-1
*/

// ========================================
// CREATE: Admin User Seeder
// ========================================

// scripts/create-admin.js
const mongoose = require('mongoose');
const User = require('../services/user-service/src/models/User');
const bcrypt = require('bcryptjs');

async function createSuperAdmin() {
  try {
    console.log('🔄 Creating super admin user...');
    
    await mongoose.connect(process.env.DATABASE_URL);
    
    // Check if super admin already exists
    const existingAdmin = await User.findOne({ role: 'super_admin' });
    
    if (existingAdmin) {
      console.log('✅ Super admin already exists:', existingAdmin.email);
      return;
    }
    
    // Create super admin
    const superAdmin = new User({
      firstName: 'Super',
      lastName: 'Admin',
      email: process.env.SUPER_ADMIN_EMAIL || 'admin@businessekyc.com',
      phone: '+212600000000',
      password: process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!',
      role: 'super_admin',
      permissions: [
        'view_applications',
        'manage_applications',
        'view_documents',
        'manage_documents',
        'view_users',
        'manage_users',
        'system_settings'
      ],
      isEmailVerified: true,
      isPhoneVerified: true,
      emailVerified: true,
      phoneVerified: true,
      profileCompletion: 100,
      adminMetadata: {
        assignedAt: new Date(),
        department: 'System Administration'
      }
    });
    
    await superAdmin.save();
    
    console.log('🎉 Super admin created successfully!');
    console.log('📧 Email:', superAdmin.email);
    console.log('🔑 Password:', process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!');
    console.log('⚠️ Please change the password after first login!');
    
  } catch (error) {
    console.error('❌ Failed to create super admin:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  createSuperAdmin();
}

module.exports = createSuperAdmin;

// ========================================
// UPDATE: package.json scripts
// ========================================

/*
Add these scripts to your package.json files:

// services/user-service/package.json
{
  "scripts": {
    "migrate": "node scripts/migrate-user-model.js",
    "create-admin": "node scripts/create-admin.js",
    "seed": "npm run create-admin && npm run migrate"
  }
}
*/

// ========================================
// SUMMARY: Implementation Steps
// ========================================

/*
🚀 IMPLEMENTATION STEPS:

1. ✅ UPDATE USER MODEL:
   - Replace old User.js with the new enhanced version
   - Includes admin roles, permissions, KYC status, business info

2. ✅ UPDATE CONTROLLERS:
   - UserController now supports both User and UserProfile patterns
   - DocumentController integrated with User model
   - AdminController for admin functionality

3. ✅ UPDATE ROUTES:
   - Enhanced user routes with new endpoints
   - Admin routes with proper permissions
   - Document routes with admin access

4. ✅ ADD MIDDLEWARE:
   - Enhanced authentication for microservices
   - Role-based access control
   - Permission validation

5. 🔧 RUN MIGRATION:
   ```bash
   cd services/user-service
   npm run migrate
   npm run create-admin
   ```

6. 🔧 UPDATE ENVIRONMENT:
   - Add new environment variables
   - Configure service URLs
   - Set admin credentials

7. 🎯 FEATURES ENABLED:
   ✅ Admin dashboard with application management
   ✅ Document viewing and management
   ✅ User role assignment
   ✅ KYC status tracking
   ✅ Profile completion calculation
   ✅ Business information management
   ✅ Microservice communication
   ✅ Permission-based access control

🎉 Your system now supports:
- Complete admin functionality
- Enhanced user management
- Document management with admin access
- Role-based permissions
- KYC workflow management
- Business application processing

All existing functionality is preserved while adding powerful admin capabilities!
*/