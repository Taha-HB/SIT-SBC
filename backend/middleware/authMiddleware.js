const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header or cookie
    let token = req.header('Authorization') || req.cookies.token;
    
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'No authentication token provided'
      });
    }
    
    // Remove Bearer prefix if present
    if (token.startsWith('Bearer ')) {
      token = token.slice(7);
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        status: 'error',
        message: 'Account is inactive or suspended'
      });
    }
    
    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid authentication token',
      error: error.message
    });
  }
};

// Role-based authorization
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: `Role ${req.user.role} is not authorized to access this resource`
      });
    }
    
    next();
  };
};

// Check if user is controller
const isController = (req, res, next) => {
  if (!req.user.isController) {
    return res.status(403).json({
      status: 'error',
      message: 'Controller privileges required'
    });
  }
  next();
};

module.exports = {
  authMiddleware,
  authorizeRoles,
  isController
};
