const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for now
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sit_council', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Error:', err));

// User Model
const userSchema = new mongoose.Schema({
  studentId: { type: String, unique: true },
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: 'Member' },
  avatar: String,
  avatarColor: String,
  department: String,
  phone: String,
  status: { type: String, default: 'active' },
  performance: {
    meetingsAttended: { type: Number, default: 0 },
    tasksCompleted: { type: Number, default: 0 },
    rating: { type: Number, default: 0 }
  }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

// Meeting Model
const meetingSchema = new mongoose.Schema({
  meetingId: String,
  title: String,
  type: { type: String, default: 'regular' },
  date: Date,
  startTime: String,
  endTime: String,
  venue: String,
  chairperson: String,
  minutesTaker: String,
  objective: String,
  agenda: [{
    id: Number,
    title: String,
    presenter: String,
    duration: Number,
    status: String
  }],
  attendees: [{
    user: String,
    name: String,
    role: String,
    status: String,
    time: String
  }],
  minutes: {
    summary: String,
    decisions: [String],
    actionItems: [{
      id: Number,
      task: String,
      assignee: String,
      deadline: Date,
      status: String,
      priority: String
    }],
    nextMeeting: {
      date: Date,
      time: String,
      venue: String,
      agenda: String
    }
  },
  status: { type: String, default: 'scheduled' },
  archived: { type: Boolean, default: false },
  published: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Meeting = mongoose.model('Meeting', meetingSchema);

// Chat Model
const chatSchema = new mongoose.Schema({
  discussionId: String,
  title: String,
  description: String,
  messages: [{
    sender: String,
    senderName: String,
    senderRole: String,
    message: String,
    timestamp: { type: Date, default: Date.now }
  }],
  lastMessageAt: { type: Date, default: Date.now }
});

const Chat = mongoose.model('Chat', chatSchema);

// ==================== ROUTES ====================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'SIT Council API is running',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, studentId } = req.body;
    
    // Check controller emails
    const controllerEmails = process.env.CONTROLLER_EMAILS?.split(',') || [
      'xaahaa12@gmail.com',
      'tahir.h.bedane@gmail.com',
      'tahirhasan432@gmail.com'
    ];
    
    let user;
    
    if (controllerEmails.includes(email)) {
      // Controller login
      user = await User.findOne({ email });
      if (!user) {
        // Create controller user if doesn't exist
        user = await User.create({
          studentId: 'CONTROLLER-001',
          name: 'System Controller',
          email: email,
          password: 'controller123',
          role: 'Controller',
          avatar: 'CT',
          avatarColor: '#FF6600',
          department: 'Administration',
          phone: '+251900000000'
        });
      }
    } else {
      // Regular user login
      user = await User.findOne({ email, studentId });
      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid credentials'
        });
      }
    }
    
    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }
    
    // Generate token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'sit_council_secret_2026',
      { expiresIn: '7d' }
    );
    
    res.json({
      status: 'success',
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          studentId: user.studentId,
          role: user.role,
          avatar: user.avatar,
          avatarColor: user.avatarColor,
          performance: user.performance
        }
      }
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Login failed',
      error: error.message
    });
  }
});

// Get current user
app.get('/api/auth/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sit_council_secret_2026');
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      status: 'success',
      data: user
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Seed initial data
app.post('/api/seed', async (req, res) => {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Meeting.deleteMany({});
    await Chat.deleteMany({});
    
    // Create initial users
    const initialUsers = [
      {
        studentId: 'SIT-ST-2029-00123',
        name: 'Tahir Hasan',
        email: 'tahir.h.bedane@sit.edu',
        password: 'secretary123',
        role: 'Secretary',
        avatar: 'TH',
        avatarColor: '#0066CC',
        department: 'Computer Science',
        phone: '+251912345678',
        performance: {
          meetingsAttended: 45,
          tasksCompleted: 89,
          rating: 98
        }
      },
      {
        studentId: 'SIT-ST-2029-00124',
        name: 'Ibrahim Mohammed',
        email: 'ibrahim@sit.edu',
        password: 'president123',
        role: 'President',
        avatar: 'IM',
        avatarColor: '#009999',
        department: 'Business Administration',
        phone: '+251912345679',
        performance: {
          meetingsAttended: 42,
          tasksCompleted: 76,
          rating: 95
        }
      }
    ];
    
    await User.insertMany(initialUsers);
    
    // Create initial meetings
    const initialMeetings = [
      {
        meetingId: 'SC-2025-11-001',
        title: 'Taking responsibilities of members of the students council officially',
        type: 'regular',
        date: new Date('2025-11-04'),
        startTime: '11:40',
        endTime: '12:40',
        venue: 'SIT Administration Meeting Room',
        chairperson: 'Ibrahim Mohammed',
        minutesTaker: 'Tahir Hasan',
        objective: 'Official handover of responsibilities to new council members',
        status: 'completed',
        archived: true,
        published: true
      }
    ];
    
    await Meeting.insertMany(initialMeetings);
    
    // Create initial chat
    await Chat.create({
      discussionId: 'general',
      title: 'General Council Chat',
      description: 'Main discussion channel for all council members',
      messages: [
        {
          sender: 'SIT-ST-2029-00123',
          senderName: 'Tahir Hasan',
          senderRole: 'Secretary',
          message: 'Welcome everyone to the official SIT Council Chat!'
        }
      ]
    });
    
    res.json({
      status: 'success',
      message: 'Database seeded successfully'
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to seed database',
      error: error.message
    });
  }
});

// Get all meetings
app.get('/api/meetings', async (req, res) => {
  try {
    const meetings = await Meeting.find().sort({ date: -1 });
    res.json({
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

// Create meeting
app.post('/api/meetings', async (req, res) => {
  try {
    const meeting = await Meeting.create(req.body);
    res.status(201).json({
      status: 'success',
      message: 'Meeting created successfully',
      data: meeting
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to create meeting',
      error: error.message
    });
  }
});

// Get chat messages
app.get('/api/chat/discussions', async (req, res) => {
  try {
    const discussions = await Chat.find();
    res.json({
      status: 'success',
      data: discussions
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch discussions',
      error: error.message
    });
  }
});

// Send chat message
app.post('/api/chat/discussions/:id/messages', async (req, res) => {
  try {
    const { message, sender, senderName, senderRole } = req.body;
    
    const chat = await Chat.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    chat.messages.push({
      sender,
      senderName,
      senderRole,
      message,
      timestamp: new Date()
    });
    
    chat.lastMessageAt = new Date();
    await chat.save();
    
    res.json({
      status: 'success',
      message: 'Message sent successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to send message',
      error: error.message
    });
  }
});

// Get members
app.get('/api/members', async (req, res) => {
  try {
    const members = await User.find().select('-password');
    res.json({
      status: 'success',
      count: members.length,
      data: members
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch members',
      error: error.message
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 SIT Student Council Management System v2.0.0`);
});
