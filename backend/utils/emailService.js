const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify transporter
transporter.verify((error, success) => {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('Email service ready:', success);
  }
});

// Send meeting invitation
const sendMeetingInvitation = async (meeting, attendees) => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0066CC 0%, #009999 100%); 
                   color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .meeting-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; 
                           border-left: 5px solid #FF6600; }
          .btn { display: inline-block; background: #0066CC; color: white; 
                padding: 12px 30px; text-decoration: none; border-radius: 5px; 
                font-weight: bold; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📅 SIT Student Council Meeting</h1>
            <p>Official Meeting Invitation</p>
          </div>
          <div class="content">
            <h2>${meeting.title}</h2>
            <div class="meeting-details">
              <p><strong>📅 Date:</strong> ${meeting.date}</p>
              <p><strong>⏰ Time:</strong> ${meeting.startTime} - ${meeting.endTime}</p>
              <p><strong>📍 Venue:</strong> ${meeting.venue}</p>
              <p><strong>👨‍💼 Chairperson:</strong> ${meeting.chairperson}</p>
              <p><strong>📝 Type:</strong> ${meeting.type}</p>
            </div>
            <p><strong>Objective:</strong> ${meeting.objective || 'No objective specified'}</p>
            <p>Please make sure to attend the meeting on time. Your presence is important.</p>
            <a href="${process.env.FRONTEND_URL}/meeting/${meeting._id}" class="btn">
              View Meeting Details
            </a>
            <p style="margin-top: 30px; font-size: 12px; color: #666;">
              This is an automated message from SIT Student Council Management System.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: attendees.map(a => a.email).join(', '),
      subject: `Meeting Invitation: ${meeting.title}`,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    console.log(`Meeting invitation sent to ${attendees.length} attendees`);
    
    return true;
  } catch (error) {
    console.error('Error sending meeting invitation:', error);
    return false;
  }
};

// Send meeting minutes
const sendMeetingMinutes = async (meeting, attendees) => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #009999 0%, #0066CC 100%); 
                   color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .minutes { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .action-item { background: #f0f8ff; padding: 10px; margin: 10px 0; border-left: 3px solid #0066CC; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 Meeting Minutes Published</h1>
            <p>Official Meeting Record</p>
          </div>
          <div class="content">
            <h2>${meeting.title}</h2>
            <div class="minutes">
              <p><strong>Summary:</strong> ${meeting.minutes?.summary || 'No summary available'}</p>
              
              ${meeting.minutes?.decisions?.length > 0 ? `
                <h3>Decisions Made:</h3>
                <ul>
                  ${meeting.minutes.decisions.map(decision => `<li>${decision}</li>`).join('')}
                </ul>
              ` : ''}
              
              ${meeting.minutes?.actionItems?.length > 0 ? `
                <h3>Action Items:</h3>
                ${meeting.minutes.actionItems.map(item => `
                  <div class="action-item">
                    <p><strong>${item.task}</strong></p>
                    <p>Assignee: ${item.assignee} | Deadline: ${item.deadline}</p>
                  </div>
                `).join('')}
              ` : ''}
            </div>
            <a href="${process.env.FRONTEND_URL}/meeting/minutes/${meeting._id}" class="btn">
              View Complete Minutes
            </a>
            <p style="margin-top: 30px; font-size: 12px; color: #666;">
              This is an automated message from SIT Student Council Management System.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: attendees.map(a => a.email).join(', '),
      subject: `Meeting Minutes: ${meeting.title}`,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    console.log(`Meeting minutes sent to ${attendees.length} attendees`);
    
    return true;
  } catch (error) {
    console.error('Error sending meeting minutes:', error);
    return false;
  }
};

// Send password reset email
const sendPasswordResetEmail = async (user, resetToken) => {
  try {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF6600; color: white; padding: 20px; text-align: center; border-radius: 10px; }
          .content { background: #f9f9f9; padding: 30px; margin-top: 20px; border-radius: 10px; }
          .btn { display: inline-block; background: #0066CC; color: white; 
                padding: 12px 30px; text-decoration: none; border-radius: 5px; 
                font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${user.name},</h2>
            <p>We received a request to reset your password for the SIT Student Council Management System.</p>
            <p>Click the button below to reset your password:</p>
            <a href="${resetUrl}" class="btn">Reset Password</a>
            <p style="margin-top: 20px;">This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <p style="margin-top: 30px; font-size: 12px; color: #666;">
              This is an automated message from SIT Student Council Management System.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject: 'SIT Council - Password Reset Request',
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${user.email}`);
    
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
};

// Send welcome email
const sendWelcomeEmail = async (user, tempPassword) => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0066CC 0%, #009999 100%); 
                   color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; 
                       border-left: 5px solid #FF6600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to SIT Student Council!</h1>
          </div>
          <div class="content">
            <h2>Hello ${user.name},</h2>
            <p>Welcome to the SIT Student Council Management System! You have been added as a council member.</p>
            
            <div class="credentials">
              <h3>Your Login Credentials:</h3>
              <p><strong>Email:</strong> ${user.email}</p>
              <p><strong>Student ID:</strong> ${user.studentId}</p>
              <p><strong>Temporary Password:</strong> ${tempPassword}</p>
              <p><strong>Role:</strong> ${user.role}</p>
            </div>
            
            <p>Please login and change your password immediately for security.</p>
            <a href="${process.env.FRONTEND_URL}/login" class="btn">
              Login to Portal
            </a>
            
            <p style="margin-top: 30px; font-size: 12px; color: #666;">
              <strong>Note:</strong> For security reasons, please change your password after first login.<br>
              This is an automated message from SIT Student Council Management System.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject: 'Welcome to SIT Student Council Management System',
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent to ${user.email}`);
    
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
};

module.exports = {
  sendMeetingInvitation,
  sendMeetingMinutes,
  sendPasswordResetEmail,
  sendWelcomeEmail
};
