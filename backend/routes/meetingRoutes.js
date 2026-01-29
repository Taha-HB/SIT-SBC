const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const { authMiddleware, authorizeRoles, isController } = require('../middleware/authMiddleware');
const { sendMeetingInvitation, sendMeetingMinutes } = require('../utils/emailService');
const { generateMeetingId } = require('../utils/helpers');

// @desc    Get all meetings
// @route   GET /api/meetings
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, type, archived, search, startDate, endDate } = req.query;
    
    // Build filter
    const filter = {};
    
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (archived !== undefined) filter.archived = archived === 'true';
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { meetingId: { $regex: search, $options: 'i' } },
        { venue: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Date range filter
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    
    // Get meetings
    const meetings = await Meeting.find(filter)
      .populate('chairperson', 'name role avatar')
      .populate('minutesTaker', 'name role')
      .populate('attendees.user', 'name role avatar')
      .populate('minutes.actionItems.assignee', 'name role')
      .sort({ date: -1, createdAt: -1 });
    
    res.status(200).json({
      status: 'success',
      count: meetings.length,
      data: meetings
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch meetings',
      error: error.message
    });
  }
});

// @desc    Get single meeting
// @route   GET /api/meetings/:id
// @access  Private
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('chairperson', 'name role avatar email phone')
      .populate('minutesTaker', 'name role avatar')
      .populate('attendees.user', 'name role avatar email phone')
      .populate('minutes.actionItems.assignee', 'name role avatar');
    
    if (!meeting) {
      return res.status(404).json({
        status: 'error',
        message: 'Meeting not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: meeting
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch meeting',
      error: error.message
    });
  }
});

// @desc    Create new meeting
// @route   POST /api/meetings
// @access  Private/Secretary
router.post('/', [
  authMiddleware,
  authorizeRoles('Secretary', 'President', 'Controller')
], [
  body('title').notEmpty().withMessage('Meeting title is required'),
  body('date').notEmpty().withMessage('Meeting date is required'),
  body('startTime').notEmpty().withMessage('Start time is required'),
  body('endTime').notEmpty().withMessage('End time is required'),
  body('venue').notEmpty().withMessage('Venue is required'),
  body('chairperson').notEmpty().withMessage('Chairperson is required')
], async (req, res) => {
  try {
    const {
      title,
      type = 'regular',
      date,
      startTime,
      endTime,
      venue,
      chairperson,
      minutesTaker = req.user._id,
      objective,
      agenda = [],
      attendees = []
    } = req.body;
    
    // Generate meeting ID
    const meetingId = generateMeetingId();
    
    // Create meeting
    const meeting = await Meeting.create({
      meetingId,
      title,
      type,
      date,
      startTime,
      endTime,
      venue,
      chairperson,
      minutesTaker,
      objective,
      agenda,
      attendees: attendees.map(attendee => ({
        user: attendee.userId,
        status: attendee.status || 'present',
        time: attendee.time || startTime,
        notes: attendee.notes
      })),
      status: 'scheduled'
    });
    
    // Populate for response
    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate('chairperson', 'name role')
      .populate('minutesTaker', 'name role')
      .populate('attendees.user', 'name role email');
    
    res.status(201).json({
      status: 'success',
      message: 'Meeting created successfully',
      data: populatedMeeting
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to create meeting',
      error: error.message
    });
  }
});

// @desc    Update meeting
// @route   PUT /api/meetings/:id
// @access  Private/Secretary
router.put('/:id', [
  authMiddleware,
  authorizeRoles('Secretary', 'President', 'Controller')
], async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('chairperson', 'name role')
      .populate('minutesTaker', 'name role')
      .populate('attendees.user', 'name role');
    
    if (!meeting) {
      return res.status(404).json({
        status: 'error',
        message: 'Meeting not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Meeting updated successfully',
      data: meeting
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update meeting',
      error: error.message
    });
  }
});

// @desc    Delete meeting
// @route   DELETE /api/meetings/:id
// @access  Private/Controller
router.delete('/:id', [
  authMiddleware,
  isController
], async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndDelete(req.params.id);
    
    if (!meeting) {
      return res.status(404).json({
        status: 'error',
        message: 'Meeting not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Meeting deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete meeting',
      error: error.message
    });
  }
});

// @desc    Send meeting invitations
// @route   POST /api/meetings/:id/invite
// @access  Private/Secretary
router.post('/:id/invite', [
  authMiddleware,
  authorizeRoles('Secretary', 'President', 'Controller')
], async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('chairperson', 'name email')
      .populate('attendees.user', 'name email');
    
    if (!meeting) {
      return res.status(404).json({
        status: 'error',
        message: 'Meeting not found'
      });
    }
    
    // Get attendees emails
    const attendees = meeting.attendees.map(attendee => ({
      name: attendee.user.name,
      email: attendee.user.email
    }));
    
    // Add chairperson if not in attendees
    if (!attendees.find(a => a.email === meeting.chairperson.email)) {
      attendees.push({
        name: meeting.chairperson.name,
        email: meeting.chairperson.email
      });
    }
    
    // Send invitation emails
    const emailSent = await sendMeetingInvitation(meeting, attendees);
    
    if (!emailSent) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to send invitation emails'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: `Meeting invitations sent to ${attendees.length} attendees`
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to send invitations',
      error: error.message
    });
  }
});

// @desc    Update meeting minutes
// @route   PUT /api/meetings/:id/minutes
// @access  Private/Secretary
router.put('/:id/minutes', [
  authMiddleware,
  authorizeRoles('Secretary', 'Controller')
], async (req, res) => {
  try {
    const { summary, decisions, actionItems, nextMeeting } = req.body;
    
    const meeting = await Meeting.findById(req.params.id);
    
    if (!meeting) {
      return res.status(404).json({
        status: 'error',
        message: 'Meeting not found'
      });
    }
    
    // Update minutes
    meeting.minutes = {
      summary: summary || meeting.minutes?.summary,
      decisions: decisions || meeting.minutes?.decisions || [],
      actionItems: actionItems || meeting.minutes?.actionItems || [],
      nextMeeting: nextMeeting || meeting.minutes?.nextMeeting
    };
    
    // Update meeting status to completed
    meeting.status = 'completed';
    meeting.updatedAt = new Date();
    
    await meeting.save();
    
    // Populate for response
    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate('minutes.actionItems.assignee', 'name role');
    
    res.status(200).json({
      status: 'success',
      message: 'Meeting minutes updated successfully',
      data: populatedMeeting
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update meeting minutes',
      error: error.message
    });
  }
});

// @desc    Publish meeting minutes
// @route   POST /api/meetings/:id/publish
// @access  Private/Secretary
router.post('/:id/publish', [
  authMiddleware,
  authorizeRoles('Secretary', 'President', 'Controller')
], async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('attendees.user', 'name email');
    
    if (!meeting) {
      return res.status(404).json({
        status: 'error',
        message: 'Meeting not found'
      });
    }
    
    // Check if meeting has minutes
    if (!meeting.minutes || !meeting.minutes.summary) {
      return res.status(400).json({
        status: 'error',
        message: 'Meeting minutes are required before publishing'
      });
    }
    
    // Update meeting status
    meeting.published = true;
    meeting.publishedAt = new Date();
    await meeting.save();
    
    // Send minutes to attendees
    const attendees = meeting.attendees.map(attendee => ({
      name: attendee.user.name,
      email: attendee.user.email
    }));
    
    await sendMeetingMinutes(meeting, attendees);
    
    res.status(200).json({
      status: 'success',
      message: 'Meeting minutes published and sent to attendees'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to publish meeting minutes',
      error: error.message
    });
  }
});

// @desc    Archive meeting
// @route   POST /api/meetings/:id/archive
// @access  Private/Secretary
router.post('/:id/archive', [
  authMiddleware,
  authorizeRoles('Secretary', 'Controller')
], async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    
    if (!meeting) {
      return res.status(404).json({
        status: 'error',
        message: 'Meeting not found'
      });
    }
    
    // Check if meeting is completed
    if (meeting.status !== 'completed') {
      return res.status(400).json({
        status: 'error',
        message: 'Only completed meetings can be archived'
      });
    }
    
    // Archive meeting
    meeting.archived = true;
    meeting.archivedAt = new Date();
    await meeting.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Meeting archived successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to archive meeting',
      error: error.message
    });
  }
});

// @desc    Restore archived meeting
// @route   POST /api/meetings/:id/restore
// @access  Private/Secretary
router.post('/:id/restore', [
  authMiddleware,
  authorizeRoles('Secretary', 'Controller')
], async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    
    if (!meeting) {
      return res.status(404).json({
        status: 'error',
        message: 'Meeting not found'
      });
    }
    
    // Restore meeting
    meeting.archived = false;
    meeting.archivedAt = null;
    await meeting.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Meeting restored successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to restore meeting',
      error: error.message
    });
  }
});

// @desc    Get meeting statistics
// @route   GET /api/meetings/stats
// @access  Private
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const totalMeetings = await Meeting.countDocuments();
    const completedMeetings = await Meeting.countDocuments({ status: 'completed' });
    const archivedMeetings = await Meeting.countDocuments({ archived: true });
    const publishedMeetings = await Meeting.countDocuments({ published: true });
    
    // Meetings by type
    const meetingsByType = await Meeting.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Meetings by month (current year)
    const currentYear = new Date().getFullYear();
    const meetingsByMonth = await Meeting.aggregate([
      {
        $match: {
          date: {
            $gte: new Date(`${currentYear}-01-01`),
            $lte: new Date(`${currentYear}-12-31`)
          }
        }
      },
      {
        $group: {
          _id: { $month: '$date' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);
    
    res.status(200).json({
      status: 'success',
      data: {
        totalMeetings,
        completedMeetings,
        archivedMeetings,
        publishedMeetings,
        meetingsByType,
        meetingsByMonth,
        currentYear
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch meeting statistics',
      error: error.message
    });
  }
});

// @desc    Get upcoming meetings
// @route   GET /api/meetings/upcoming
// @access  Private
router.get('/upcoming', authMiddleware, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const upcomingMeetings = await Meeting.find({
      date: { $gte: today },
      status: 'scheduled',
      archived: false
    })
      .populate('chairperson', 'name role avatar')
      .populate('attendees.user', 'name role')
      .sort({ date: 1, startTime: 1 })
      .limit(10);
    
    res.status(200).json({
      status: 'success',
      count: upcomingMeetings.length,
      data: upcomingMeetings
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch upcoming meetings',
      error: error.message
    });
  }
});

// @desc    Get recent meetings
// @route   GET /api/meetings/recent
// @access  Private
router.get('/recent', authMiddleware, async (req, res) => {
  try {
    const recentMeetings = await Meeting.find({
      status: 'completed',
      archived: false
    })
      .populate('chairperson', 'name role avatar')
      .sort({ date: -1 })
      .limit(5);
    
    res.status(200).json({
      status: 'success',
      count: recentMeetings.length,
      data: recentMeetings
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch recent meetings',
      error: error.message
    });
  }
});

module.exports = router;
