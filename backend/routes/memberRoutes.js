const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const memberController = require('../controllers/memberController');
const { authMiddleware, authorizeRoles, isController } = require('../middleware/authMiddleware');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/avatars/';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// @desc    Get all members
// @route   GET /api/members
// @access  Private
router.get('/', authMiddleware, memberController.getAllMembers);

// @desc    Get single member
// @route   GET /api/members/:id
// @access  Private
router.get('/:id', authMiddleware, memberController.getMember);

// @desc    Create new member
// @route   POST /api/members
// @access  Private/Controller
router.post('/', [authMiddleware, isController], memberController.createMember);

// @desc    Update member
// @route   PUT /api/members/:id
// @access  Private/Controller
router.put('/:id', [authMiddleware, isController], memberController.updateMember);

// @desc    Delete member (deactivate)
// @route   DELETE /api/members/:id
// @access  Private/Controller
router.delete('/:id', [authMiddleware, isController], memberController.deleteMember);

// @desc    Upload member avatar
// @route   POST /api/members/:id/avatar
// @access  Private
router.post('/:id/avatar', [
  authMiddleware,
  upload.single('avatar')
], memberController.uploadAvatar);

// @desc    Update member performance
// @route   PUT /api/members/:id/performance
// @access  Private/Secretary
router.put('/:id/performance', [
  authMiddleware,
  authorizeRoles('Secretary', 'President', 'Controller')
], memberController.updatePerformance);

// @desc    Get member statistics
// @route   GET /api/members/stats
// @access  Private
router.get('/stats', authMiddleware, memberController.getMemberStats);

// @desc    Get top performers
// @route   GET /api/members/top-performers
// @access  Private
router.get('/top-performers', authMiddleware, memberController.getTopPerformers);

// @desc    Get member attendance
// @route   GET /api/members/:id/attendance
// @access  Private
router.get('/:id/attendance', authMiddleware, memberController.getMemberAttendance);

// @desc    Get member tasks
// @route   GET /api/members/:id/tasks
// @access  Private
router.get('/:id/tasks', authMiddleware, memberController.getMemberTasks);

// @desc    Export members data
// @route   GET /api/members/export
// @access  Private/Controller
router.get('/export', [authMiddleware, isController], async (req, res) => {
  try {
    const members = await User.find({ status: 'active' })
      .select('-password')
      .populate({
        path: 'performance',
        select: 'metrics points'
      })
      .sort({ role: 1, name: 1 });
    
    // Format data for export
    const exportData = members.map(member => ({
      studentId: member.studentId,
      name: member.name,
      email: member.email,
      role: member.role,
      position: member.position,
      department: member.department,
      phone: member.phone,
      joinDate: member.joinDate,
      status: member.status,
      performance: member.performance || {
        meetingsAttended: 0,
        tasksCompleted: 0,
        rating: 0,
        points: 0
      }
    }));
    
    res.status(200).json({
      status: 'success',
      count: exportData.length,
      data: exportData,
      exportedAt: new Date().toISOString(),
      exportedBy: req.user.name
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to export members data',
      error: error.message
    });
  }
});

// @desc    Import members data
// @route   POST /api/members/import
// @access  Private/Controller
router.post('/import', [authMiddleware, isController], async (req, res) => {
  try {
    const { members } = req.body;
    
    if (!members || !Array.isArray(members)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid members data format'
      });
    }
    
    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: []
    };
    
    // Process each member
    for (const memberData of members) {
      try {
        const existingMember = await User.findOne({
          $or: [
            { studentId: memberData.studentId },
            { email: memberData.email }
          ]
        });
        
        if (existingMember) {
          // Update existing member
          Object.assign(existingMember, memberData);
          await existingMember.save();
          results.updated++;
        } else {
          // Create new member
          await User.create({
            ...memberData,
            avatar: memberData.name.substring(0, 2).toUpperCase(),
            avatarColor: '#0066CC',
            password: 'TempPassword123!',
            status: 'active'
          });
          results.created++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          member: memberData.name || 'Unknown',
          error: error.message
        });
      }
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Members imported successfully',
      data: results
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to import members',
      error: error.message
    });
  }
});

module.exports = router;
