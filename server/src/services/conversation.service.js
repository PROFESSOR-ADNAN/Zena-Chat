import Conversation from '../models/Conversation.js';

// Used both when sending a message over the socket and when fetching
// history over REST — one place decides "are you allowed in here",
// instead of the check drifting between the two entry points.
export const assertParticipant = (conversation, userId) => {
  const isParticipant = conversation.participants.some((p) => {
    const pId = p?._id ? p._id.toString() : p.toString();
    return pId === userId.toString();
  });
  if (!isParticipant) {
    const err = new Error('Not a participant in this conversation');
    err.statusCode = 403;
    throw err;
  }
};

// A Mongo ObjectId's hex string sorts in creation order (the timestamp
// is its leading bytes) — so plain string comparison doubles as "which
// message came later," no separate timestamp lookup needed.
const isNewer = (candidateId, currentId) => !currentId || candidateId.toString() > currentId.toString();

// Advances a participant's pointer in `field` (lastRead or
// lastDelivered) to `messageId`, but only forward — a read/delivery
// confirmation that arrives out of order (network reordering, a retried
// request) must never regress someone's progress backwards. Returns
// whether it actually advanced, so callers know whether there's
// anything new to broadcast.
const advance = (conversation, field, userId, messageId, atField) => {
  const entry = conversation[field].find((e) => e.user.toString() === userId.toString());
  if (entry && !isNewer(messageId, entry.message)) return false;

  if (entry) {
    entry.message = messageId;
    entry[atField] = new Date();
  } else {
    conversation[field].push({ user: userId, message: messageId, [atField]: new Date() });
  }
  return true;
};

export const markRead = (conversation, userId, messageId) =>
  advance(conversation, 'lastRead', userId, messageId, 'readAt');

export const markDelivered = (conversation, userId, messageId) =>
  advance(conversation, 'lastDelivered', userId, messageId, 'deliveredAt');

export const findOrCreateDM = async (userId, otherUserId) => {
  if (userId.toString() === otherUserId.toString()) {
    const err = new Error('Cannot start a DM with yourself');
    err.statusCode = 400;
    throw err;
  }

  // Sorted so the pair (A, B) and (B, A) produce the same key regardless
  // of who initiated — that's what lets the unique index catch a
  // duplicate no matter which side of the pair creates it.
  const dmKey = [userId.toString(), otherUserId.toString()].sort().join('_');

  const existing = await Conversation.findOne({ dmKey });
  if (existing) return existing;

  try {
    return await Conversation.create({ type: 'dm', participants: [userId, otherUserId], dmKey });
  } catch (err) {
    // Two concurrent first-ever DM requests between the same pair can
    // both miss the findOne above. The unique index on dmKey lets
    // exactly one create() succeed; the loser just re-fetches what the
    // winner made — the same race, and the same fix, as
    // Cart.getOrCreateCart in the marketplace project.
    if (err.code === 11000) {
      return Conversation.findOne({ dmKey });
    }
    throw err;
  }
};
