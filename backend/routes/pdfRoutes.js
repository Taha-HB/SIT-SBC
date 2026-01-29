const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');
const { authMiddleware, authorizeRoles, isController } = require('../middleware/authMiddleware');

// @desc    Generate meeting minutes PDF
// @route   POST /api/pdf/meeting-minutes
// @access  Private/Secretary
router.post('/meeting-minutes', [
  authMiddleware,
  authorizeRoles('Secretary', 'Controller')
], pdfController.generateMeetingMinutes);

// @desc    Generate performance report PDF
// @route   POST /api/pdf/performance-report
// @access  Private/Controller
router.post('/performance-report', [
  authMiddleware,
  isController
], pdfController.generatePerformanceReport);

// @desc    Generate council roster PDF
// @route   GET /api/pdf/council-roster
// @access  Private
router.get('/council-roster', authMiddleware, pdfController.generateCouncilRoster);

// @desc    Generate certificate PDF
// @route   POST /api/pdf/certificate
// @access  Private/Controller
router.post('/certificate', [
  authMiddleware,
  isController
], pdfController.generateCertificate);

// @desc    Generate meeting agenda PDF
// @route   POST /api/pdf/meeting-agenda
// @access  Private/Secretary
router.post('/meeting-agenda', [
  authMiddleware,
  authorizeRoles('Secretary', 'Controller')
], pdfController.generateMeetingAgenda);

// @desc    Get PDF templates
// @route   GET /api/pdf/templates
// @access  Private
router.get('/templates', authMiddleware, async (req, res) => {
  try {
    const templates = [
      {
        id: 'meeting-minutes',
        name: 'Meeting Minutes Template',
        description: 'Official meeting minutes with all sections',
        icon: '📋',
        requires: ['meetingId']
      },
      {
        id: 'performance-report',
        name: 'Performance Report',
        description: 'Detailed performance analysis of council members',
        icon: '📊',
        requires: ['period', 'userIds']
      },
      {
        id: 'council-roster',
        name: 'Council Roster',
        description: 'Complete list of council members with contact info',
        icon: '👥',
        requires: []
      },
      {
        id: 'certificate',
        name: 'Achievement Certificate',
        description: 'Award certificate for outstanding performance',
        icon: '🏆',
        requires: ['userId', 'achievement']
      },
      {
        id: 'meeting-agenda',
        name: 'Meeting Agenda',
        description: 'Pre-meeting agenda document',
        icon: '📅',
        requires: ['meetingId']
      }
    ];
    
    res.status(200).json({
      status: 'success',
      data: templates
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch PDF templates',
      error: error.message
    });
  }
});

// @desc    Download PDF by ID
// @route   GET /api/pdf/download/:id
// @access  Private
router.get('/download/:id', authMiddleware, async (req, res) => {
  try {
    // This endpoint would typically serve already generated PDFs
    // For now, it's a placeholder
    res.status(200).json({
      status: 'success',
      message: 'PDF download endpoint',
      note: 'This endpoint would serve generated PDF files'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to download PDF',
      error: error.message
    });
  }
});

module.exports = router;
