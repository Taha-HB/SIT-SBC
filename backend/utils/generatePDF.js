const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

// Generate meeting minutes PDF
const generateMeetingMinutesPDF = async (meeting, attendees) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `SIT Council Meeting Minutes - ${meeting.title}`,
          Author: 'SIT Student Council',
          Subject: 'Official Meeting Minutes',
          Keywords: 'SIT, Student Council, Meeting Minutes',
          Creator: 'SIT Council Management System v2.0',
          CreationDate: new Date()
        }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Header
      doc.fillColor('#0066CC')
         .fontSize(20)
         .font('Helvetica-Bold')
         .text('SIT STUDENT COUNCIL', { align: 'center' });
      
      doc.moveDown(0.5);
      doc.fillColor('#009999')
         .fontSize(16)
         .text('OFFICIAL MEETING MINUTES', { align: 'center' });
      
      doc.moveDown(1);
      doc.fillColor('#666666')
         .fontSize(10)
         .text(`Document ID: ${meeting.meetingId} | Generated: ${moment().format('MMMM DD, YYYY hh:mm A')}`, { align: 'center' });
      
      // Horizontal line
      doc.moveTo(50, doc.y + 10)
         .lineTo(550, doc.y + 10)
         .strokeColor('#FF6600')
         .lineWidth(2)
         .stroke();
      
      doc.moveDown(2);

      // Meeting Details
      doc.fillColor('#000000')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('MEETING DETAILS', { underline: true });
      
      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica');
      
      const details = [
        ['Meeting Title:', meeting.title],
        ['Date:', moment(meeting.date).format('dddd, MMMM DD, YYYY')],
        ['Time:', `${meeting.startTime} - ${meeting.endTime}`],
        ['Venue:', meeting.venue],
        ['Meeting Type:', meeting.type.charAt(0).toUpperCase() + meeting.type.slice(1) + ' Meeting'],
        ['Chairperson:', meeting.chairperson],
        ['Minutes Taker:', meeting.minutesTaker]
      ];
      
      details.forEach(([label, value]) => {
        doc.text(label, 50, doc.y);
        doc.text(value, 200, doc.y);
        doc.moveDown(0.5);
      });
      
      doc.moveDown(1);

      // Attendance
      if (attendees && attendees.length > 0) {
        doc.addPage();
        doc.fillColor('#000000')
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('ATTENDANCE RECORD', { underline: true });
        
        doc.moveDown(0.5);
        
        // Table header
        doc.fillColor('#FFFFFF')
           .rect(50, doc.y, 500, 25)
           .fill('#0066CC');
        
        doc.fillColor('#FFFFFF')
           .fontSize(11)
           .font('Helvetica-Bold')
           .text('Name', 60, doc.y - 20);
        doc.text('Role', 200, doc.y - 20);
        doc.text('Status', 300, doc.y - 20);
        doc.text('Time', 400, doc.y - 20);
        
        doc.moveDown(2);
        
        // Table rows
        let y = doc.y;
        attendees.forEach((attendee, index) => {
          const bgColor = index % 2 === 0 ? '#F5F5F5' : '#FFFFFF';
          
          doc.fillColor(bgColor)
             .rect(50, y, 500, 25)
             .fill();
          
          doc.fillColor('#000000')
             .fontSize(10)
             .font('Helvetica')
             .text(attendee.name, 60, y + 8);
          doc.text(attendee.role, 200, y + 8);
          doc.text(attendee.status.charAt(0).toUpperCase() + attendee.status.slice(1), 300, y + 8);
          doc.text(attendee.time || 'N/A', 400, y + 8);
          
          y += 25;
        });
        
        doc.y = y + 10;
      }

      // Agenda
      if (meeting.agenda && meeting.agenda.length > 0) {
        doc.addPage();
        doc.fillColor('#000000')
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('AGENDA ITEMS', { underline: true });
        
        doc.moveDown(0.5);
        
        meeting.agenda.forEach((item, index) => {
          doc.fillColor('#0066CC')
             .fontSize(12)
             .font('Helvetica-Bold')
             .text(`${item.id}. ${item.title}`);
          
          doc.fillColor('#666666')
             .fontSize(10)
             .font('Helvetica')
             .text(`Presenter: ${item.presenter} | Duration: ${item.duration} mins | Status: ${item.status}`);
          
          if (item.description) {
            doc.fillColor('#000000')
               .fontSize(10)
               .text(item.description);
          }
          
          doc.moveDown(0.5);
        });
      }

      // Decisions
      if (meeting.minutes?.decisions && meeting.minutes.decisions.length > 0) {
        doc.addPage();
        doc.fillColor('#000000')
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('DECISIONS MADE', { underline: true });
        
        doc.moveDown(0.5);
        
        meeting.minutes.decisions.forEach((decision, index) => {
          doc.fillColor('#000000')
             .fontSize(11)
             .font('Helvetica')
             .text(`${index + 1}. ${decision}`);
          doc.moveDown(0.3);
        });
      }

      // Action Items
      if (meeting.minutes?.actionItems && meeting.minutes.actionItems.length > 0) {
        doc.addPage();
        doc.fillColor('#000000')
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('ACTION ITEMS', { underline: true });
        
        doc.moveDown(0.5);
        
        // Table header
        doc.fillColor('#FFFFFF')
           .rect(50, doc.y, 500, 25)
           .fill('#009999');
        
        doc.fillColor('#FFFFFF')
           .fontSize(11)
           .font('Helvetica-Bold')
           .text('Task', 60, doc.y - 20);
        doc.text('Assignee', 200, doc.y - 20);
        doc.text('Deadline', 300, doc.y - 20);
        doc.text('Status', 400, doc.y - 20);
        doc.text('Priority', 480, doc.y - 20);
        
        doc.moveDown(2);
        
        // Table rows
        let y = doc.y;
        meeting.minutes.actionItems.forEach((item, index) => {
          const bgColor = index % 2 === 0 ? '#F5F5F5' : '#FFFFFF';
          
          doc.fillColor(bgColor)
             .rect(50, y, 500, 25)
             .fill();
          
          doc.fillColor('#000000')
             .fontSize(9)
             .font('Helvetica')
             .text(item.task.substring(0, 40) + (item.task.length > 40 ? '...' : ''), 60, y + 8);
          doc.text(item.assignee, 200, y + 8);
          doc.text(moment(item.deadline).format('MMM DD'), 300, y + 8);
          doc.text(item.status, 400, y + 8);
          
          // Priority color coding
          const priorityColors = {
            'high': '#FF0000',
            'medium': '#FF9800',
            'low': '#4CAF50',
            'critical': '#9C27B0'
          };
          
          doc.fillColor(priorityColors[item.priority] || '#000000')
             .text(item.priority.toUpperCase(), 480, y + 8);
          
          y += 25;
        });
      }

      // Next Meeting
      if (meeting.minutes?.nextMeeting) {
        doc.addPage();
        doc.fillColor('#000000')
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('NEXT MEETING', { underline: true });
        
        doc.moveDown(1);
        doc.fontSize(11)
           .font('Helvetica');
        
        const nextMeeting = meeting.minutes.nextMeeting;
        const nextDetails = [
          ['Date:', moment(nextMeeting.date).format('dddd, MMMM DD, YYYY')],
          ['Time:', nextMeeting.time],
          ['Venue:', nextMeeting.venue],
          ['Agenda:', nextMeeting.agenda]
        ];
        
        nextDetails.forEach(([label, value]) => {
          doc.text(label, 50, doc.y);
          doc.text(value, 150, doc.y);
          doc.moveDown(0.8);
        });
      }

      // Signatures
      doc.addPage();
      doc.fillColor('#000000')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('SIGNATURES', { align: 'center', underline: true });
      
      doc.moveDown(3);
      
      // Prepared by
      doc.fontSize(11)
         .font('Helvetica')
         .text('Prepared by:', 100, doc.y, { width: 200, align: 'center' });
      
      doc.moveDown(3);
      doc.moveTo(100, doc.y)
         .lineTo(300, doc.y)
         .strokeColor('#000000')
         .lineWidth(1)
         .stroke();
      
      doc.moveDown(0.5);
      doc.text(meeting.minutesTaker || 'Secretary', { width: 200, align: 'center' });
      doc.text('SIT Student Council', { width: 200, align: 'center' });
      
      // Approved by
      doc.moveDown(2);
      doc.text('Approved by:', 350, doc.y - 120, { width: 200, align: 'center' });
      
      doc.moveDown(3);
      doc.moveTo(350, doc.y - 120)
         .lineTo(550, doc.y - 120)
         .strokeColor('#000000')
         .lineWidth(1)
         .stroke();
      
      doc.moveDown(0.5);
      doc.text(meeting.chairperson || 'President', 350, doc.y - 110, { width: 200, align: 'center' });
      doc.text('SIT Student Council', 350, doc.y - 100, { width: 200, align: 'center' });

      // Footer
      doc.page.margins.bottom = 50;
      const bottom = doc.page.height - doc.page.margins.bottom;
      
      doc.fontSize(8)
         .fillColor('#666666')
         .text('SIT Student Council Management System v2.0 | Confidential Document | Generated by SBC System', 
               50, bottom, { align: 'center', width: 500 });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Generate performance report PDF
const generatePerformanceReportPDF = async (users, period) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `SIT Council Performance Report - ${period}`,
          Author: 'SIT Student Council',
          Subject: 'Performance Analysis',
          Keywords: 'SIT, Student Council, Performance, Report',
          Creator: 'SIT Council Management System v2.0',
          CreationDate: new Date()
        }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Header
      doc.fillColor('#0066CC')
         .fontSize(20)
         .font('Helvetica-Bold')
         .text('SIT STUDENT COUNCIL', { align: 'center' });
      
      doc.moveDown(0.5);
      doc.fillColor('#009999')
         .fontSize(16)
         .text('PERFORMANCE REPORT', { align: 'center' });
      
      doc.moveDown(0.5);
      doc.fillColor('#FF6600')
         .fontSize(12)
         .text(period.toUpperCase(), { align: 'center' });
      
      doc.moveDown(1);
      doc.fillColor('#666666')
         .fontSize(10)
         .text(`Generated: ${moment().format('MMMM DD, YYYY hh:mm A')}`, { align: 'center' });
      
      // Summary
      doc.moveDown(2);
      doc.fillColor('#000000')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('PERFORMANCE SUMMARY', { underline: true });
      
      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica');
      
      const totalMembers = users.length;
      const avgAttendance = users.reduce((acc, user) => acc + (user.performance?.attendanceRate || 0), 0) / totalMembers;
      const avgTasks = users.reduce((acc, user) => acc + (user.performance?.tasksCompleted || 0), 0) / totalMembers;
      
      const summary = [
        ['Total Council Members:', totalMembers.toString()],
        ['Average Attendance Rate:', `${avgAttendance.toFixed(1)}%`],
        ['Average Tasks Completed:', avgTasks.toFixed(1)],
        ['Report Period:', period],
        ['Generated By:', 'SIT Council Management System']
      ];
      
      summary.forEach(([label, value]) => {
        doc.text(label, 50, doc.y);
        doc.text(value, 200, doc.y);
        doc.moveDown(0.5);
      });

      // Leaderboard
      doc.addPage();
      doc.fillColor('#000000')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('TOP PERFORMERS', { align: 'center', underline: true });
      
      doc.moveDown(1);
      
      // Sort users by performance
      const sortedUsers = [...users].sort((a, b) => 
        (b.performance?.rating || 0) - (a.performance?.rating || 0)
      ).slice(0, 10);
      
      // Table header
      doc.fillColor('#FFFFFF')
         .rect(50, doc.y, 500, 25)
         .fill('#0066CC');
      
      doc.fillColor('#FFFFFF')
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('Rank', 60, doc.y - 20);
      doc.text('Name', 100, doc.y - 20);
      doc.text('Role', 250, doc.y - 20);
      doc.text('Attendance', 350, doc.y - 20);
      doc.text('Tasks', 420, doc.y - 20);
      doc.text('Score', 480, doc.y - 20);
      
      doc.moveDown(2);
      
      // Table rows
      let y = doc.y;
      sortedUsers.forEach((user, index) => {
        const bgColor = index % 2 === 0 ? '#F5F5F5' : '#FFFFFF';
        
        doc.fillColor(bgColor)
           .rect(50, y, 500, 25)
           .fill();
        
        // Rank with badge for top 3
        if (index < 3) {
          const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
          doc.fillColor(rankColors[index])
             .circle(70, y + 12, 8)
             .fill();
          doc.fillColor('#000000')
             .fontSize(9)
             .font('Helvetica-Bold')
             .text((index + 1).toString(), 67, y + 9);
        } else {
          doc.fillColor('#000000')
             .fontSize(10)
             .font('Helvetica')
             .text((index + 1).toString(), 60, y + 8);
        }
        
        doc.fillColor('#000000')
           .fontSize(10)
           .font('Helvetica')
           .text(user.name, 100, y + 8);
        doc.text(user.role, 250, y + 8);
        doc.text(`${user.performance?.attendanceRate || 0}%`, 350, y + 8);
        doc.text(user.performance?.tasksCompleted || 0, 420, y + 8);
        doc.text(`${user.performance?.rating || 0}%`, 480, y + 8);
        
        y += 25;
      });

      // Performance distribution
      doc.addPage();
      doc.fillColor('#000000')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('PERFORMANCE DISTRIBUTION', { align: 'center', underline: true });
      
      doc.moveDown(1);
      
      const performanceRanges = [
        { range: '90-100%', count: 0, color: '#4CAF50' },
        { range: '80-89%', count: 0, color: '#8BC34A' },
        { range: '70-79%', count: 0, color: '#FFC107' },
        { range: '60-69%', count: 0, color: '#FF9800' },
        { range: 'Below 60%', count: 0, color: '#F44336' }
      ];
      
      // Count users in each range
      users.forEach(user => {
        const rating = user.performance?.rating || 0;
        if (rating >= 90) performanceRanges[0].count++;
        else if (rating >= 80) performanceRanges[1].count++;
        else if (rating >= 70) performanceRanges[2].count++;
        else if (rating >= 60) performanceRanges[3].count++;
        else performanceRanges[4].count++;
      });
      
      let chartY = doc.y;
      const maxCount = Math.max(...performanceRanges.map(r => r.count));
      const barWidth = 400;
      
      performanceRanges.forEach((range, index) => {
        const barHeight = 20;
        const barLength = (range.count / maxCount) * barWidth;
        
        // Bar
        doc.fillColor(range.color)
           .rect(100, chartY, barLength, barHeight)
           .fill();
        
        // Range label
        doc.fillColor('#000000')
           .fontSize(10)
           .font('Helvetica')
           .text(range.range, 50, chartY + 5);
        
        // Count label
        doc.fillColor('#000000')
           .fontSize(10)
           .font('Helvetica')
           .text(range.count.toString(), barLength + 110, chartY + 5);
        
        chartY += 30;
      });
      
      doc.moveDown(2);
      
      // Recommendations
      doc.fillColor('#000000')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('RECOMMENDATIONS:', { underline: true });
      
      doc.moveDown(0.5);
      doc.fontSize(10)
         .font('Helvetica')
         .text('1. Recognize top performers with awards and certificates', 50, doc.y);
      doc.text('2. Provide additional support to members below 70% performance', 50, doc.y + 15);
      doc.text('3. Organize training sessions to improve skills', 50, doc.y + 30);
      doc.text('4. Review and adjust task allocation for better balance', 50, doc.y + 45);

      // Footer
      doc.page.margins.bottom = 50;
      const bottom = doc.page.height - doc.page.margins.bottom;
      
      doc.fontSize(8)
         .fillColor('#666666')
         .text('SIT Student Council Management System v2.0 | Confidential Performance Report | Generated by SBC System', 
               50, bottom, { align: 'center', width: 500 });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Generate council roster PDF
const generateCouncilRosterPDF = async (members) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: 'SIT Student Council Roster',
          Author: 'SIT Student Council',
          Subject: 'Official Council Membership List',
          Keywords: 'SIT, Student Council, Roster, Members',
          Creator: 'SIT Council Management System v2.0',
          CreationDate: new Date()
        }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Header
      doc.fillColor('#0066CC')
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('SIT STUDENT COUNCIL', { align: 'center' });
      
      doc.moveDown(0.3);
      doc.fillColor('#009999')
         .fontSize(18)
         .text('OFFICIAL COUNCIL ROSTER', { align: 'center' });
      
      doc.moveDown(1);
      doc.fillColor('#666666')
         .fontSize(10)
         .text(`Generated: ${moment().format('MMMM DD, YYYY')} | Total Members: ${members.length}`, { align: 'center' });
      
      doc.moveDown(2);

      // Members by role
      const roles = ['President', 'Vice President', 'Secretary', 'Treasurer', 'Member'];
      
      roles.forEach(role => {
        const roleMembers = members.filter(m => m.role === role);
        if (roleMembers.length > 0) {
          doc.fillColor('#000000')
             .fontSize(14)
             .font('Helvetica-Bold')
             .text(role.toUpperCase(), { underline: true });
          
          doc.moveDown(0.5);
          
          roleMembers.forEach((member, index) => {
            const bgColor = index % 2 === 0 ? '#F5F5F5' : '#FFFFFF';
            const y = doc.y;
            
            // Member card background
            doc.fillColor(bgColor)
               .rect(50, y, 500, 60)
               .fill();
            
            // Left border for role color
            const roleColors = {
              'President': '#FF6600',
              'Vice President': '#009999',
              'Secretary': '#0066CC',
              'Treasurer': '#9933CC',
              'Member': '#666666'
            };
            
            doc.fillColor(roleColors[role] || '#666666')
               .rect(50, y, 5, 60)
               .fill();
            
            // Member info
            doc.fillColor('#000000')
               .fontSize(12)
               .font('Helvetica-Bold')
               .text(member.name, 70, y + 10);
            
            doc.fontSize(10)
               .font('Helvetica')
               .text(`ID: ${member.studentId}`, 70, y + 25);
            doc.text(`Email: ${member.email}`, 70, y + 38);
            doc.text(`Department: ${member.department}`, 300, y + 25);
            doc.text(`Joined: ${moment(member.joinDate).format('MMM YYYY')}`, 300, y + 38);
            
            // Performance
            doc.fillColor('#666666')
               .fontSize(9)
               .text(`Attendance: ${member.performance?.attendanceRate || 0}% | Tasks: ${member.performance?.tasksCompleted || 0} | Score: ${member.performance?.rating || 0}%`, 
                     70, y + 50);
            
            doc.moveDown(1.2);
          });
          
          doc.moveDown(1);
        }
      });

      // Contact Information
      doc.addPage();
      doc.fillColor('#000000')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('COUNCIL CONTACT INFORMATION', { align: 'center', underline: true });
      
      doc.moveDown(1);
      
      // Controller contacts
      doc.fillColor('#FF6600')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('SYSTEM CONTROLLERS:', 50, doc.y);
      
      doc.moveDown(0.5);
      doc.fillColor('#000000')
         .fontSize(10)
         .font('Helvetica')
         .text('1. xaahaa12@gmail.com', 70, doc.y);
      doc.text('2. tahir.h.bedane@gmail.com', 70, doc.y + 15);
      doc.text('3. tahirhasan432@gmail.com', 70, doc.y + 30);
      
      doc.moveDown(2);
      
      // Emergency contacts
      doc.fillColor('#F44336')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('EMERGENCY CONTACTS:', 50, doc.y);
      
      doc.moveDown(0.5);
      doc.fillColor('#000000')
         .fontSize(10)
         .font('Helvetica')
         .text('• Dean of Students Office: +251-XXX-XXXX', 70, doc.y);
      doc.text('• Student Affairs: +251-XXX-XXXX', 70, doc.y + 15);
      doc.text('• Campus Security: +251-XXX-XXXX', 70, doc.y + 30);
      
      // Footer
      doc.page.margins.bottom = 50;
      const bottom = doc.page.height - doc.page.margins.bottom;
      
      doc.fontSize(8)
         .fillColor('#666666')
         .text('SIT Student Council Management System v2.0 | Confidential Document | For Official Use Only', 
               50, bottom, { align: 'center', width: 500 });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generateMeetingMinutesPDF,
  generatePerformanceReportPDF,
  generateCouncilRosterPDF
};
