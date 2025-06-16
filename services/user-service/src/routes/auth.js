const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('firstName').trim().isLength({ min: 2, max: 50 }).escape(),
  body('lastName').trim().isLength({ min: 2, max: 50 }).escape(),
  body('email').isEmail().normalizeEmail(),
  body('phone').matches(/^\+212[0-9]{9}$/),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

// Routes
router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.post('/verify-token', authController.verifyToken);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);

module.exports = router;