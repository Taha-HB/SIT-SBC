const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  discussionId: {
    type: String,
    required: true,
    index: true
  },
  discussionTitle: {
    type: String,
    required: true,
    trim: true
  },
  discussionDescription: String,
  discussionType: {
    type: String,
    enum: ['general', 'committee', 'project', 'private'],
    default: 'general'
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isGroup: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  pinned: {
    type: Boolean,
    default: false
  },
  archived: {
    type: Boolean,
    default: false
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  },
  settings: {
    allowReactions: {
      type: Boolean,
      default: true
    },
    allowFiles: {
      type: Boolean,
      default: true
    },
    allowEditing: {
      type: Boolean,
      default: true
    },
    allowDeleting: {
      type: Boolean,
      default: true
    }
  },
  tags: [String],
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

const messageSchema = new mongoose.Schema({
  discussionId: {
    type: String,
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: [true, 'Message cannot be empty'],
    trim: true,
    maxlength: [2000, 'Message cannot be more than 2000 characters']
  },
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'system', 'update'],
    default: 'text'
  },
  attachments: [{
    name: String,
    url: String,
    type: String,
    size: Number
  }],
  edited: {
    type: Boolean,
    default: false
  },
  editHistory: [{
    message: String,
    editedAt: Date
  }],
  deleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reactions: {
    type: Map,
    of: [mongoose.Schema.Types.ObjectId], // Array of user IDs who reacted
    default: {}
  },
  replies: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  pinned: {
    type: Boolean,
    default: false
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    ip: String,
    userAgent: String,
    location: String
  }
}, {
  timestamps: true
});

// Index for efficient querying
messageSchema.index({ discussionId: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });

// Pre-save middleware
messageSchema.pre('save', function(next) {
  if (this.isModified('message') && !this.isNew) {
    this.edited = true;
    
    // Save edit history (keep last 5 edits)
    const editHistory = this.editHistory || [];
    editHistory.push({
      message: this.message,
      editedAt: new Date()
    });
    
    this.editHistory = editHistory.slice(-5);
  }
  next();
});

// Method to add reaction
messageSchema.methods.addReaction = function(userId, reaction) {
  if (!this.reactions) {
    this.reactions = new Map();
  }
  
  if (!this.reactions.has(reaction)) {
    this.reactions.set(reaction, []);
  }
  
  const users = this.reactions.get(reaction);
  if (!users.includes(userId)) {
    users.push(userId);
    this.reactions.set(reaction, users);
  }
  
  return this.save();
};

// Method to remove reaction
messageSchema.methods.removeReaction = function(userId, reaction) {
  if (this.reactions && this.reactions.has(reaction)) {
    const users = this.reactions.get(reaction).filter(id => id.toString() !== userId.toString());
    if (users.length === 0) {
      this.reactions.delete(reaction);
    } else {
      this.reactions.set(reaction, users);
    }
  }
  
  return this.save();
};

// Method to mark as read
messageSchema.methods.markAsRead = function(userId) {
  if (!this.readBy.some(item => item.user.toString() === userId.toString())) {
    this.readBy.push({
      user: userId,
      readAt: new Date()
    });
  }
  
  return this.save();
};

const Chat = mongoose.model('Chat', chatSchema);
const Message = mongoose.model('Message', messageSchema);

module.exports = { Chat, Message };
