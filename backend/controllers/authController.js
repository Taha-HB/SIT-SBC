const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/emailService');
const { validationResult } = require('express-validator');

// Generate JWT Token
const generateToken = (id, role, studentId) => {
  return jwt.sign(
    { id, role, studentId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

// @desc    Register user (Controller only)
// @route   POST /api/auth/register
// @access  Private/Controller
exports.registerUser = async (req, res, next) => {
  try {
    // Check if user is controller
    if (!req.user.isController) {
      return res.status(403).json({
        success: false,
        message: 'Only controllers can register new users'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      studentId,
      name,
      email,
      password,
      role,
      position,
      department,
      phone
    } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ 
      $or: [{ email }, { studentId }] 
    });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email or student ID'
      });
    }

    // Create user
    const user = await User.create({
      studentId,
      name,
      email,
      password,
      role,
      position,
      department,
      phone,
      avatarColor: getRandomColor(),
      createdBy: req.user.id
    });

    // Generate token
    const token = generateToken(user._id, user.role, user.studentId);

    // Set cookie
    res.cookie('token', token, {
      expires: new Date(
        Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
      ),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        studentId: user.studentId,
        name: user.name,
        email: user.email,
        role: user.role,
        position: user.position,
        department: user.department,
        avatar: user.avatar,
        avatarColor: user.avatarColor
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password, studentId } = req.body;

    // Validate email format
    if (!email.match(/^[a-zA-Z0-9._%+-]+@sit\.edu$/)) {
      return res.status(400).json({
        success: false,
        message: 'Please use your SIT email address'
      });
    }

    // Validate student ID format
    if (!studentId.match(/^SIT-ST-202[0-9]-00\d{3}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Student ID format. Use: SIT-ST-2029-00XXX'
      });
    }

    // Check for controller emails
    const controllerEmails = [
      'xaahaa12@gmail.com',
      'tahir.h.bedane@gmail.com',
      'tahirhasan432@gmail.com'
    ];

    let user;
    
    if (controllerEmails.includes(email)) {
      // Controller login (bypass password check for demo)
      user = await User.findOneAndUpdate(
        { email, studentId: 'CONTROLLER' },
        {
          $setOnInsert: {
            name: 'System Controller',
            role: 'Controller',
            position: 'System Administrator',
            department: 'Administration',
            isController: true,
            avatar: 'CT',
            avatarColor: '#FF6600'
          }
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      );
      
      // Set default password for new controller
      if (user.password === undefined) {
        user.password = 'controller123';
        await user.save();
      }
    } else {
      // Regular user login
      user = await User.findOne({ email, studentId }).select('+password');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials. Contact controller for access.'
        });
      }

      // Check if password matches
      const isPasswordMatch = await user.matchPassword(password);
      
      if (!isPasswordMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if user is active
      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Your account has been suspended. Please contact administrator.'
        });
      }
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id, user.role, user.studentId);

    // Set cookie
    res.cookie('token', token, {
      expires: new Date(
        Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
      ),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        studentId: user.studentId,
        name: user.name,
        email: user.email,
        role: user.role,
        position: user.position,
        department: user.department,
        avatar: user.avatar,
        avatarColor: user.avatarColor,
        isController: user.isController,
        preferences: user.preferences
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   GET /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  try {
    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        studentId: user.studentId,
        name: user.name,
        email: user.email,
        role: user.role,
        position: user.position,
        department: user.department,
        phone: user.phone,
        avatar: user.avatar,
        avatarUrl: user.avatarUrl,
        avatarColor: user.avatarColor,
        status: user.status,
        joinDate: user.joinDate,
        lastLogin: user.lastLogin,
        performance: user.performance,
        preferences: user.preferences,
        isController: user.isController,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/update-profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, preferences } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (preferences) updateData.preferences = preferences;

    // Handle avatar upload
    if (req.file) {
      // In production, upload to Cloudinary/S3
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      updateData.avatarUrl = avatarUrl;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        avatarUrl: user.avatarUrl,
        avatarColor: user.avatarColor,
        phone: user.phone,
        preferences: user.preferences
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Generate new token
    const token = generateToken(user._id, user.role, user.studentId);

    res.status(200).json({
      success: true,
      token,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this email'
      });
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;

    // Create email message
    const message = `
      You are receiving this email because you (or someone else) has requested a password reset.
      Please make a PUT request to: \n\n ${resetUrl}
      
      If you did not request this, please ignore this email.
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Reset Request',
        message
      });

      res.status(200).json({
        success: true,
        message: 'Email sent with password reset instructions'
      });
    } catch (error) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        success: false,
        message: 'Email could not be sent'
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:resettoken
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Generate token
    const token = generateToken(user._id, user.role, user.studentId);

    res.status(200).json({
      success: true,
      token,
      message: 'Password reset successful'
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to generate random color
function getRandomColor() {
  const colors = [
    '#0066CC', '#009999', '#FF6600', '#9933CC', '#00C853',
    '#FF9800', '#2196F3', '#9C27B0', '#3F51B5', '#009688'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
