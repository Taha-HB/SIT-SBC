const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const moment = require('moment');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Generate avatar initials
const generateAvatar = (name) => {
  const names = name.split(' ');
  return names.map(n => n[0]).join('').toUpperCase();
};

// Generate random color for avatar
const generateAvatarColor = () => {
  const colors = [
    '#0066CC', // SIT Blue
    '#009999', // SIT Teal
    '#FF6600', // SIT Orange
    '#003366', // SIT Dark Blue
    '#9933CC', // Purple
    '#00C853', // Green
    '#FF9800', // Orange
    '#2196F3', // Blue
    '#F44336', // Red
    '#9C27B0'  // Purple
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Format date
const formatDate = (date, format = 'MMMM DD, YYYY') => {
  return moment(date).format(format);
};

// Format time
const formatTime = (time) => {
  return moment(time, 'HH:mm').format('h:mm A');
};

// Calculate time ago
const timeAgo = (date) => {
  return moment(date).fromNow();
};

// Generate meeting ID
const generateMeetingId = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `SC-${year}-${month}-${day}-${random}`;
};

// Validate email
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate SIT email
const isValidSITEmail = (email) => {
  return email.endsWith('@sit.edu');
};

// Validate Student ID
const isValidStudentId = (studentId) => {
  const pattern = /^SIT-ST-2029-00\d{3}$/;
  return pattern.test(studentId);
};

// Generate random password
const generateRandomPassword = (length = 12) => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

// Calculate performance score
const calculatePerformanceScore = (user) => {
  const attendanceWeight = 0.4;
  const taskWeight = 0.4;
  const participationWeight = 0.2;
  
  const attendanceScore = user.performance.attendanceRate || 0;
  const taskScore = user.performance.completionRate || 0;
  const participationScore = user.performance.averageScore || 0;
  
  return Math.round(
    (attendanceScore * attendanceWeight) +
    (taskScore * taskWeight) +
    (participationScore * participationWeight)
  );
};

// Sanitize user input
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>"'`;]/g, '') // Remove dangerous characters
    .trim();
};

// Parse query parameters
const parseQueryParams = (query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  const skip = (page - 1) * limit;
  
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
  
  return { page, limit, skip, sortBy, sortOrder };
};

module.exports = {
  generateToken,
  generateAvatar,
  generateAvatarColor,
  formatDate,
  formatTime,
  timeAgo,
  generateMeetingId,
  isValidEmail,
  isValidSITEmail,
  isValidStudentId,
  generateRandomPassword,
  calculatePerformanceScore,
  sanitizeInput,
  parseQueryParams
};
