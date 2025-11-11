const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../services/emailService');
const config = require('../config/config');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: '7d' });
};

// User Registration
const signup = async (req, res) => {
  try {
    const { first_name, last_name, email, mobile_number, password, profile_icon } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Check if mobile number already exists (if provided)
    if (mobile_number) {
      const existingMobile = await User.findOne({ mobile_number });
      if (existingMobile) {
        return res.status(400).json({
          success: false,
          message: 'User with this mobile number already exists'
        });
      }
    }

    // Create new user
    const user = new User({
      first_name,
      last_name,
      email,
      mobile_number,
      password,
      profile_icon
    });

    await user.save();

    // Send welcome email (optional)
    try {
      await sendWelcomeEmail(email, first_name);
    } catch (emailError) {
      console.log('Welcome email failed to send:', emailError.message);
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          mobile_number: user.mobile_number,
          profile_icon: user.profile_icon,
          status: user.status,
          is_admin: user.is_admin,
          full_name: user.full_name
        },
        token
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user account'
    });
  }
};

// User Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          mobile_number: user.mobile_number,
          profile_icon: user.profile_icon,
          is_admin: user.is_admin,
          full_name: user.full_name
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login'
    });
  }
};

// Forget Password
const forgetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save reset token to user
    user.reset_token = resetToken;
    user.reset_token_expires = resetTokenExpires;
    await user.save();

    // Send reset email
    const resetUrl = `${config.FRONTEND_URL}/reset-password`;
    const emailSent = await sendPasswordResetEmail(email, resetToken, resetUrl);

    if (emailSent) {
      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error sending password reset email'
      });
    }
  } catch (error) {
    console.error('Forget password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing password reset request'
    });
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  try {
    const { token, new_password } = req.body;

    if (!token || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Find user by reset token
    const user = await User.findOne({
      reset_token: token,
      reset_token_expires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Update password and clear reset token
    user.password = new_password;
    user.reset_token = null;
    user.reset_token_expires = null;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password'
    });
  }
};

// Get Current User Profile
const getProfile = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile'
    });
  }
};

// Get Current User Data (/me endpoint)
const getMe = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user data'
    });
  }
};

// Update User Profile (User can edit their own profile)
const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { first_name, last_name, mobile_number, profile_icon } = req.body;

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate and update first_name
    if (first_name !== undefined) {
      if (!first_name || first_name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'First name cannot be empty'
        });
      }
      if (first_name.trim().length > 50) {
        return res.status(400).json({
          success: false,
          message: 'First name cannot exceed 50 characters'
        });
      }
      user.first_name = first_name.trim();
    }

    // Validate and update last_name
    if (last_name !== undefined) {
      if (!last_name || last_name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Last name cannot be empty'
        });
      }
      if (last_name.trim().length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Last name cannot exceed 50 characters'
        });
      }
      user.last_name = last_name.trim();
    }

    // Validate and update mobile_number
    if (mobile_number !== undefined) {
      // Allow null/empty string to clear mobile number
      if (mobile_number === null || mobile_number === '') {
        user.mobile_number = null;
      } else {
        // Validate mobile number format
        const mobileRegex = /^[+]?[\d\s\-\(\)]+$/;
        if (!mobileRegex.test(mobile_number)) {
          return res.status(400).json({
            success: false,
            message: 'Please enter a valid mobile number'
          });
        }
        if (mobile_number.length > 15) {
          return res.status(400).json({
            success: false,
            message: 'Mobile number cannot exceed 15 characters'
          });
        }
        
        // Check if mobile number is already taken by another user
        const existingUser = await User.findOne({
          mobile_number: mobile_number,
          _id: { $ne: userId }
        });
        
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'Mobile number is already registered to another account'
          });
        }
        
        user.mobile_number = mobile_number;
      }
    }

    // Validate and update profile_icon
    if (profile_icon !== undefined) {
      // Allow null/empty string to clear profile icon
      if (profile_icon === null || profile_icon === '') {
        user.profile_icon = null;
      } else {
        if (profile_icon.length > 500) {
          return res.status(400).json({
            success: false,
            message: 'Profile icon URL cannot exceed 500 characters'
          });
        }
        user.profile_icon = profile_icon.trim();
      }
    }

    // Save the updated user
    await user.save();

    // Fetch the updated user (to get virtual fields like full_name)
    const updatedUser = await User.findById(userId).select('-password -reset_token -reset_token_expires');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: updatedUser
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    
    // Handle duplicate key error (for mobile_number)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is already registered to another account'
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: errors[0] || 'Validation error'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
};

// Change Password (requires authentication)
const changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { old_password, new_password } = req.body;

    // Validate input
    if (!old_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Old password and new password are required'
      });
    }

    // Validate new password length
    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Find the user (need to fetch with password to compare)
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify old password
    const isOldPasswordValid = await user.comparePassword(old_password);
    if (!isOldPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Old password is incorrect'
      });
    }

    // Check if new password is different from old password
    const isSamePassword = await user.comparePassword(new_password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from the old password'
      });
    }

    // Update password (the pre-save middleware will hash it automatically)
    user.password = new_password;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password'
    });
  }
};

module.exports = {
  signup,
  login,
  forgetPassword,
  resetPassword,
  getProfile,
  getMe,
  updateProfile,
  changePassword
}; 