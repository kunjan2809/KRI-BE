const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/config');

// Middleware to authenticate JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        code: "UNAUTHORIZED",
        message: 'Access token is required' 
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.JWT_SECRET);
    
    // Find user by ID from token
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        code: "UNAUTHORIZED",
        message: 'Invalid token - user not found' 
      });
    }

    // Add user info to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        code: "UNAUTHORIZED",
        message: 'Invalid token' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        code: "UNAUTHORIZED",
        message: 'Token expired' 
      });
    }
    return res.status(500).json({ 
      success: false, 
      code: "INTERNAL_SERVER_ERROR",
      message: 'Token verification failed' 
    });
  }
};

// Middleware to check user role
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        code: "ADMIN_ACCESS_REQUIRED",
        message: 'Authentication required' 
      });
    }

    // If role is 'admin', only admin users can access
    if (role === 'admin' && !req.user.is_admin) {
      return res.status(403).json({ 
        success: false, 
        code: "ADMIN_ACCESS_REQUIRED",
        message: 'Admin access required' 
      });
    }

    // If role is 'user', both regular users and admins can access
    if (role === 'user') {
      return next();
    }

    // For any other role, check if user has that specific role
    if (req.user.is_admin) {
      return next(); // Admin can access everything
    }

    return res.status(403).json({ 
      success: false, 
      code: "ADMIN_ACCESS_REQUIRED",
      message: 'Insufficient permissions' 
    });
  };
};

// Combined middleware for authentication + role check
const auth = (role = 'user') => {
  return [authenticateToken, requireRole(role)];
};

module.exports = {
  authenticateToken,
  requireRole,
  auth
}; 