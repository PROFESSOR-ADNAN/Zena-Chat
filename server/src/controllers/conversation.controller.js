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

    const membership = await Membership.findOne({
      conversationId: conversation._id,
      userId: req.user._id,
    });
    const populatedObj = populated.toObject();
    populatedObj.lastReadSeq = membership?.lastReadSeq || 0;
    populatedObj.unreadCount = Math.max(0, (conversation.lastSeq || 0) - (membership?.lastReadSeq || 0));

    const io = req.app.get('io');
    if (io) {
      for (const p of conversation.participants) {
        const pId = p?._id ? p._id.toString() : p.toString();
        io.to(`user:${pId}`).emit('conversation:new', populatedObj);
      }
    }

    res.status(200).json(populatedObj);
  } catch (err) {
    next(err);
  }
};

// Consolidate duplicate rooms with the same name (e.g. "General Chat" or custom rooms)
export const consolidateRoomByName = async (name, type = 'group') => {
  const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rooms = await Conversation.find({
    type,
    name: new RegExp(`^${escaped}$`, 'i'),
  }).sort('createdAt');

  if (rooms.length === 0) return null;
  if (rooms.length === 1) return rooms[0];

  const primary = rooms[0];
  const duplicates = rooms.slice(1);
  const primaryParticipants = new Set(primary.participants.map((p) => (p?._id || p).toString()));

  for (const dup of duplicates) {
    // 1. Merge participants
    for (const p of dup.participants) {
      const pId = (p?._id || p).toString();
      primaryParticipants.add(pId);
    }

    // 2. Re-point messages from duplicate to primary
    await Message.updateMany(
      { $or: [{ conversationId: dup._id }, { conversation: dup._id }] },
      { $set: { conversationId: primary._id } }
    );

    // 3. Clean up duplicate conversation and memberships
    await Conversation.findByIdAndDelete(dup._id);
    await Membership.deleteMany({ conversationId: dup._id });
  }

  primary.participants = Array.from(primaryParticipants);
  await primary.save();

  return primary;
};

export const createGroup = async (req, res, next) => {
  try {
    const { name, participantIds = [] } = req.body;
    const trimmedName = name?.trim();
    if (!trimmedName) return res.status(400).json({ message: 'name is required' });

    let conversation = await consolidateRoomByName(trimmedName, 'group');
    let isNew = false;

    if (!conversation) {
      // Room does not exist yet: create it with creator as participant
      const participants = [...new Set([req.user._id.toString(), ...(participantIds || [])])];
      conversation = await Conversation.create({
        type: 'group',
        name: trimmedName,
        participants,
        createdBy: req.user._id,
        lastSeq: 0,
        lastEventSeq: 0,
      });
      isNew = true;
    } else {
      // Room already exists: join it! Add current user if not already in participants
      const alreadyIn = conversation.participants.some(
        (p) => (p?._id || p).toString() === req.user._id.toString()
      );
      if (!alreadyIn) {
        conversation.participants.push(req.user._id);
        await conversation.save();
      }
    }

    // Ensure membership record exists for this user
    await Membership.findOneAndUpdate(
      { conversationId: conversation._id, userId: req.user._id },
      {
        $setOnInsert: {
          conversationId: conversation._id,
          userId: req.user._id,
          role: conversation.createdBy?.toString() === req.user._id.toString() ? 'owner' : 'member',
          lastDeliveredSeq: 0,
          lastReadSeq: 0,
        },
      },
      { upsert: true }
    );

    const populated = await Conversation.findById(conversation._id)
      .populate('participants', 'username displayName name lastSeenAt');

    const membership = await Membership.findOne({
      conversationId: conversation._id,
      userId: req.user._id,
    });
    const populatedObj = populated.toObject();
    populatedObj.lastReadSeq = membership?.lastReadSeq || 0;
    populatedObj.unreadCount = Math.max(0, (conversation.lastSeq || 0) - (membership?.lastReadSeq || 0));

    const io = req.app.get('io');
    if (io) {
      // Notify only the user who created/joined so it does NOT clutter other users' sidebars!
      io.to(`user:${req.user._id}`).emit('conversation:new', populatedObj);
    }

    res.status(isNew ? 201 : 200).json(populatedObj);
  } catch (err) {
    next(err);
  }
};

export const listMyConversations = async (req, res, next) => {
  try {
    // 1. Always ensure a single consolidated General Chat exists and current user is a participant
    let generalRoom = await consolidateRoomByName('General Chat', 'group');
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

    // 2. Fetch only conversations where current user is an active participant
    const conversations = await Conversation.find({ participants: req.user._id })
      .sort('-updatedAt')
      .populate('participants', 'username displayName name lastSeenAt')
      .populate('lastMessage.sender', 'username displayName name');

    // Deduplicate any group rooms with identical names (ensures clean sidebar)
    const seenGroupNames = new Set();
    const uniqueConversations = [];
    for (const c of conversations) {
      if (c.type === 'group' && c.name) {
        const lower = c.name.toLowerCase().trim();
        if (seenGroupNames.has(lower)) continue;
        seenGroupNames.add(lower);
      }
      uniqueConversations.push(c);
    }

    // Pin "General Chat" to top so every user has the exact same primary conversation
    uniqueConversations.sort((a, b) => {
      if (a.name?.toLowerCase().trim() === 'general chat') return -1;
      if (b.name?.toLowerCase().trim() === 'general chat') return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    const withPresence = await Promise.all(
      uniqueConversations.map(async (c) => {
        const obj = c.toObject();
        obj.participants = await Promise.all(
          (obj.participants || []).map(async (p) => ({
            ...p,
            isOnline: await isUserOnline(p._id),
          }))
        );

        // Calculate unread count for Telegram-style badge
        const membership = await Membership.findOne({
          conversationId: c._id,
          userId: req.user._id,
        });
        obj.lastReadSeq = membership?.lastReadSeq || 0;
        obj.unreadCount = Math.max(0, (c.lastSeq || 0) - (membership?.lastReadSeq || 0));

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

    const limit = Math.min(parseInt(req.query.limit) || 100, 200);
    const filter = {
      conversationId: conversation._id,
      deletedAt: null,
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
      .populate('senderId', 'username displayName name');

    const prevMembership = await Membership.findOne({
      conversationId: conversation._id,
      userId: req.user._id,
    });
    const lastReadSeq = prevMembership?.lastReadSeq || 0;

    if (messages.length > 0) {
      const highestSeq = Math.max(...messages.map((m) => m.seq || 0));
      if (highestSeq > 0) {
        await Membership.findOneAndUpdate(
          { conversationId: conversation._id, userId: req.user._id },
          { $max: { lastDeliveredSeq: highestSeq } }
        ).catch(() => {});
      }
    }

    const chronological = sortDirection === -1 ? messages.reverse() : messages;

    res.json({
      messages: chronological,
      lastReadSeq,
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
          conversationId: conversation._id,
          createdAt: { $gt: since },
          deletedAt: null,
        })
          .sort({ _id: 1 })
          .limit(SYNC_MESSAGE_CAP)
          .populate('senderId', 'username displayName name');

        if (messages.length > 0) {
          const highestSeq = Math.max(...messages.map((m) => m.seq || 0));
          if (highestSeq > 0) {
            await Membership.findOneAndUpdate(
              { conversationId: conversation._id, userId: req.user._id },
              { $max: { lastDeliveredSeq: highestSeq } }
            ).catch(() => {});
          }
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

    if (conversation.name?.toLowerCase().trim() === 'general chat' && conversation.type === 'group') {
      return res.status(400).json({ message: 'Cannot delete General Chat' });
    }

    await Conversation.findByIdAndDelete(id);
    await Message.deleteMany({
      $or: [{ conversationId: id }, { conversation: id }],
    });
    await Membership.deleteMany({ conversationId: id });

    const io = req.app.get('io');
    if (io) {
      if (conversation.participants) {
        for (const p of conversation.participants) {
          const pId = p?._id ? p._id.toString() : p.toString();
          io.to(`user:${pId}`).emit('conversation:deleted', { conversationId: id });
        }
      }
      io.to(id).emit('conversation:deleted', { conversationId: id });
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
      const conversation = await Conversation.findById(id);
      if (conversation?.name?.toLowerCase().trim() === 'general chat') {
        io.emit('message:edited', payload);
      } else {
        io.to(id).emit('message:edited', payload);
        if (conversation?.participants) {
          for (const p of conversation.participants) {
            const pId = p?._id ? p._id.toString() : p.toString();
            io.to(`user:${pId}`).emit('message:edited', payload);
          }
        }
      }
    }

    res.json(populated);
  } catch (err) {
    next(err);
  }
};

export const deleteMessageController = async (req, res, next) => {
  try {
    const { id, messageId } = req.params;

    const conversation = await Conversation.findById(id);

    await deleteMessage({
      conversationId: id,
      messageId,
      userId: req.user._id,
    });

    const io = req.app.get('io');
    if (io) {
      const payload = {
        _id: messageId,
        conversationId: id,
      };
      if (conversation?.name?.toLowerCase().trim() === 'general chat') {
        io.emit('message:deleted', payload);
      } else {
        io.to(id).emit('message:deleted', payload);
        if (conversation?.participants) {
          for (const p of conversation.participants) {
            const pId = p?._id ? p._id.toString() : p.toString();
            io.to(`user:${pId}`).emit('message:deleted', payload);
          }
        }
      }
    }

    res.json({ ok: true, messageId });
  } catch (err) {
    next(err);
  }
};
