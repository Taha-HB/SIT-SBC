const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sit_council', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Create indexes for better performance
    await mongoose.connection.db.collection('users').createIndex({ email: 1 }, { unique: true });
    await mongoose.connection.db.collection('users').createIndex({ studentId: 1 }, { unique: true });
    await mongoose.connection.db.collection('meetings').createIndex({ meetingId: 1 }, { unique: true });
    await mongoose.connection.db.collection('meetings').createIndex({ date: 1 });
    await mongoose.connection.db.collection('meetings').createIndex({ status: 1 });
    
    console.log('📊 Database indexes created successfully');
    
    // Seed initial data if needed
    await seedInitialData();
    
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

// Seed initial data
const seedInitialData = async () => {
  try {
    const User = require('../models/User');
    const Meeting = require('../models/Meeting');
    const Performance = require('../models/Member');
    const Chat = require('../models/Chat');
    
    // Check if we need to seed data
    const userCount = await User.countDocuments();
    
    if (userCount === 0) {
      console.log('🌱 Seeding initial data...');
      
      // Create controller user
      const controllerUser = await User.create({
        studentId: 'CONTROLLER-001',
        name: 'System Controller',
        email: process.env.CONTROLLER_EMAILS?.split(',')[0] || 'xaahaa12@gmail.com',
        password: 'Controller123!',
        role: 'Controller',
        position: 'System Administrator',
        department: 'Administration',
        phone: '+251900000000',
        avatar: 'CT',
        avatarColor: '#FF6600',
        isController: true,
        status: 'active'
      });
      
      // Create council members (as in frontend database)
      const councilMembers = [
        {
          studentId: 'SIT-ST-2029-00123',
          name: 'Tahir Hasan',
          email: 'tahir.h.bedane@sit.edu',
          password: 'secretary123',
          role: 'Secretary',
          position: 'Secretary',
          department: 'Computer Science',
          phone: '+251912345678',
          avatar: 'TH',
          avatarColor: '#0066CC',
          performance: {
            meetingsAttended: 45,
            tasksCompleted: 89,
            rating: 98,
            streak: 12,
            points: 1250
          }
        },
        {
          studentId: 'SIT-ST-2029-00124',
          name: 'Ibrahim Mohammed',
          email: 'ibrahim@sit.edu',
          password: 'president123',
          role: 'President',
          position: 'President',
          department: 'Business Administration',
          phone: '+251912345679',
          avatar: 'IM',
          avatarColor: '#009999',
          performance: {
            meetingsAttended: 42,
            tasksCompleted: 76,
            rating: 95,
            streak: 8,
            points: 1100
          }
        },
        {
          studentId: 'SIT-ST-2029-00125',
          name: 'Asli Ahmed',
          email: 'asli@sit.edu',
          password: 'vicepresident123',
          role: 'Vice President',
          position: 'Vice President',
          department: 'Engineering',
          phone: '+251912345680',
          avatar: 'AA',
          avatarColor: '#FF6600',
          performance: {
            meetingsAttended: 38,
            tasksCompleted: 65,
            rating: 92,
            streak: 6,
            points: 980
          }
        },
        {
          studentId: 'SIT-ST-2029-00126',
          name: 'Fatima Ali',
          email: 'fatima@sit.edu',
          password: 'treasurer123',
          role: 'Treasurer',
          position: 'Treasurer',
          department: 'Finance',
          phone: '+251912345681',
          avatar: 'FA',
          avatarColor: '#9933CC',
          performance: {
            meetingsAttended: 40,
            tasksCompleted: 72,
            rating: 94,
            streak: 10,
            points: 1050
          }
        }
      ];
      
      // Create council members
      const createdMembers = await User.insertMany(councilMembers);
      
      // Create performance records
      for (const member of createdMembers) {
        await Performance.create({
          user: member._id,
          metrics: {
            totalMeetings: member.performance.meetingsAttended + 10,
            meetingsAttended: member.performance.meetingsAttended,
            attendanceRate: 95,
            totalTasks: member.performance.tasksCompleted + 15,
            tasksCompleted: member.performance.tasksCompleted,
            completionRate: 90,
            averageScore: member.performance.rating,
            currentStreak: member.performance.streak,
            bestStreak: member.performance.streak + 5
          },
          points: {
            total: member.performance.points,
            breakdown: {
              attendance: Math.floor(member.performance.points * 0.4),
              taskCompletion: Math.floor(member.performance.points * 0.4),
              leadership: Math.floor(member.performance.points * 0.1),
              teamwork: Math.floor(member.performance.points * 0.05),
              initiative: Math.floor(member.performance.points * 0.05)
            }
          }
        });
      }
      
      // Create general chat discussion
      await Chat.create({
        discussionId: 'general',
        title: 'General Council Chat',
        description: 'Main discussion channel for all council members',
        participants: createdMembers.map(m => m._id),
        messages: [
          {
            sender: createdMembers[0]._id,
            message: 'Welcome everyone to the official SIT Council Chat! This is our communication hub for all council-related discussions.',
            timestamp: new Date('2023-11-29T10:00:00Z')
          },
          {
            sender: createdMembers[1]._id,
            message: 'Great initiative! Let\'s use this platform effectively for better coordination and quick decision making.',
            timestamp: new Date('2023-11-29T10:05:00Z')
          }
        ],
        isPinned: true,
        isArchived: false,
        unreadCount: 0,
        lastMessageAt: new Date('2023-11-29T10:05:00Z')
      });
      
      console.log('✅ Initial data seeded successfully');
    }
  } catch (error) {
    console.error('❌ Error seeding initial data:', error);
  }
};

module.exports = connectDB;
