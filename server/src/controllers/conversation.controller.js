import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Membership from '../models/Membership.js';
import User from '../models/User.js';
import {
  assertParticipant,
  findOrCreateDM,
  markDelivered,
} from '../services/conversation.service.js';
import { isUserOnline } from '../services/presence.service.js';
import { editMessage, deleteMessage } from '../services/messaging.service.js';

export const createDM = async (req, res, next) => {
  try {
    let { userId, username } = req.body;
    if (!userId && username) {
      const targetUser = await User.findOne({ username: username.toLowerCase() });
      if (!targetUser) return res.status(404).json({ message: 'User not found' });
      userId = targetUser._id;
    }
    if (!userId) return res.status(400).json({ message: 'userId or username is required' });

    if (userId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot start a DM with yourself' });
    }

    const conversation = await findOrCreateDM(req.user._id, userId);

    for (const p of [req.user._id, userId]) {
      await Membership.findOneAndUpdate(
        { conversationId: conversation._id, userId: p },
        {
          $setOnInsert: {
            conversationId: conversation._id,
            userId: p,
            role: 'member',
            lastDeliveredSeq: 0,
            lastReadSeq: 0,
          },
        },
        { upsert: true }
      );
    }

    const populated = await Conversation.findById(conversation._id)
      .populate('participants', 'username displayName name lastSeenAt')
      .populate('lastMessage.sender', 'username displayName name');

    const io = req.app.get('io');
    if (io) {
      for (const p of conversation.participants) {
        const pId = p?._id ? p._id.toString() : p.toString();
        io.to(`user:${pId}`).emit('conversation:new', populated);
      }
    }

    res.status(200).json(populated);
  } catch (err) {
    next(err);
  }
};

export const createGroup = async (req, res, next) => {
  try {
    const { name, participantIds = [] } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'name is required' });

    // Deduplicated, always includes the creator
    const participants = [...new Set([req.user._id.toString(), ...(participantIds || [])])];

    const conversation = await Conversation.create({
      type: 'group',
      name: name.trim(),
      participants,
      createdBy: req.user._id,
      lastSeq: 0,
      lastEventSeq: 0,
    });

    for (const p of participants) {
      await Membership.findOneAndUpdate(
        { conversationId: conversation._id, userId: p },
        {
          $setOnInsert: {
            conversationId: conversation._id,
            userId: p,
            role: p === req.user._id.toString() ? 'owner' : 'member',
            lastDeliveredSeq: 0,
            lastReadSeq: 0,
          },
        },
        { upsert: true }
      );
    }

    const populated = await Conversation.findById(conversation._id)
      .populate('participants', 'username displayName name lastSeenAt');

    const io = req.app.get('io');
    if (io) {
      // Broadcast new room to ALL users so it shows in everyone's sidebar
      io.emit('conversation:new', populated);
    }

    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
};

export const listMyConversations = async (req, res, next) => {
  try {
    // 1. Always ensure General Chat exists and current user is a participant
    let generalRoom = await Conversation.findOne({ name: 'General Chat', type: 'group' });
    if (!generalRoom) {
      generalRoom = await Conversation.create({
        type: 'group',
        name: 'General Chat',
        participants: [req.user._id],
        createdBy: req.user._id,
        lastSeq: 0,
        lastEventSeq: 0,
      });
    } else if (!generalRoom.participants.some((p) => (p?._id || p).toString() === req.user._id.toString())) {
      generalRoom.participants.push(req.user._id);
      await generalRoom.save();
    }

    await Membership.findOneAndUpdate(
      { conversationId: generalRoom._id, userId: req.user._id },
      {
        $setOnInsert: {
          conversationId: generalRoom._id,
          userId: req.user._id,
          role: 'member',
          lastDeliveredSeq: 0,
          lastReadSeq: 0,
        },
      },
      { upsert: true }
    );

    // 2. Fetch all group rooms (channels) + direct messages where user is participant
    const conversations = await Conversation.find({
      $or: [{ participants: req.user._id }, { type: 'group' }],
    })
      .sort('-updatedAt')
      .populate('participants', 'username displayName name lastSeenAt')
      .populate('lastMessage.sender', 'username displayName name');

    const withPresence = await Promise.all(
      conversations.map(async (c) => {
        const obj = c.toObject();
        obj.participants = await Promise.all(
          (obj.participants || []).map(async (p) => ({
            ...p,
            isOnline: await isUserOnline(p._id),
          }))
        );
        return obj;
      })
    );

    res.json(withPresence);
  } catch (err) {
    next(err);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
    assertParticipant(conversation, req.user._id);

    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const filter = {
      $or: [{ conversationId: conversation._id }, { conversation: conversation._id }],
    };

    let sortDirection = -1;
    if (req.query.before) {
      filter._id = { $lt: req.query.before };
    } else if (req.query.after) {
      filter._id = { $gt: req.query.after };
      sortDirection = 1;
    }

    const messages = await Message.find(filter)
      .sort({ _id: sortDirection })
      .limit(limit)
      .populate('senderId', 'username displayName name')
      .populate('sender', 'username displayName name');

    if (messages.length > 0) {
      const newest = sortDirection === 1 ? messages[messages.length - 1]._id : messages[0]._id;
      if (markDelivered(conversation, req.user._id, newest)) await conversation.save();
    }

    res.json({
      messages,
      nextCursor: messages.length === limit ? messages[messages.length - 1]._id : null,
    });
  } catch (err) {
    next(err);
  }
};

const SYNC_MESSAGE_CAP = 50;

export const syncConversations = async (req, res, next) => {
  try {
    const since = req.query.since ? new Date(req.query.since) : new Date(0);
    if (Number.isNaN(since.getTime())) {
      return res.status(400).json({ message: 'since must be a valid date' });
    }

    const conversations = await Conversation.find({
      participants: req.user._id,
      updatedAt: { $gt: since },
    })
      .populate('participants', 'username displayName name lastSeenAt')
      .populate('lastMessage.sender', 'username displayName name');

    const results = await Promise.all(
      conversations.map(async (conversation) => {
        const messages = await Message.find({
          $or: [{ conversationId: conversation._id }, { conversation: conversation._id }],
          createdAt: { $gt: since },
        })
          .sort({ _id: 1 })
          .limit(SYNC_MESSAGE_CAP)
          .populate('senderId', 'username displayName name')
          .populate('sender', 'username displayName name');

        if (messages.length > 0) {
          const newest = messages[messages.length - 1]._id;
          if (markDelivered(conversation, req.user._id, newest)) await conversation.save();
        }

        const participants = await Promise.all(
          conversation.participants.map(async (p) => ({
            ...p.toObject(),
            isOnline: await isUserOnline(p._id),
          }))
        );

        return {
          conversation: { ...conversation.toObject(), participants },
          messages,
          truncated: messages.length === SYNC_MESSAGE_CAP,
        };
      })
    );

    res.json({ syncedAt: new Date(), conversations: results });
  } catch (err) {
    next(err);
  }
};

export const deleteConversation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    if (conversation.name === 'General Chat' && conversation.type === 'group') {
      return res.status(400).json({ message: 'Cannot delete General Chat' });
    }

    await Conversation.findByIdAndDelete(id);
    await Message.deleteMany({
      $or: [{ conversationId: id }, { conversation: id }],
    });
    await Membership.deleteMany({ conversationId: id });

    const io = req.app.get('io');
    if (io) {
      io.emit('conversation:deleted', { conversationId: id });
    }

    res.json({ ok: true, conversationId: id });
  } catch (err) {
    next(err);
  }
};

export const editMessageController = async (req, res, next) => {
  try {
    const { id, messageId } = req.params;
    const { text } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    const updated = await editMessage({
      conversationId: id,
      messageId,
      userId: req.user._id,
      newText: text.trim(),
    });

    const populated = await updated.populate('senderId', 'username displayName avatarUrl');

    const io = req.app.get('io');
    if (io) {
      const payload = {
        _id: populated._id,
        conversationId: id,
        text: populated.text,
        editedAt: populated.editedAt?.toISOString?.() || new Date().toISOString(),
      };
      io.emit('message:edited', payload);
    }

    res.json(populated);
  } catch (err) {
    next(err);
  }
};

export const deleteMessageController = async (req, res, next) => {
  try {
    const { id, messageId } = req.params;

    await deleteMessage({
      conversationId: id,
      messageId,
      userId: req.user._id,
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('message:deleted', {
        _id: messageId,
        conversationId: id,
      });
    }

    res.json({ ok: true, messageId });
  } catch (err) {
    next(err);
  }
};
