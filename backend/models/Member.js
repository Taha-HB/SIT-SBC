const mongoose = require('mongoose');

const performanceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  // Meeting attendance
  meetings: [{
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meeting'
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'excused']
    },
    attendanceTime: String,
    participationScore: {
      type: Number,
      min: 0,
      max: 10
    }
  }],
  
  // Tasks and action items
  tasks: [{
    taskId: String,
    description: String,
    assignedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meeting'
    },
    deadline: Date,
    completedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'overdue']
    },
    priority: String,
    notes: String
  }],
  
  // Performance metrics
  metrics: {
    totalMeetings: {
      type: Number,
      default: 0
    },
    meetingsAttended: {
      type: Number,
      default: 0
    },
    attendanceRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    totalTasks: {
      type: Number,
      default: 0
    },
    tasksCompleted: {
      type: Number,
      default: 0
    },
    completionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    averageScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    currentStreak: {
      type: Number,
      default: 0
    },
    bestStreak: {
      type: Number,
      default: 0
    }
  },
  
  // Awards and recognitions
  awards: [{
    title: String,
    description: String,
    type: {
      type: String,
      enum: ['man_of_week', 'man_of_month', 'excellence', 'leadership', 'teamwork']
    },
    awardedAt: Date,
    awardedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Points system
  points: {
    total: {
      type: Number,
      default: 0
    },
    breakdown: {
      attendance: {
        type: Number,
        default: 0
      },
      taskCompletion: {
        type: Number,
        default: 0
      },
      leadership: {
        type: Number,
        default: 0
      },
      teamwork: {
        type: Number,
        default: 0
      },
      initiative: {
        type: Number,
        default: 0
      }
    }
  },
  
  // Statistics
  statistics: {
    manOfWeekCount: {
      type: Number,
      default: 0
    },
    manOfMonthCount: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update metrics before saving
performanceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate attendance rate
  if (this.metrics.totalMeetings > 0) {
    this.metrics.attendanceRate = (this.metrics.meetingsAttended / this.metrics.totalMeetings) * 100;
  }
  
  // Calculate completion rate
  if (this.metrics.totalTasks > 0) {
    this.metrics.completionRate = (this.metrics.tasksCompleted / this.metrics.totalTasks) * 100;
  }
  
  next();
});

// Indexes
performanceSchema.index({ user: 1 });
performanceSchema.index({ 'metrics.attendanceRate': -1 });
performanceSchema.index({ 'points.total': -1 });

module.exports = mongoose.model('Performance', performanceSchema);
