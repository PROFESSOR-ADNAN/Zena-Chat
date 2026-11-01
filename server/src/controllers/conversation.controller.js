import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import {
  assertParticipant,
  findOrCreateDM,
  markRead,
  markDelivered,
} from '../services/conversation.service.js';
import { isUserOnline } from '../services/presence.service.js';

export const createDM = async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    const conversation = await findOrCreateDM(req.user._id, userId);
    res.status(200).json(conversation);
  } catch (err) {
    next(err);
  }
};

export const createGroup = async (req, res, next) => {
  try {
    const { name, participantIds = [] } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });
    if (participantIds.length === 0) {
      return res.status(400).json({ message: 'At least one other participant is required' });
    }

    // De-duplicated, and always includes the creator even if the client
    // forgot to — a group you create without yourself in it isn't useful.
    const participants = [...new Set([req.user._id.toString(), ...participantIds])];

    const conversation = await Conversation.create({
      type: 'group',
      name,
      participants,
      createdBy: req.user._id,
    });

    res.status(201).json(conversation);
  } catch (err) {
    next(err);
  }
};

export const listMyConversations = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .sort('-updatedAt')
      .populate('participants', 'name lastSeenAt')
      .populate('lastMessage.sender', 'name');

    // Presence is in-memory... no, Redis now (phase 4) — either way, not
    // something a Mongo query can join against, so it's attached here
    // per participant rather than stored on the documents themselves.
    //
    // isUserOnline became async when presence moved to Redis in phase 4;
    // this call site was written back in phase 3 and never updated to
    // await it, so it was quietly returning a Promise instead of a
    // boolean here — fixed now, caught while touching this file for the
    // sync work below, not caught by anything automated.
    const withPresence = await Promise.all(
      conversations.map(async (c) => {
        const obj = c.toObject();
        obj.participants = await Promise.all(
          obj.participants.map(async (p) => ({ ...p, isOnline: await isUserOnline(p._id) }))
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
    const filter = { conversation: conversation._id };

    // Cursor pagination, not page/limit: a message feed only ever grows,
    // and skip/limit gets slower the further back you page. A Mongo
    // ObjectId encodes its creation time in its first 4 bytes, so
    // comparing by _id IS comparing by creation time.
    //
    // Two directions, for two different situations: `before` scrolls
    // backward into history (newest-first, matching how a chat log is
    // read). `after` is for catching up post-reconnect — "what did I
    // miss" — so it returns oldest-first, the order the missed messages
    // actually happened in, ready to replay as-is.
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
      .populate('sender', 'name');

    // Fetching a message IS receiving it, whether that happens live over
    // the socket or by catching up here — mark delivered up through
    // whatever's newest in this batch. The batch is already sorted, so
    // "newest" is just one end of it — which end depends on direction.
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

// A reconnecting client's real starting point: one call instead of
// looping the per-conversation endpoint above over every conversation
// it's part of. Returns, for each conversation with activity since
// `since`, the conversation itself plus the actual missed messages
// (capped — a conversation with more than that paginates the normal way
// afterward, via getMessages' `after`).
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
      .populate('participants', 'name lastSeenAt')
      .populate('lastMessage.sender', 'name');

    const results = await Promise.all(
      conversations.map(async (conversation) => {
        const messages = await Message.find({
          conversation: conversation._id,
          createdAt: { $gt: since },
        })
          .sort({ _id: 1 })
          .limit(SYNC_MESSAGE_CAP)
          .populate('sender', 'name');

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
