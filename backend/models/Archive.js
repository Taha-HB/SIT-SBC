const mongoose = require('mongoose');

const archiveSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  itemType: {
    type: String,
    enum: ['meeting', 'document', 'action_item', 'discussion', 'update'],
    required: true
  },
  originalData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  archivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  archivedAt: {
    type: Date,
    default: Date.now
  },
  reason: {
    type: String,
    trim: true
  },
  retentionPeriod: {
    type: Number, // in days
    default: 365
  },
  scheduledForDeletion: {
    type: Date,
    default: function() {
      const date = new Date(this.archivedAt);
      date.setDate(date.getDate() + this.retentionPeriod);
      return date;
    }
  },
  restored: {
    type: Boolean,
    default: false
  },
  restoredAt: Date,
  restoredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  metadata: {
    version: Number,
    originalCollection: String,
    size: Number // in bytes
  },
  tags: [String],
  searchIndex: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

// Create indexes for efficient querying
archiveSchema.index({ itemType: 1, archivedAt: -1 });
archiveSchema.index({ scheduledForDeletion: 1 });
archiveSchema.index({ restored: 1 });
archiveSchema.index({ 'searchIndex.$**': 'text' });

// Pre-save middleware to create search index
archiveSchema.pre('save', function(next) {
  if (this.isModified('originalData')) {
    this.searchIndex = this.createSearchIndex();
  }
  next();
});

// Method to create search index
archiveSchema.methods.createSearchIndex = function() {
  const index = new Map();
  
  // Index based on item type
  switch (this.itemType) {
    case 'meeting':
      const meeting = this.originalData;
      index.set('title', meeting.title || '');
      index.set('type', meeting.type || '');
      index.set('venue', meeting.venue || '');
      index.set('chairperson', meeting.chairperson?.name || '');
      index.set('date', meeting.date ? new Date(meeting.date).toISOString() : '');
      index.set('objective', meeting.objective || '');
      break;
      
    case 'document':
      const doc = this.originalData;
      index.set('name', doc.name || '');
      index.set('type', doc.type || '');
      index.set('description', doc.description || '');
      break;
      
    case 'action_item':
      const action = this.originalData;
      index.set('task', action.task || '');
      index.set('assignee', action.assignee?.name || '');
      index.set('status', action.status || '');
      break;
  }
  
  return index;
};

// Method to check if item should be deleted
archiveSchema.methods.shouldBeDeleted = function() {
  return new Date() > this.scheduledForDeletion;
};

// Method to restore archived item
archiveSchema.methods.restore = function(userId) {
  this.restored = true;
  this.restoredAt = new Date();
  this.restoredBy = userId;
  return this.save();
};

// Static method to get archive statistics
archiveSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $facet: {
        totalItems: [
          { $count: 'count' }
        ],
        itemsByType: [
          { $group: { _id: '$itemType', count: { $sum: 1 } } }
        ],
        monthlyArchives: [
          {
            $group: {
              _id: {
                year: { $year: '$archivedAt' },
                month: { $month: '$archivedAt' }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id.year': -1, '_id.month': -1 } },
          { $limit: 12 }
        ],
        storageUsage: [
          {
            $group: {
              _id: null,
              totalSize: { $sum: '$metadata.size' }
            }
          }
        ],
        pendingDeletion: [
          {
            $match: {
              scheduledForDeletion: { $lt: new Date() },
              restored: false
            }
          },
          { $count: 'count' }
        ]
      }
    }
  ]);
  
  return stats[0];
};

// Static method to clean old archives
archiveSchema.statics.cleanOldArchives = async function() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 365); // 1 year retention
  
  const result = await this.deleteMany({
    scheduledForDeletion: { $lt: cutoffDate },
    restored: false
  });
  
  return result;
};

module.exports = mongoose.model('Archive', archiveSchema);
