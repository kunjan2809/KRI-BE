const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');

// Route accessible to both users and admins
router.get('/user-content', auth('user'), (req, res) => {
  res.json({
    success: true,
    message: 'This content is accessible to both users and admins',
    user: req.user
  });
});

// Route accessible only to admins
router.get('/admin-content', auth('admin'), (req, res) => {
  res.json({
    success: true,
    message: 'This content is accessible only to admins',
    user: req.user
  });
});

// Route accessible to both users and admins (explicit)
router.get('/public-content', auth('user'), (req, res) => {
  res.json({
    success: true,
    message: 'This content is accessible to authenticated users',
    user: req.user
  });
});

module.exports = router; 