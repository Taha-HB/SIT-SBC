const PDFDocument = require('pdfkit');
const { generateMeetingMinutesPDF, generatePerformanceReportPDF, generateCouncilRosterPDF } = require('../utils/generatePDF');
const User = require('../models/User');
const Meeting = require('../models/Meeting');
const Performance = require('../models/Member');

// @desc    Generate meeting minutes PDF
// @route   POST /api/pdf/meeting-minutes
// @access  Private
exports.generateMeetingMinutes = async (req, res) => {
  try {
    const { meetingId } = req.body;
    
    if (!meetingId) {
      return res.status(400).json({
        status: 'error',
        message: 'Meeting ID is required'
      });
    }
    
    // Get meeting with populated data
    const meeting = await Meeting.findById(meetingId)
      .populate('chairperson', 'name')
      .populate('minutesTaker', 'name')
      .populate('attendees.user', 'name role')
      .populate('minutes.actionItems.assignee', 'name');
    
    if (!meeting) {
      return res.status(404).json({
        status: 'error',
        message: 'Meeting not found'
      });
    }
    
    // Format attendees for PDF
    const attendees = meeting.attendees.map(attendee => ({
      name: attendee.user?.name || 'Unknown',
      role: attendee.user?.role || 'Member',
      status: attendee.status,
      time: attendee.time
    }));
    
    // Generate PDF
    const pdfBuffer = await generateMeetingMinutesPDF(meeting, attendees);
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="SIT_Meeting_Minutes_${meeting.meetingId}.pdf"`);
    
    // Send PDF
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate PDF',
      error: error.message
    });
  }
};

// @desc    Generate performance report PDF
// @route   POST /api/pdf/performance-report
// @access  Private/Controller
exports.generatePerformanceReport = async (req, res) => {
  try {
    const { period = 'Monthly Report', userIds } = req.body;
    
    let users;
    
    if (userIds && userIds.length > 0) {
      // Get specific users
      users = await User.find({ _id: { $in: userIds }, status: 'active' })
        .select('-password')
        .populate({
          path: 'performance',
          select: 'metrics'
        });
    } else {
      // Get all active users
      users = await User.find({ status: 'active' })
        .select('-password')
        .populate({
          path: 'performance',
          select: 'metrics'
        });
    }
    
    if (!users || users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No users found'
      });
    }
    
    // Format users for PDF
    const formattedUsers = users.map(user => ({
      ...user.toObject(),
      performance: user.performance || {
        metrics: {
          attendanceRate: 0,
          tasksCompleted: 0,
          averageScore: 0
        }
      }
    }));
    
    // Generate PDF
    const pdfBuffer = await generatePerformanceReportPDF(formattedUsers, period);
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="SIT_Performance_Report_${new Date().toISOString().split('T')[0]}.pdf"`);
    
    // Send PDF
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate performance report',
      error: error.message
    });
  }
};

// @desc    Generate council roster PDF
// @route   GET /api/pdf/council-roster
// @access  Private
exports.generateCouncilRoster = async (req, res) => {
  try {
    // Get all active members
    const members = await User.find({ status: 'active' })
      .select('-password')
      .sort({ role: 1, name: 1 });
    
    if (!members || members.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No council members found'
      });
    }
    
    // Get performance data for each member
    const membersWithPerformance = await Promise.all(
      members.map(async (member) => {
        const performance = await Performance.findOne({ user: member._id });
        return {
          ...member.toObject(),
          performance: performance || {
            metrics: {
              attendanceRate: 0,
              tasksCompleted: 0,
              averageScore: 0
            }
          }
        };
      })
    );
    
    // Generate PDF
    const pdfBuffer = await generateCouncilRosterPDF(membersWithPerformance);
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="SIT_Council_Roster.pdf"');
    
    // Send PDF
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate council roster',
      error: error.message
    });
  }
};

// @desc    Generate certificate PDF
// @route   POST /api/pdf/certificate
// @access  Private/Controller
exports.generateCertificate = async (req, res) => {
  try {
    const { userId, achievement, date } = req.body;
    
    if (!userId || !achievement) {
      return res.status(400).json({
        status: 'error',
        message: 'User ID and achievement are required'
      });
    }
    
    // Get user
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 50,
      info: {
        Title: `Certificate of Achievement - ${user.name}`,
        Author: 'SIT Student Council',
        Subject: 'Certificate of Achievement',
        Keywords: 'SIT, Certificate, Achievement, Award',
        Creator: 'SIT Council Management System v2.0',
        CreationDate: new Date()
      }
    });
    
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      
      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Certificate_${user.name.replace(/\s+/g, '_')}.pdf"`);
      
      // Send PDF
      res.send(pdfData);
    });
    
    // Background
    doc.rect(0, 0, doc.page.width, doc.page.height)
       .fill('#FFF8E1');
    
    // Border
    doc.strokeColor('#FFD54F')
       .lineWidth(20)
       .rect(40, 40, doc.page.width - 80, doc.page.height - 80)
       .stroke();
    
    // Header
    doc.fillColor('#0066CC')
       .fontSize(48)
       .font('Helvetica-Bold')
       .text('CERTIFICATE OF ACHIEVEMENT', doc.page.width / 2, 100, { align: 'center' });
    
    // Subtitle
    doc.fillColor('#009999')
       .fontSize(24)
       .font('Helvetica')
       .text('Presented to', doc.page.width / 2, 180, { align: 'center' });
    
    // Recipient Name
    doc.fillColor('#000000')
       .fontSize(42)
       .font('Helvetica-Bold')
       .text(user.name.toUpperCase(), doc.page.width / 2, 220, { align: 'center' });
    
    // Achievement
    doc.fillColor('#666666')
       .fontSize(20)
       .font('Helvetica')
       .text('in recognition of outstanding achievement in', doc.page.width / 2, 300, { align: 'center' });
    
    doc.fillColor('#FF6600')
       .fontSize(28)
       .font('Helvetica-Bold')
       .text(achievement.toUpperCase(), doc.page.width / 2, 330, { align: 'center' });
    
    // Description
    doc.fillColor('#000000')
       .fontSize(18)
       .font('Helvetica')
       .text('This certificate is awarded in recognition of exceptional dedication, leadership,', 
             doc.page.width / 2, 400, { align: 'center' });
    doc.text('and contribution to the SIT Student Council and the student community.',
             doc.page.width / 2, 425, { align: 'center' });
    
    // Date
    doc.fillColor('#666666')
       .fontSize(16)
       .font('Helvetica')
       .text(`Date: ${date || new Date().toLocaleDateString()}`, 
             doc.page.width / 2, 500, { align: 'center' });
    
    // Signatures
    const signatureY = 550;
    
    // President
    doc.fillColor('#000000')
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('________________________', 150, signatureY);
    
    doc.fillColor('#666666')
       .fontSize(14)
       .font('Helvetica')
       .text('Ibrahim Mohammed', 150, signatureY + 25);
    doc.text('President', 150, signatureY + 45);
    doc.text('SIT Student Council', 150, signatureY + 65);
    
    // Controller
    doc.fillColor('#000000')
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('________________________', doc.page.width - 350, signatureY);
    
    doc.fillColor('#666666')
       .fontSize(14)
       .font('Helvetica')
       .text('System Controller', doc.page.width - 350, signatureY + 25);
    doc.text('SIT Student Council', doc.page.width - 350, signatureY + 45);
    doc.text('Management System', doc.page.width - 350, signatureY + 65);
    
    // Footer
    doc.fillColor('#999999')
       .fontSize(10)
       .font('Helvetica')
       .text('Certificate ID: SIT-CERT-' + Date.now(), doc.page.width / 2, doc.page.height - 50, { align: 'center' });
    doc.text('SIT Student Council Management System v2.0', doc.page.width / 2, doc.page.height - 30, { align: 'center' });
    
    doc.end();
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate certificate',
      error: error.message
    });
  }
};

// @desc    Generate meeting agenda PDF
// @route   POST /api/pdf/meeting-agenda
// @access  Private
exports.generateMeetingAgenda = async (req, res) => {
  try {
    const { meetingId } = req.body;
    
    if (!meetingId) {
      return res.status(400).json({
        status: 'error',
        message: 'Meeting ID is required'
      });
    }
    
    // Get meeting
    const meeting = await Meeting.findById(meetingId)
      .populate('chairperson', 'name')
      .populate('minutesTaker', 'name');
    
    if (!meeting) {
      return res.status(404).json({
        status: 'error',
        message: 'Meeting not found'
      });
    }
    
    // Create PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Meeting Agenda - ${meeting.title}`,
        Author: 'SIT Student Council',
        Subject: 'Meeting Agenda',
        Keywords: 'SIT, Meeting, Agenda',
        Creator: 'SIT Council Management System v2.0',
        CreationDate: new Date()
      }
    });
    
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Agenda_${meeting.meetingId}.pdf"`);
      
      res.send(pdfData);
    });
    
    // Header
    doc.fillColor('#0066CC')
       .fontSize(20)
       .font('Helvetica-Bold')
       .text('SIT STUDENT COUNCIL MEETING AGENDA', { align: 'center' });
    
    doc.moveDown(1);
    
    // Meeting Details
    doc.fillColor('#000000')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('MEETING DETAILS', { underline: true });
    
    doc.moveDown(0.5);
    doc.fontSize(11)
       .font('Helvetica');
    
    const details = [
      ['Title:', meeting.title],
      ['Date:', new Date(meeting.date).toLocaleDateString()],
      ['Time:', `${meeting.startTime} - ${meeting.endTime}`],
      ['Venue:', meeting.venue],
      ['Chairperson:', meeting.chairperson?.name],
      ['Minutes Taker:', meeting.minutesTaker?.name],
      ['Meeting ID:', meeting.meetingId]
    ];
    
    details.forEach(([label, value]) => {
      doc.text(label, 50, doc.y);
      doc.text(value, 150, doc.y);
      doc.moveDown(0.5);
    });
    
    doc.moveDown(1);
    
    // Objective
    if (meeting.objective) {
      doc.fillColor('#000000')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('MEETING OBJECTIVE:', { underline: true });
      
      doc.moveDown(0.3);
      doc.fontSize(11)
         .font('Helvetica')
         .text(meeting.objective);
      
      doc.moveDown(1);
    }
    
    // Agenda Items
    if (meeting.agenda && meeting.agenda.length > 0) {
      doc.addPage();
      doc.fillColor('#000000')
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('AGENDA ITEMS', { align: 'center', underline: true });
      
      doc.moveDown(1);
      
      let totalDuration = 0;
      
      meeting.agenda.forEach((item, index) => {
        doc.fillColor('#0066CC')
           .fontSize(12)
           .font('Helvetica-Bold')
           .text(`${index + 1}. ${item.title}`);
        
        doc.fillColor('#666666')
           .fontSize(10)
           .font('Helvetica')
           .text(`Presenter: ${item.presenter} | Duration: ${item.duration} minutes`);
        
        if (item.description) {
          doc.fillColor('#000000')
             .fontSize(10)
             .font('Helvetica')
             .text(item.description);
        }
        
        doc.moveDown(0.5);
        totalDuration += item.duration || 0;
      });
      
      doc.moveDown(1);
      doc.fillColor('#000000')
         .fontSize(11)
         .font('Helvetica-Bold')
         .text(`Total Meeting Duration: ${totalDuration} minutes (${(totalDuration / 60).toFixed(1)} hours)`);
    }
    
    // Notes Section
    doc.addPage();
    doc.fillColor('#000000')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('MEETING PREPARATION NOTES', { underline: true });
    
    doc.moveDown(1);
    doc.fontSize(11)
       .font('Helvetica');
    
    const notes = [
      '1. Please review all agenda items before the meeting',
      '2. Come prepared with any necessary materials or reports',
      '3. Be punctual - the meeting will start on time',
      '4. Mobile phones should be on silent mode',
      '5. Respect speaking turns and meeting time limits',
      '6. Action items will be assigned during the meeting',
      '7. Minutes will be distributed within 24 hours after the meeting'
    ];
    
    notes.forEach(note => {
      doc.text(note);
      doc.moveDown(0.3);
    });
    
    doc.moveDown(2);
    doc.fillColor('#666666')
       .fontSize(10)
       .font('Helvetica')
       .text('Generated by SIT Student Council Management System v2.0', { align: 'center' });
    
    doc.end();
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate agenda PDF',
      error: error.message
    });
  }
};
