const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middlewares/auth');

// Public routes (no authentication required)
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/forget-password', authController.forgetPassword);
router.post('/reset-password', authController.resetPassword);

// Protected routes (authentication required)
router.get('/profile', auth('user'), authController.getProfile);
router.get('/me', auth('user'), authController.getMe);
router.patch('/profile', auth('user'), authController.updateProfile);

module.exports = router; 