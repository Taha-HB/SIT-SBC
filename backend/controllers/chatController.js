const { Chat, Message } = require('../models/Chat');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Get all discussions
// @route   GET /api/chat/discussions
// @access  Private
exports.getDiscussions = async (req, res, next) => {
  try {
    const {
      type,
      archived,
      pinned,
      search,
      page = 1,
      limit = 20
    } = req.query;

    // Build query
    const query = {};

    // Only show discussions user is part of
    query.$or = [
      { participants: req.user.id },
      { isGroup: true },
      { createdBy: req.user.id }
    ];

    if (type) query.discussionType = type;
    if (archived !== undefined) query.archived = archived === 'true';
    if (pinned !== undefined) query.pinned = pinned === 'true';
    
    if (search) {
      query.$or = [
        { discussionTitle: { $regex: search, $options: 'i' } },
        { discussionDescription: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Execute query
    const discussions = await Chat.find(query)
      .populate('participants', 'name email role avatar avatarColor')
      .populate('createdBy', 'name email role avatar')
      .populate('admins', 'name email role avatar')
      .sort('-lastActivity')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Get total count
    const total = await Chat.countDocuments(query);

    // Get unread counts
    const discussionsWithUnread = await Promise.all(
      discussions.map(async (discussion) => {
        const unreadCount = await Message.countDocuments({
          discussionId: discussion.discussionId,
          'readBy.user': { $ne: req.user.id },
          sender: { $ne: req.user.id },
          createdAt: { $gt: req.user.lastLogin || new Date(0) }
        });

        return {
          ...discussion.toObject(),
          unreadCount
        };
      })
    );

    res.status(200).json({
      success: true,
      count: discussions.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      discussions: discussionsWithUnread
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Create new discussion
// @route   POST /api/chat/discussions
// @access  Private
exports.createDiscussion = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      title,
      description,
      type,
      participants,
      isGroup,
      settings,
      tags
    } = req.body;

    // Generate discussion ID
    const discussionId = `disc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Add creator to participants if not already included
    const allParticipants = [...new Set([
      req.user.id,
      ...(participants || [])
    ])];

    const discussion = await Chat.create({
      discussionId,
      discussionTitle: title,
      discussionDescription: description,
      discussionType: type || 'general',
      participants: allParticipants,
      isGroup: isGroup !== undefined ? isGroup : (participants?.length > 1),
      createdBy: req.user.id,
      admins: [req.user.id],
      settings: settings || {},
      tags: tags || []
    });

    // Create welcome message
    const welcomeMessage = await Message.create({
      discussionId,
      sender: req.user.id,
      message: `Created discussion: "${title}"`,
      type: 'system'
    });

    // Populate and return
    const populatedDiscussion = await Chat.findById(discussion._id)
      .populate('participants', 'name email role avatar avatarColor')
      .populate('createdBy', 'name email role avatar')
      .populate('admins', 'name email role avatar');

    res.status(201).json({
      success: true,
      discussion: populatedDiscussion,
      welcomeMessage
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get discussion messages
// @route   GET /api/chat/discussions/:id/messages
// @access  Private
exports.getMessages = async (req, res, next) => {
  try {
    const { discussionId } = req.params;
    const {
      before,
      after,
      limit = 50,
      search
    } = req.query;

    // Check if user is part of discussion
    const discussion = await Chat.findOne({ discussionId });
    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    if (!discussion.participants.includes(req.user.id) && 
        discussion.createdBy.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this discussion'
      });
    }

    // Build query
    const query = { discussionId, deleted: false };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    } else if (after) {
      query.createdAt = { $gt: new Date(after) };
    }

    if (search) {
      query.message = { $regex: search, $options: 'i' };
    }

    // Execute query
    const messages = await Message.find(query)
      .populate('sender', 'name email role avatar avatarColor')
      .populate('replies.sender', 'name email role avatar')
      .populate('mentions', 'name email role avatar')
      .sort('-createdAt')
      .limit(parseInt(limit));

    // Mark messages as read
    await Message.updateMany(
      {
        discussionId,
        'readBy.user': { $ne: req.user.id },
        sender: { $ne: req.user.id }
      },
      {
        $push: {
          readBy: {
            user: req.user.id,
            readAt: new Date()
          }
        }
      }
    );

    // Update discussion last activity
    if (messages.length > 0) {
      discussion.lastActivity = messages[0].createdAt;
      await discussion.save();
    }

    res.status(200).json({
      success: true,
      count: messages.length,
      messages: messages.reverse(), // Return in chronological order
      discussion
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Send message
// @route   POST /api/chat/messages
// @access  Private
exports.sendMessage = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      discussionId,
      message,
      type,
      attachments,
      replyTo
    } = req.body;

    // Check if user is part of discussion
    const discussion = await Chat.findOne({ discussionId });
    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    if (!discussion.participants.includes(req.user.id) && 
        discussion.createdBy.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send messages in this discussion'
      });
    }

    // Check discussion settings
    if (discussion.settings.allowFiles === false && type !== 'text') {
      return res.status(403).json({
        success: false,
        message: 'File attachments are not allowed in this discussion'
      });
    }

    // Create message
    const newMessage = await Message.create({
      discussionId,
      sender: req.user.id,
      message,
      type: type || 'text',
      attachments: attachments || [],
      metadata: {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    // Update discussion last activity
    discussion.lastActivity = new Date();
    await discussion.save();

    // Populate and return
    const populatedMessage = await Message.findById(newMessage._id)
      .populate('sender', 'name email role avatar avatarColor')
      .populate('mentions', 'name email role avatar');

    res.status(201).json({
      success: true,
      message: populatedMessage
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Edit message
// @route   PUT /api/chat/messages/:id
// @access  Private
exports.editMessage = async (req, res, next) => {
  try {
    const { message } = req.body;

    const msg = await Message.findById(req.params.id);

    if (!msg) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check permissions
    if (msg.sender.toString() !== req.user.id.toString() && !req.user.isController) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this message'
      });
    }

    // Check discussion settings
    const discussion = await Chat.findOne({ discussionId: msg.discussionId });
    if (discussion && discussion.settings.allowEditing === false) {
      return res.status(403).json({
        success: false,
        message: 'Editing messages is not allowed in this discussion'
      });
    }

    // Update message
    msg.message = message;
    await msg.save();

    // Populate and return
    const populatedMessage = await Message.findById(msg._id)
      .populate('sender', 'name email role avatar avatarColor')
      .populate('mentions', 'name email role avatar');

    res.status(200).json({
      success: true,
      message: populatedMessage
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Delete message
// @route   DELETE /api/chat/messages/:id
// @access  Private
exports.deleteMessage = async (req, res, next) => {
  try {
    const msg = await Message.findById(req.params.id);

    if (!msg) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check permissions
    const isSender = msg.sender.toString() === req.user.id.toString();
    const isDiscussionAdmin = await Chat.findOne({
      discussionId: msg.discussionId,
      admins: req.user.id
    });
    
    if (!isSender && !isDiscussionAdmin && !req.user.isController) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this message'
      });
    }

    // Check discussion settings
    const discussion = await Chat.findOne({ discussionId: msg.discussionId });
    if (discussion && discussion.settings.allowDeleting === false && !req.user.isController) {
      return res.status(403).json({
        success: false,
        message: 'Deleting messages is not allowed in this discussion'
      });
    }

    // Soft delete
    msg.deleted = true;
    msg.deletedAt = new Date();
    msg.deletedBy = req.user.id;
    await msg.save();

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Add reaction to message
// @route   POST /api/chat/messages/:id/reactions
// @access  Private
exports.addReaction = async (req, res, next) => {
  try {
    const { reaction } = req.body;

    const msg = await Message.findById(req.params.id);

    if (!msg) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check discussion settings
    const discussion = await Chat.findOne({ discussionId: msg.discussionId });
    if (discussion && discussion.settings.allowReactions === false) {
      return res.status(403).json({
        success: false,
        message: 'Reactions are not allowed in this discussion'
      });
    }

    // Add reaction
    await msg.addReaction(req.user.id, reaction);

    // Populate and return
    const populatedMessage = await Message.findById(msg._id)
      .populate('sender', 'name email role avatar avatarColor');

    res.status(200).json({
      success: true,
      message: populatedMessage
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Remove reaction from message
// @route   DELETE /api/chat/messages/:id/reactions/:reaction
// @access  Private
exports.removeReaction = async (req, res, next) => {
  try {
    const { reaction } = req.params;

    const msg = await Message.findById(req.params.id);

    if (!msg) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Remove reaction
    await msg.removeReaction(req.user.id, reaction);

    // Populate and return
    const populatedMessage = await Message.findById(msg._id)
      .populate('sender', 'name email role avatar avatarColor');

    res.status(200).json({
      success: true,
      message: populatedMessage
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Reply to message
// @route   POST /api/chat/messages/:id/replies
// @access  Private
exports.replyToMessage = async (req, res, next) => {
  try {
    const { message } = req.body;

    const originalMessage = await Message.findById(req.params.id);

    if (!originalMessage) {
      return res.status(404).json({
        success: false,
        message: 'Original message not found'
      });
    }

    // Check if user is part of discussion
    const discussion = await Chat.findOne({ discussionId: originalMessage.discussionId });
    if (!discussion.participants.includes(req.user.id) && 
        discussion.createdBy.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reply in this discussion'
      });
    }

    // Add reply
    originalMessage.replies.push({
      sender: req.user.id,
      message
    });

    await originalMessage.save();

    // Populate and return
    const populatedMessage = await Message.findById(originalMessage._id)
      .populate('sender', 'name email role avatar avatarColor')
      .populate('replies.sender', 'name email role avatar');

    res.status(200).json({
      success: true,
      message: populatedMessage
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get chat statistics
// @route   GET /api/chat/stats
// @access  Private
exports.getChatStats = async (req, res, next) => {
  try {
    // Get message count
    const totalMessages = await Message.countDocuments({
      'readBy.user': req.user.id,
      deleted: false
    });

    // Get unread count
    const unreadMessages = await Message.countDocuments({
      'readBy.user': { $ne: req.user.id },
      sender: { $ne: req.user.id },
      deleted: false
    });

    // Get active discussions count
    const activeDiscussions = await Chat.countDocuments({
      $or: [
        { participants: req.user.id },
        { createdBy: req.user.id }
      ],
      archived: false
    });

    // Get recent activity
    const recentActivity = await Message.aggregate([
      {
        $match: {
          'readBy.user': req.user.id,
          deleted: false
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          messageCount: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 7 }
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalMessages,
        unreadMessages,
        activeDiscussions,
        recentActivity
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Update discussion
// @route   PUT /api/chat/discussions/:id
// @access  Private
exports.updateDiscussion = async (req, res, next) => {
  try {
    const { title, description, settings, tags, pinned, archived } = req.body;

    const discussion = await Chat.findOne({ discussionId: req.params.id });

    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    // Check permissions
    if (!discussion.admins.includes(req.user.id) && !req.user.isController) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this discussion'
      });
    }

    // Update fields
    if (title !== undefined) discussion.discussionTitle = title;
    if (description !== undefined) discussion.discussionDescription = description;
    if (settings !== undefined) discussion.settings = settings;
    if (tags !== undefined) discussion.tags = tags;
    if (pinned !== undefined) discussion.pinned = pinned;
    if (archived !== undefined) discussion.archived = archived;

    await discussion.save();

    // Populate and return
    const populatedDiscussion = await Chat.findById(discussion._id)
      .populate('participants', 'name email role avatar avatarColor')
      .populate('createdBy', 'name email role avatar')
      .populate('admins', 'name email role avatar');

    res.status(200).json({
      success: true,
      discussion: populatedDiscussion
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Add participant to discussion
// @route   POST /api/chat/discussions/:id/participants
// @access  Private
exports.addParticipant = async (req, res, next) => {
  try {
    const { userId } = req.body;

    const discussion = await Chat.findOne({ discussionId: req.params.id });

    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    // Check permissions
    if (!discussion.admins.includes(req.user.id) && !req.user.isController) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to add participants'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add participant if not already in discussion
    if (!discussion.participants.includes(userId)) {
      discussion.participants.push(userId);
      await discussion.save();
    }

    // Create system message
    await Message.create({
      discussionId: discussion.discussionId,
      sender: req.user.id,
      message: `Added ${user.name} to the discussion`,
      type: 'system'
    });

    // Populate and return
    const populatedDiscussion = await Chat.findById(discussion._id)
      .populate('participants', 'name email role avatar avatarColor');

    res.status(200).json({
      success: true,
      discussion: populatedDiscussion,
      message: 'Participant added successfully'
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Remove participant from discussion
// @route   DELETE /api/chat/discussions/:id/participants/:userId
// @access  Private
exports.removeParticipant = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const discussion = await Chat.findOne({ discussionId: req.params.id });

    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    // Check permissions
    if (!discussion.admins.includes(req.user.id) && !req.user.isController) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to remove participants'
      });
    }

    // Cannot remove creator
    if (discussion.createdBy.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove discussion creator'
      });
    }

    // Remove participant
    discussion.participants = discussion.participants.filter(
      p => p.toString() !== userId
    );

    // Remove from admins if present
    discussion.admins = discussion.admins.filter(
      a => a.toString() !== userId
    );

    await discussion.save();

    // Create system message
    const user = await User.findById(userId);
    await Message.create({
      discussionId: discussion.discussionId,
      sender: req.user.id,
      message: `Removed ${user?.name || 'user'} from the discussion`,
      type: 'system'
    });

    res.status(200).json({
      success: true,
      message: 'Participant removed successfully'
    });

  } catch (error) {
    next(error);
  }
};
