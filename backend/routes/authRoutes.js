const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/authMiddleware');
const { generateToken } = require('../utils/helpers');

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
  body('studentId').notEmpty().withMessage('Student ID is required')
], async (req, res) => {
  try {
    const { email, password, studentId } = req.body;
    
    // Check controller emails
    const controllerEmails = process.env.CONTROLLER_EMAILS?.split(',') || [];
    const isControllerEmail = controllerEmails.includes(email);
    
    // Find user
    let user;
    if (isControllerEmail) {
      // For controller login (no student ID validation)
      user = await User.findOne({ email, isController: true });
    } else {
      // For regular members
      user = await User.findOne({ 
        email, 
        studentId 
      }).select('+password');
    }
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }
    
    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }
    
    // Check user status
    if (user.status !== 'active') {
      return res.status(403).json({
        status: 'error',
        message: 'Account is inactive or suspended'
      });
    }
    
    // Update last login
    user.lastLogin = new Date();
    user.loginCount += 1;
    await user.save();
    
    // Generate token
    const token = generateToken(user._id);
    
    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          studentId: user.studentId,
          role: user.role,
          position: user.position,
          department: user.department,
          avatar: user.avatar,
          avatarColor: user.avatarColor,
          isController: user.isController,
          preferences: user.preferences
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Login failed',
      error: error.message
    });
  }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', authMiddleware, (req, res) => {
  res.clearCookie('token');
  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully'
  });
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    res.status(200).json({
      status: 'success',
      data: user
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user data',
      error: error.message
    });
  }
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, phone, preferences } = req.body;
    
    const updates = {};
    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (preferences) updates.preferences = { ...req.user.preferences, ...preferences };
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true }
    ).select('-password');
    
    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: user
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update profile',
      error: error.message
    });
  }
});

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
router.put('/change-password', authMiddleware, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
], async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Get user with password
    const user = await User.findById(req.user._id).select('+password');
    
    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Current password is incorrect'
      });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Password changed successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to change password',
      error: error.message
    });
  }
});

// @desc    Request password reset
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('studentId').notEmpty().withMessage('Student ID is required')
], async (req, res) => {
  try {
    const { email, studentId } = req.body;
    
    const user = await User.findOne({ email, studentId });
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found with provided credentials'
      });
    }
    
    // In production, you would send an email with reset link
    // For now, we'll just return success
    
    res.status(200).json({
      status: 'success',
      message: 'Password reset instructions have been sent to your email'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to process password reset request',
      error: error.message
    });
  }
});

// @desc    Verify token
// @route   GET /api/auth/verify
// @access  Private
router.get('/verify', authMiddleware, (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Token is valid',
    data: {
      user: req.user
    }
  });
});

module.exports = router;
