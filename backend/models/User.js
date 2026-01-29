const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: [true, 'Please provide student ID'],
    unique: true,
    match: [/^SIT-ST-202[0-9]-00\d{3}$/, 'Please provide valid SIT student ID']
  },
  name: {
    type: String,
    required: [true, 'Please provide name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide email'],
    unique: true,
    match: [
      /^[a-zA-Z0-9._%+-]+@sit\.edu$/,
      'Please provide a valid SIT email address'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please provide password'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['President', 'Vice President', 'Secretary', 'Treasurer', 'PRO', 'Coordinator', 'Member', 'Controller'],
    default: 'Member'
  },
  position: {
    type: String,
    required: [true, 'Please provide position']
  },
  department: {
    type: String,
    required: [true, 'Please provide department'],
    enum: ['Computer Science', 'Business Administration', 'Engineering', 'Finance', 'Arts', 'Science', 'Administration']
  },
  phone: {
    type: String,
    match: [/^\+251[0-9]{9}$/, 'Please provide valid Ethiopian phone number']
  },
  avatar: {
    type: String,
    default: function() {
      return this.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }
  },
  avatarColor: {
    type: String,
    default: '#0066CC'
  },
  avatarUrl: {
    type: String
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  joinDate: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  },
  performance: {
    meetingsAttended: {
      type: Number,
      default: 0
    },
    tasksCompleted: {
      type: Number,
      default: 0
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    streak: {
      type: Number,
      default: 0
    },
    achievements: [{
      type: String
    }],
    points: {
      type: Number,
      default: 0
    },
    manOfWeek: {
      type: Number,
      default: 0
    },
    manOfMonth: {
      type: Number,
      default: 0
    }
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      chat: {
        type: Boolean,
        default: true
      },
      meeting: {
        type: Boolean,
        default: true
      }
    },
    autoSave: {
      type: Boolean,
      default: true
    }
  },
  isController: {
    type: Boolean,
    default: false
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  emailVerificationToken: String,
  emailVerified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Encrypt password using bcrypt
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and return
userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role, studentId: this.studentId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate password reset token
userSchema.methods.getResetPasswordToken = function() {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

// Update last login
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = Date.now();
  return this.save();
};

// Get user initials for avatar
userSchema.methods.getInitials = function() {
  return this.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

// Check if user is controller
userSchema.methods.isControllerUser = function() {
  return this.isController || this.role === 'Controller';
};

// Update performance
userSchema.methods.updatePerformance = async function(meetings = 0, tasks = 0) {
  this.performance.meetingsAttended += meetings;
  this.performance.tasksCompleted += tasks;
  
  // Calculate new rating
  const meetingsScore = Math.min(this.performance.meetingsAttended * 2, 40);
  const tasksScore = Math.min(this.performance.tasksCompleted * 1.5, 40);
  const streakScore = Math.min(this.performance.streak * 0.5, 20);
  
  this.performance.rating = Math.round(meetingsScore + tasksScore + streakScore);
  
  // Update streak if attended meeting
  if (meetings > 0) {
    this.performance.streak += 1;
  }
  
  // Add points
  this.performance.points += (meetings * 10) + (tasks * 5);
  
  await this.save();
  return this;
};

module.exports = mongoose.model('User', userSchema);
