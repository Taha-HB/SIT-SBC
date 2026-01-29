const Meeting = require('../models/Meeting');
const User = require('../models/User');
const Archive = require('../models/Archive');
const { validationResult } = require('express-validator');
const sendEmail = require('../utils/emailService');

// @desc    Create new meeting
// @route   POST /api/meetings
// @access  Private
exports.createMeeting = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      title,
      type,
      date,
      startTime,
      endTime,
      venue,
      objective,
      agenda,
      attendees
    } = req.body;

    // Create meeting
    const meeting = await Meeting.create({
      title,
      type,
      date,
      startTime,
      endTime,
      venue,
      objective,
      chairperson: req.user.id,
      minutesTaker: req.user.id,
      createdBy: req.user.id,
      agenda: agenda || [],
      attendees: attendees || []
    });

    // Update creator's performance
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { 'performance.meetingsAttended': 1 }
    });

    res.status(201).json({
      success: true,
      meeting
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get all meetings
// @route   GET /api/meetings
// @access  Private
exports.getMeetings = async (req, res, next) => {
  try {
    const {
      type,
      status,
      archived,
      published,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sort = '-date'
    } = req.query;

    // Build query
    const query = {};

    if (type) query.type = type;
    if (status) query.status = status;
    if (archived !== undefined) query.archived = archived === 'true';
    if (published !== undefined) query.published = published === 'true';
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Execute query
    const meetings = await Meeting.find(query)
      .populate('chairperson', 'name email role avatar')
      .populate('minutesTaker', 'name email role avatar')
      .populate('attendees.user', 'name email role avatar')
      .populate('minutes.actionItems.assignee', 'name email role avatar')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Get total count
    const total = await Meeting.countDocuments(query);

    // Get statistics
    const stats = await Meeting.getStatistics();

    res.status(200).json({
      success: true,
      count: meetings.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      meetings,
      stats
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get single meeting
// @route   GET /api/meetings/:id
// @access  Private
exports.getMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('chairperson', 'name email role avatar')
      .populate('minutesTaker', 'name email role avatar')
      .populate('attendees.user', 'name email role avatar')
      .populate('minutes.actionItems.assignee', 'name email role avatar')
      .populate('createdBy', 'name email role avatar')
      .populate('updatedBy', 'name email role avatar')
      .populate('publishedBy', 'name email role avatar');

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    res.status(200).json({
      success: true,
      meeting
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Update meeting
// @route   PUT /api/meetings/:id
// @access  Private
exports.updateMeeting = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    let meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check permissions
    if (!req.user.isController && 
        meeting.createdBy.toString() !== req.user.id.toString() &&
        meeting.chairperson.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this meeting'
      });
    }

    // Update meeting
    meeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedBy: req.user.id
      },
      {
        new: true,
        runValidators: true
      }
    )
      .populate('chairperson', 'name email role avatar')
      .populate('minutesTaker', 'name email role avatar')
      .populate('attendees.user', 'name email role avatar');

    res.status(200).json({
      success: true,
      meeting
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Delete meeting
// @route   DELETE /api/meetings/:id
// @access  Private/Controller
exports.deleteMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check if user is controller
    if (!req.user.isController) {
      return res.status(403).json({
        success: false,
        message: 'Only controllers can delete meetings'
      });
    }

    // Archive meeting before deletion
    await Archive.create({
      itemId: meeting._id,
      itemType: 'meeting',
      originalData: meeting.toObject(),
      archivedBy: req.user.id,
      reason: 'Manual deletion by controller',
      metadata: {
        version: meeting.version,
        originalCollection: 'meetings',
        size: JSON.stringify(meeting).length
      }
    });

    // Delete meeting
    await meeting.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Meeting deleted and archived'
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Publish meeting
// @route   POST /api/meetings/:id/publish
// @access  Private
exports.publishMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check permissions
    if (!req.user.isController && 
        meeting.createdBy.toString() !== req.user.id.toString() &&
        meeting.chairperson.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to publish this meeting'
      });
    }

    // Publish meeting
    await meeting.publish(req.user.id);

    // Send notifications to attendees
    const attendees = await User.find({
      _id: { $in: meeting.attendees.map(a => a.user) }
    });

    // Send email notifications
    for (const attendee of attendees) {
      if (attendee.preferences?.notifications?.email) {
        await sendEmail({
          email: attendee.email,
          subject: `Meeting Minutes Published: ${meeting.title}`,
          message: `
            Dear ${attendee.name},
            
            The minutes for "${meeting.title}" have been published.
            
            Meeting Details:
            - Date: ${new Date(meeting.date).toLocaleDateString()}
            - Time: ${meeting.startTime} - ${meeting.endTime}
            - Venue: ${meeting.venue}
            
            You can view the minutes in the SBC Portal.
            
            Best regards,
            SIT Student Council
          `
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Meeting published successfully',
      meeting
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Archive meeting
// @route   POST /api/meetings/:id/archive
// @access  Private/Controller
exports.archiveMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check if user is controller
    if (!req.user.isController) {
      return res.status(403).json({
        success: false,
        message: 'Only controllers can archive meetings'
      });
    }

    // Archive meeting
    await meeting.archive();

    res.status(200).json({
      success: true,
      message: 'Meeting archived successfully',
      meeting
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Restore archived meeting
// @route   POST /api/meetings/:id/restore
// @access  Private/Controller
exports.restoreMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check if user is controller
    if (!req.user.isController) {
      return res.status(403).json({
        success: false,
        message: 'Only controllers can restore meetings'
      });
    }

    // Restore meeting
    await meeting.restore();

    res.status(200).json({
      success: true,
      message: 'Meeting restored successfully',
      meeting
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Add attendee to meeting
// @route   POST /api/meetings/:id/attendees
// @access  Private
exports.addAttendee = async (req, res, next) => {
  try {
    const { userId, status, time, notes } = req.body;

    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check permissions
    if (!req.user.isController && 
        meeting.createdBy.toString() !== req.user.id.toString() &&
        meeting.chairperson.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify attendees'
      });
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add attendee
    await meeting.addAttendee(userId, status, time, notes);

    // Update user performance
    if (status === 'present') {
      await user.updatePerformance(1, 0);
    }

    res.status(200).json({
      success: true,
      message: 'Attendee added successfully',
      meeting
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Complete action item
// @route   POST /api/meetings/:id/action-items/:actionItemId/complete
// @access  Private
exports.completeActionItem = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Complete action item
    await meeting.completeActionItem(req.params.actionItemId);

    // Update assignee's performance
    const actionItem = meeting.minutes.actionItems.id(req.params.actionItemId);
    if (actionItem && actionItem.assignee) {
      const user = await User.findById(actionItem.assignee);
      if (user) {
        await user.updatePerformance(0, 1);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Action item marked as complete',
      meeting
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get meeting statistics
// @route   GET /api/meetings/stats
// @access  Private
exports.getMeetingStats = async (req, res, next) => {
  try {
    const stats = await Meeting.getStatistics();

    // Get additional stats
    const totalMeetings = await Meeting.countDocuments();
    const upcomingMeetings = await Meeting.countDocuments({ 
      date: { $gt: new Date() },
      status: 'scheduled'
    });
    const completedMeetings = await Meeting.countDocuments({ 
      status: 'completed' 
    });

    res.status(200).json({
      success: true,
      stats: {
        total: totalMeetings,
        upcoming: upcomingMeetings,
        completed: completedMeetings,
        ...stats
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get calendar events
// @route   GET /api/meetings/calendar
// @access  Private
exports.getCalendarEvents = async (req, res, next) => {
  try {
    const { start, end } = req.query;

    const query = {};
    if (start && end) {
      query.date = {
        $gte: new Date(start),
        $lte: new Date(end)
      };
    }

    const meetings = await Meeting.find(query)
      .select('title date startTime endTime venue type status')
      .populate('chairperson', 'name')
      .sort('date');

    const events = meetings.map(meeting => ({
      id: meeting._id,
      title: meeting.title,
      start: `${meeting.date.toISOString().split('T')[0]}T${meeting.startTime}:00`,
      end: `${meeting.date.toISOString().split('T')[0]}T${meeting.endTime}:00`,
      location: meeting.venue,
      type: meeting.type,
      status: meeting.status,
      chairperson: meeting.chairperson?.name,
      extendedProps: {
        meetingId: meeting._id,
        type: meeting.type
      }
    }));

    res.status(200).json({
      success: true,
      events
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Send meeting reminders
// @route   POST /api/meetings/:id/reminders
// @access  Private
exports.sendReminders = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('attendees.user', 'name email preferences');

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check permissions
    if (!req.user.isController && 
        meeting.createdBy.toString() !== req.user.id.toString() &&
        meeting.chairperson.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send reminders'
      });
    }

    const remindersSent = [];

    // Send reminders to attendees
    for (const attendee of meeting.attendees) {
      if (attendee.user && attendee.user.preferences?.notifications?.email) {
        try {
          await sendEmail({
            email: attendee.user.email,
            subject: `Meeting Reminder: ${meeting.title}`,
            message: `
              Dear ${attendee.user.name},
              
              This is a reminder for the upcoming meeting:
              
              Meeting: ${meeting.title}
              Date: ${new Date(meeting.date).toLocaleDateString()}
              Time: ${meeting.startTime} - ${meeting.endTime}
              Venue: ${meeting.venue}
              Type: ${meeting.type}
              
              Please be prepared and arrive on time.
              
              Best regards,
              SIT Student Council
            `
          });

          remindersSent.push({
            user: attendee.user._id,
            email: attendee.user.email,
            sent: true
          });
        } catch (error) {
          remindersSent.push({
            user: attendee.user._id,
            email: attendee.user.email,
            sent: false,
            error: error.message
          });
        }
      }
    }

    // Update meeting reminders
    meeting.reminders.push({
      type: 'email',
      sent: true,
      sentAt: new Date()
    });

    await meeting.save();

    res.status(200).json({
      success: true,
      message: `Reminders sent to ${remindersSent.filter(r => r.sent).length} attendees`,
      remindersSent
    });

  } catch (error) {
    next(error);
  }
};
