const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  meetingId: {
    type: String,
    required: [true, 'Please provide meeting ID'],
    unique: true,
    match: [/^SC-\d{4}-\d{2}-\d{2}-\d{3}$/, 'Invalid meeting ID format']
  },
  title: {
    type: String,
    required: [true, 'Please provide meeting title'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  type: {
    type: String,
    enum: ['regular', 'random', 'special', 'committee'],
    default: 'regular',
    required: true
  },
  date: {
    type: Date,
    required: [true, 'Please provide meeting date']
  },
  startTime: {
    type: String,
    required: [true, 'Please provide start time'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format']
  },
  endTime: {
    type: String,
    required: [true, 'Please provide end time'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format']
  },
  venue: {
    type: String,
    required: [true, 'Please provide venue'],
    trim: true
  },
  chairperson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  minutesTaker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  objective: {
    type: String,
    trim: true,
    maxlength: [1000, 'Objective cannot be more than 1000 characters']
  },
  attendees: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: String,
    role: String,
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'excused'],
      default: 'absent'
    },
    time: String,
    notes: String
  }],
  agenda: [{
    itemNumber: Number,
    title: {
      type: String,
      required: true
    },
    presenter: String,
    duration: {
      type: Number,
      min: 1,
      max: 120
    },
    description: String,
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'postponed'],
      default: 'pending'
    },
    discussion: String,
    decisions: [String]
  }],
  questions: [{
    question: {
      type: String,
      required: true
    },
    askedBy: String,
    answer: String,
    status: {
      type: String,
      enum: ['pending', 'answered', 'deferred'],
      default: 'pending'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    }
  }],
  minutes: {
    summary: String,
    keyPoints: [String],
    decisions: [{
      decision: String,
      voting: {
        inFavor: Number,
        against: Number,
        abstained: Number
      },
      implementBy: Date
    }],
    actionItems: [{
      task: {
        type: String,
        required: true
      },
      assignee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      deadline: Date,
      status: {
        type: String,
        enum: ['pending', 'in-progress', 'completed', 'cancelled'],
        default: 'pending'
      },
      priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
      },
      notes: String,
      completionDate: Date
    }],
    attachments: [{
      name: String,
      url: String,
      type: String
    }],
    nextMeeting: {
      date: Date,
      time: String,
      venue: String,
      agenda: String
    }
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'in-progress', 'completed', 'cancelled', 'postponed'],
    default: 'draft'
  },
  archived: {
    type: Boolean,
    default: false
  },
  published: {
    type: Boolean,
    default: false
  },
  publishedAt: Date,
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reminders: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'push']
    },
    sent: Boolean,
    sentAt: Date
  }],
  tags: [String],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  version: {
    type: Number,
    default: 1
  },
  previousVersions: [{
    data: Object,
    version: Number,
    updatedAt: Date,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for duration
meetingSchema.virtual('duration').get(function() {
  const start = new Date(`1970-01-01T${this.startTime}:00`);
  const end = new Date(`1970-01-01T${this.endTime}:00`);
  const diff = (end - start) / (1000 * 60); // in minutes
  return diff;
});

// Virtual for upcoming meetings
meetingSchema.virtual('isUpcoming').get(function() {
  const meetingDateTime = new Date(this.date);
  const today = new Date();
  return meetingDateTime > today && this.status === 'scheduled';
});

// Virtual for past meetings
meetingSchema.virtual('isPast').get(function() {
  const meetingDateTime = new Date(this.date);
  const today = new Date();
  return meetingDateTime < today;
});

// Pre-save middleware to generate meeting ID
meetingSchema.pre('save', async function(next) {
  if (!this.meetingId) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const day = String(new Date().getDate()).padStart(2, '0');
    
    // Count existing meetings for today
    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lt: new Date(new Date().setHours(23, 59, 59, 999))
      }
    });
    
    this.meetingId = `SC-${year}-${month}-${day}-${String(count + 1).padStart(3, '0')}`;
  }
  
  // Update version if data changed
  if (this.isModified() && !this.isNew) {
    this.version += 1;
    
    // Save previous version
    const previousData = this.previousVersions || [];
    previousData.push({
      data: this.toObject(),
      version: this.version - 1,
      updatedAt: new Date(),
      updatedBy: this.updatedBy
    });
    
    this.previousVersions = previousData.slice(-5); // Keep last 5 versions
  }
  
  next();
});

// Method to publish meeting
meetingSchema.methods.publish = function(userId) {
  this.published = true;
  this.publishedAt = new Date();
  this.publishedBy = userId;
  this.status = 'completed';
  return this.save();
};

// Method to archive meeting
meetingSchema.methods.archive = function() {
  this.archived = true;
  return this.save();
};

// Method to restore meeting
meetingSchema.methods.restore = function() {
  this.archived = false;
  return this.save();
};

// Method to add attendee
meetingSchema.methods.addAttendee = function(userId, status = 'present', time = null, notes = '') {
  const user = this.attendees.id(userId);
  if (!user) {
    this.attendees.push({
      user: userId,
      status,
      time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      notes
    });
  } else {
    user.status = status;
    user.time = time || user.time;
    user.notes = notes || user.notes;
  }
  return this.save();
};

// Method to mark action item complete
meetingSchema.methods.completeActionItem = function(actionItemId, completionDate = new Date()) {
  const actionItem = this.minutes.actionItems.id(actionItemId);
  if (actionItem) {
    actionItem.status = 'completed';
    actionItem.completionDate = completionDate;
  }
  return this.save();
};

// Static method to get statistics
meetingSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $facet: {
        totalMeetings: [
          { $count: 'count' }
        ],
        meetingsByType: [
          { $group: { _id: '$type', count: { $sum: 1 } } }
        ],
        meetingsByStatus: [
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ],
        monthlyMeetings: [
          {
            $group: {
              _id: {
                year: { $year: '$date' },
                month: { $month: '$date' }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id.year': -1, '_id.month': -1 } },
          { $limit: 6 }
        ],
        averageAttendance: [
          { $unwind: '$attendees' },
          { $match: { 'attendees.status': 'present' } },
          {
            $group: {
              _id: '$_id',
              presentCount: { $sum: 1 }
            }
          },
          {
            $group: {
              _id: null,
              average: { $avg: '$presentCount' }
            }
          }
        ]
      }
    }
  ]);
  
  return stats[0];
};

module.exports = mongoose.model('Meeting', meetingSchema);
