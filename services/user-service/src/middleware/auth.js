//  UPDATE: services/user-service/src/middleware/auth.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// ✅ NEW: Admin middleware
const requireAdmin = (req, res, next) => {
  if (!req.user.isAdmin()) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// ✅ NEW: Permission middleware
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user.hasPermission(permission) && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: `Permission '${permission}' required`
      });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requirePermission
};

// ========================================
// 5. UPDATE: services/user-service/src/server.js
// ========================================

const express = require('express');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin'); // ✅ NEW

const app = express();

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes); // ✅ NEW

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`✅ User Service running on port ${PORT}`);
});