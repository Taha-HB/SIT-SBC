const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/authMiddleware');

// @desc    Get all discussions
// @route   GET /api/chat/discussions
// @access  Private
router.get('/discussions', authMiddleware, async (req, res) => {
  try {
    const discussions = await Chat.find({
      participants: req.user._id,
      isArchived: false
    })
      .populate('participants', 'name role avatar')
      .populate('messages.sender', 'name role avatar')
      .sort({ lastMessageAt: -1 });
    
    res.status(200).json({
      status: 'success',
      count: discussions.length,
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

// @desc    Get single discussion
// @route   GET /api/chat/discussions/:id
// @access  Private
router.get('/discussions/:id', authMiddleware, async (req, res) => {
  try {
    const discussion = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id
    })
      .populate('participants', 'name role avatar')
      .populate('messages.sender', 'name role avatar')
      .populate('messages.reactions.user', 'name role')
      .populate('messages.replies.sender', 'name role');
    
    if (!discussion) {
      return res.status(404).json({
        status: 'error',
        message: 'Discussion not found'
      });
    }
    
    // Mark messages as read for current user
    const unreadMessages = discussion.messages.filter(
      message => !message.readBy.includes(req.user._id)
    );
    
    if (unreadMessages.length > 0) {
      unreadMessages.forEach(message => {
        message.readBy.push(req.user._id);
      });
      
      discussion.unreadCount = 0;
      await discussion.save();
    }
    
    res.status(200).json({
      status: 'success',
      data: discussion
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch discussion',
      error: error.message
    });
  }
});

// @desc    Create new discussion
// @route   POST /api/chat/discussions
// @access  Private
router.post('/discussions', authMiddleware, async (req, res) => {
  try {
    const { title, description, participantIds } = req.body;
    
    // Create discussion with current user as participant
    const participants = [req.user._id, ...(participantIds || [])];
    
    const discussion = await Chat.create({
      title,
      description,
      participants,
      messages: [],
      isPinned: false,
      isArchived: false,
      unreadCount: 0,
      lastMessageAt: new Date()
    });
    
    const populatedDiscussion = await Chat.findById(discussion._id)
      .populate('participants', 'name role avatar');
    
    res.status(201).json({
      status: 'success',
      message: 'Discussion created successfully',
      data: populatedDiscussion
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to create discussion',
      error: error.message
    });
  }
});

// @desc    Send message
// @route   POST /api/chat/discussions/:id/messages
// @access  Private
router.post('/discussions/:id/messages', authMiddleware, async (req, res) => {
  try {
    const { message, attachments = [] } = req.body;
    
    const discussion = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id
    });
    
    if (!discussion) {
      return res.status(404).json({
        status: 'error',
        message: 'Discussion not found'
      });
    }
    
    // Create new message
    const newMessage = {
      sender: req.user._id,
      message,
      attachments,
      reactions: [],
      replies: [],
      readBy: [req.user._id],
      timestamp: new Date()
    };
    
    discussion.messages.push(newMessage);
    discussion.lastMessageAt = new Date();
    discussion.unreadCount = discussion.participants.length - 1; // All participants except sender
    
    await discussion.save();
    
    // Populate message with sender info
    const populatedDiscussion = await Chat.findById(discussion._id)
      .populate('messages.sender', 'name role avatar')
      .populate('messages.reactions.user', 'name role');
    
    const sentMessage = populatedDiscussion.messages[populatedDiscussion.messages.length - 1];
    
    res.status(201).json({
      status: 'success',
      message: 'Message sent successfully',
      data: sentMessage
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to send message',
      error: error.message
    });
  }
});

// @desc    Add reaction to message
// @route   POST /api/chat/messages/:messageId/reactions
// @access  Private
router.post('/messages/:messageId/reactions', authMiddleware, async (req, res) => {
  try {
    const { reaction } = req.body;
    
    const discussion = await Chat.findOne({
      'messages._id': req.params.messageId,
      participants: req.user._id
    });
    
    if (!discussion) {
      return res.status(404).json({
        status: 'error',
        message: 'Message not found'
      });
    }
    
    const message = discussion.messages.id(req.params.messageId);
    
    if (!message) {
      return res.status(404).json({
        status: 'error',
        message: 'Message not found'
      });
    }
    
    // Check if user already reacted
    const existingReaction = message.reactions.find(
      r => r.user.toString() === req.user._id.toString()
    );
    
    if (existingReaction) {
      // Update existing reaction
      existingReaction.reaction = reaction;
    } else {
      // Add new reaction
      message.reactions.push({
        user: req.user._id,
        reaction
      });
    }
    
    await discussion.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Reaction added successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to add reaction',
      error: error.message
    });
  }
});

// @desc    Reply to message
// @route   POST /api/chat/messages/:messageId/replies
// @access  Private
router.post('/messages/:messageId/replies', authMiddleware, async (req, res) => {
  try {
    const { reply } = req.body;
    
    const discussion = await Chat.findOne({
      'messages._id': req.params.messageId,
      participants: req.user._id
    });
    
    if (!discussion) {
      return res.status(404).json({
        status: 'error',
        message: 'Message not found'
      });
    }
    
    const message = discussion.messages.id(req.params.messageId);
    
    if (!message) {
      return res.status(404).json({
        status: 'error',
        message: 'Message not found'
      });
    }
    
    // Add reply
    message.replies.push({
      sender: req.user._id,
      message: reply,
      timestamp: new Date()
    });
    
    discussion.lastMessageAt = new Date();
    discussion.unreadCount = discussion.participants.length - 1;
    
    await discussion.save();
    
    res.status(201).json({
      status: 'success',
      message: 'Reply sent successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to send reply',
      error: error.message
    });
  }
});

// @desc    Pin/unpin discussion
// @route   PUT /api/chat/discussions/:id/pin
// @access  Private
router.put('/discussions/:id/pin', authMiddleware, async (req, res) => {
  try {
    const discussion = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id
    });
    
    if (!discussion) {
      return res.status(404).json({
        status: 'error',
        message: 'Discussion not found'
      });
    }
    
    discussion.isPinned = !discussion.isPinned;
    await discussion.save();
    
    res.status(200).json({
      status: 'success',
      message: `Discussion ${discussion.isPinned ? 'pinned' : 'unpinned'} successfully`,
      data: { isPinned: discussion.isPinned }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update discussion',
      error: error.message
    });
  }
});

// @desc    Archive discussion
// @route   PUT /api/chat/discussions/:id/archive
// @access  Private
router.put('/discussions/:id/archive', authMiddleware, async (req, res) => {
  try {
    const discussion = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id
    });
    
    if (!discussion) {
      return res.status(404).json({
        status: 'error',
        message: 'Discussion not found'
      });
    }
    
    discussion.isArchived = true;
    await discussion.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Discussion archived successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to archive discussion',
      error: error.message
    });
  }
});

// @desc    Clear chat history
// @route   DELETE /api/chat/discussions/:id/messages
// @access  Private
router.delete('/discussions/:id/messages', authMiddleware, async (req, res) => {
  try {
    const discussion = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id
    });
    
    if (!discussion) {
      return res.status(404).json({
        status: 'error',
        message: 'Discussion not found'
      });
    }
    
    discussion.messages = [];
    discussion.lastMessageAt = new Date();
    discussion.unreadCount = 0;
    
    await discussion.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Chat history cleared successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear chat history',
      error: error.message
    });
  }
});

// @desc    Get chat statistics
// @route   GET /api/chat/stats
// @access  Private
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const totalDiscussions = await Chat.countDocuments({
      participants: req.user._id,
      isArchived: false
    });
    
    const pinnedDiscussions = await Chat.countDocuments({
      participants: req.user._id,
      isPinned: true,
      isArchived: false
    });
    
    const totalMessages = await Chat.aggregate([
      { $match: { participants: req.user._id } },
      { $unwind: '$messages' },
      { $count: 'totalMessages' }
    ]);
    
    const unreadCount = await Chat.aggregate([
      { $match: { participants: req.user._id, isArchived: false } },
      { $group: { _id: null, totalUnread: { $sum: '$unreadCount' } } }
    ]);
    
    res.status(200).json({
      status: 'success',
      data: {
        totalDiscussions,
        pinnedDiscussions,
        totalMessages: totalMessages[0]?.totalMessages || 0,
        unreadMessages: unreadCount[0]?.totalUnread || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch chat statistics',
      error: error.message
    });
  }
});

// @desc    Search messages
// @route   GET /api/chat/search
// @access  Private
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        status: 'error',
        message: 'Search query must be at least 2 characters'
      });
    }
    
    const discussions = await Chat.find({
      participants: req.user._id,
      'messages.message': { $regex: query, $options: 'i' }
    })
      .select('title messages')
      .populate('messages.sender', 'name role');
    
    // Filter messages that match the query
    const results = [];
    
    discussions.forEach(discussion => {
      const matchingMessages = discussion.messages.filter(message =>
        message.message.toLowerCase().includes(query.toLowerCase())
      );
      
      if (matchingMessages.length > 0) {
        results.push({
          discussionId: discussion._id,
          discussionTitle: discussion.title,
          messages: matchingMessages
        });
      }
    });
    
    res.status(200).json({
      status: 'success',
      count: results.length,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to search messages',
      error: error.message
    });
  }
});

module.exports = router;
