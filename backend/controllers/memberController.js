const User = require('../models/User');
const Performance = require('../models/Member');
const Meeting = require('../models/Meeting');
const { generateAvatar, generateAvatarColor, calculatePerformanceScore } = require('../utils/helpers');
const { sendWelcomeEmail } = require('../utils/emailService');

// @desc    Get all council members
// @route   GET /api/members
// @access  Private
exports.getAllMembers = async (req, res) => {
  try {
    const { search, role, department, status } = req.query;
    
    // Build filter
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } }
      ];
    }
    if (role) filter.role = role;
    if (department) filter.department = department;
    if (status) filter.status = status;
    
    // Get members
    const members = await User.find(filter)
      .select('-password')
      .sort({ role: 1, name: 1 });
    
    // Get performance data
    const membersWithPerformance = await Promise.all(
      members.map(async (member) => {
        const performance = await Performance.findOne({ user: member._id });
        return {
          ...member.toObject(),
          performance: performance || {
            meetingsAttended: 0,
            tasksCompleted: 0,
            rating: 0,
            attendanceRate: 0,
            completionRate: 0
          }
        };
      })
    );
    
    res.status(200).json({
      status: 'success',
      count: membersWithPerformance.length,
      data: membersWithPerformance
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch members',
      error: error.message
    });
  }
};

// @desc    Get single member
// @route   GET /api/members/:id
// @access  Private
exports.getMember = async (req, res) => {
  try {
    const member = await User.findById(req.params.id).select('-password');
    
    if (!member) {
      return res.status(404).json({
        status: 'error',
        message: 'Member not found'
      });
    }
    
    // Get performance data
    const performance = await Performance.findOne({ user: member._id });
    
    res.status(200).json({
      status: 'success',
      data: {
        ...member.toObject(),
        performance: performance || {
          meetingsAttended: 0,
          tasksCompleted: 0,
          rating: 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch member',
      error: error.message
    });
  }
};

// @desc    Create new member
// @route   POST /api/members
// @access  Private/Controller
exports.createMember = async (req, res) => {
  try {
    const {
      studentId,
      name,
      email,
      role,
      position,
      department,
      phone
    } = req.body;
    
    // Check if member already exists
    const existingMember = await User.findOne({ 
      $or: [{ studentId }, { email }] 
    });
    
    if (existingMember) {
      return res.status(400).json({
        status: 'error',
        message: 'Member with this Student ID or Email already exists'
      });
    }
    
    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();
    
    // Create member
    const member = await User.create({
      studentId,
      name,
      email,
      password: tempPassword,
      role,
      position,
      department,
      phone,
      avatar: generateAvatar(name),
      avatarColor: generateAvatarColor(),
      performance: {
        meetingsAttended: 0,
        tasksCompleted: 0,
        rating: 0,
        streak: 0,
        achievements: [],
        points: 0
      }
    });
    
    // Create performance record
    await Performance.create({
      user: member._id,
      metrics: {
        totalMeetings: 0,
        meetingsAttended: 0,
        attendanceRate: 0,
        totalTasks: 0,
        tasksCompleted: 0,
        completionRate: 0,
        averageScore: 0,
        currentStreak: 0,
        bestStreak: 0
      },
      points: {
        total: 0,
        breakdown: {
          attendance: 0,
          taskCompletion: 0,
          leadership: 0,
          teamwork: 0,
          initiative: 0
        }
      }
    });
    
    // Send welcome email
    await sendWelcomeEmail(member, tempPassword);
    
    res.status(201).json({
      status: 'success',
      message: 'Member created successfully',
      data: {
        ...member.toObject(),
        password: undefined
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to create member',
      error: error.message
    });
  }
};

// @desc    Update member
// @route   PUT /api/members/:id
// @access  Private/Controller
exports.updateMember = async (req, res) => {
  try {
    const updates = req.body;
    
    // Remove password from updates if present
    delete updates.password;
    
    const member = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!member) {
      return res.status(404).json({
        status: 'error',
        message: 'Member not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Member updated successfully',
      data: member
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update member',
      error: error.message
    });
  }
};

// @desc    Delete member
// @route   DELETE /api/members/:id
// @access  Private/Controller
exports.deleteMember = async (req, res) => {
  try {
    const member = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'inactive' },
      { new: true }
    );
    
    if (!member) {
      return res.status(404).json({
        status: 'error',
        message: 'Member not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Member deactivated successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete member',
      error: error.message
    });
  }
};

// @desc    Update member performance
// @route   PUT /api/members/:id/performance
// @access  Private
exports.updatePerformance = async (req, res) => {
  try {
    const { meetingsAttended, tasksCompleted, achievements, points } = req.body;
    
    const performance = await Performance.findOne({ user: req.params.id });
    
    if (!performance) {
      return res.status(404).json({
        status: 'error',
        message: 'Performance record not found'
      });
    }
    
    // Update metrics
    if (meetingsAttended !== undefined) {
      performance.metrics.meetingsAttended = meetingsAttended;
    }
    
    if (tasksCompleted !== undefined) {
      performance.metrics.tasksCompleted = tasksCompleted;
    }
    
    if (achievements) {
      performance.awards.push(...achievements.map(achievement => ({
        title: achievement,
        type: 'excellence',
        awardedAt: new Date(),
        awardedBy: req.user._id
      })));
    }
    
    if (points) {
      performance.points.total += points;
    }
    
    // Calculate new rating
    const rating = calculatePerformanceScore({
      performance: {
        attendanceRate: performance.metrics.attendanceRate,
        completionRate: performance.metrics.completionRate,
        averageScore: performance.metrics.averageScore
      }
    });
    
    performance.metrics.averageScore = rating;
    
    await performance.save();
    
    // Update user's performance summary
    await User.findByIdAndUpdate(req.params.id, {
      'performance.meetingsAttended': performance.metrics.meetingsAttended,
      'performance.tasksCompleted': performance.metrics.tasksCompleted,
      'performance.rating': rating,
      'performance.points': performance.points.total
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Performance updated successfully',
      data: performance
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update performance',
      error: error.message
    });
  }
};

// @desc    Get member statistics
// @route   GET /api/members/stats
// @access  Private
exports.getMemberStats = async (req, res) => {
  try {
    const totalMembers = await User.countDocuments({ status: 'active' });
    const membersByRole = await User.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    
    const recentMembers = await User.find({ status: 'active' })
      .sort({ joinDate: -1 })
      .limit(5)
      .select('name role joinDate');
    
    // Calculate average performance
    const performances = await Performance.find().populate('user');
    const avgAttendance = performances.reduce((acc, perf) => 
      acc + (perf.metrics.attendanceRate || 0), 0) / (performances.length || 1);
    const avgTasks = performances.reduce((acc, perf) => 
      acc + (perf.metrics.tasksCompleted || 0), 0) / (performances.length || 1);
    
    res.status(200).json({
      status: 'success',
      data: {
        totalMembers,
        membersByRole,
        recentMembers,
        averageAttendance: avgAttendance.toFixed(1),
        averageTasks: avgTasks.toFixed(1),
        totalPerformers: performances.length
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch member statistics',
      error: error.message
    });
  }
};

// @desc    Get top performers
// @route   GET /api/members/top-performers
// @access  Private
exports.getTopPerformers = async (req, res) => {
  try {
    const { period = 'month', limit = 5 } = req.query;
    
    // Get performances sorted by rating
    const performances = await Performance.find()
      .populate('user', 'name role avatar avatarColor')
      .sort({ 'metrics.averageScore': -1 })
      .limit(parseInt(limit));
    
    // Format response
    const topPerformers = performances.map((perf, index) => ({
      rank: index + 1,
      memberId: perf.user._id,
      name: perf.user.name,
      role: perf.user.role,
      avatar: perf.user.avatar,
      avatarColor: perf.user.avatarColor,
      score: perf.metrics.averageScore || 0,
      attendanceRate: perf.metrics.attendanceRate || 0,
      tasksCompleted: perf.metrics.tasksCompleted || 0,
      points: perf.points.total || 0
    }));
    
    res.status(200).json({
      status: 'success',
      data: topPerformers
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch top performers',
      error: error.message
    });
  }
};

// @desc    Upload member avatar
// @route   POST /api/members/:id/avatar
// @access  Private
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Please upload an image file'
      });
    }
    
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    
    const member = await User.findByIdAndUpdate(
      req.params.id,
      { avatar: avatarUrl },
      { new: true }
    ).select('-password');
    
    if (!member) {
      return res.status(404).json({
        status: 'error',
        message: 'Member not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Avatar uploaded successfully',
      data: {
        avatar: member.avatar
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload avatar',
      error: error.message
    });
  }
};

// @desc    Get member attendance
// @route   GET /api/members/:id/attendance
// @access  Private
exports.getMemberAttendance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const filter = { 'attendees.user': req.params.id };
    
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    
    const meetings = await Meeting.find(filter)
      .select('title date startTime endTime venue attendees')
      .sort({ date: -1 });
    
    const attendance = meetings.map(meeting => {
      const attendance = meeting.attendees.find(a => 
        a.user.toString() === req.params.id
      );
      
      return {
        meetingId: meeting._id,
        title: meeting.title,
        date: meeting.date,
        time: `${meeting.startTime} - ${meeting.endTime}`,
        venue: meeting.venue,
        status: attendance?.status || 'absent',
        time: attendance?.time
      };
    });
    
    // Calculate statistics
    const totalMeetings = attendance.length;
    const presentCount = attendance.filter(a => a.status === 'present').length;
    const attendanceRate = totalMeetings > 0 ? (presentCount / totalMeetings) * 100 : 0;
    
    res.status(200).json({
      status: 'success',
      data: {
        attendance,
        statistics: {
          totalMeetings,
          presentCount,
          attendanceRate: attendanceRate.toFixed(1),
          absentCount: totalMeetings - presentCount
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch attendance',
      error: error.message
    });
  }
};

// @desc    Get member tasks
// @route   GET /api/members/:id/tasks
// @access  Private
exports.getMemberTasks = async (req, res) => {
  try {
    const { status } = req.query;
    
    const filter = { 'minutes.actionItems.assignee': req.params.id };
    
    if (status) {
      filter['minutes.actionItems.status'] = status;
    }
    
    const meetings = await Meeting.find(filter)
      .select('title date minutes')
      .sort({ date: -1 });
    
    const tasks = [];
    
    meetings.forEach(meeting => {
      meeting.minutes.actionItems
        .filter(item => item.assignee.toString() === req.params.id)
        .forEach(item => {
          tasks.push({
            taskId: item.id,
            description: item.task,
            meetingId: meeting._id,
            meetingTitle: meeting.title,
            meetingDate: meeting.date,
            deadline: item.deadline,
            status: item.status,
            priority: item.priority,
            notes: item.notes
          });
        });
    });
    
    // Calculate statistics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    res.status(200).json({
      status: 'success',
      data: {
        tasks,
        statistics: {
          totalTasks,
          completedTasks,
          completionRate: completionRate.toFixed(1),
          pendingTasks: totalTasks - completedTasks
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch tasks',
      error: error.message
    });
  }
};
