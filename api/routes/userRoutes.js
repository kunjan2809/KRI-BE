const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { auth } = require('../middlewares/auth');

// All user management routes require admin authentication
router.use(auth('admin'));

// 1. Get All Users with Order Statistics
// GET /api/users/admin/all?page=1&limit=20&search=john&status_filter=active
router.get('/admin/all', userController.getAllUsers);

// 2. Change User Status
// PATCH /api/users/admin/status/:userId
router.patch('/admin/status/:userId', userController.changeUserStatus);

module.exports = router; 