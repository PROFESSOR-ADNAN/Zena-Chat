import { redis } from '../config/redis.js';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';

const presenceKey = (userId) => `presence:user:${userId}`;

// Was an in-memory Map through phase 3 — correct on one process, wrong
// the moment there's more than one, since each instance only knew about
// its own connections. Redis is the shared store every instance reads
// and writes, so "is this user online" means the same thing regardless
// of which instance answers the question.
export const isUserOnline = async (userId) => {
  const count = await redis.scard(presenceKey(userId));
  return count > 0;
};

// Returns true only on the transition INTO online — this was the user's
// first active connection anywhere in the cluster, not just another tab.
export const registerConnection = async (userId, socketId) => {
  const key = presenceKey(userId);
  await redis.sadd(key, socketId);
  const count = await redis.scard(key);
  return count === 1;
  // SADD then SCARD isn't a single atomic step — two connections from
  // the very same user landing on different instances in the same
  // instant could both see count === 1 and both fire a "just came
  // online" broadcast. Worth naming rather than pretending it can't
  // happen: unlike the marketplace project's stock counts, an
  // occasional duplicate presence update is a harmless UI blip, not a
  // correctness bug, so it doesn't earn the same transactional
  // treatment that money and inventory did there.
};

// Returns true only on the transition INTO offline — this was the
// user's LAST active connection closing, anywhere in the cluster.
export const registerDisconnection = async (userId, socketId) => {
  const key = presenceKey(userId);
  await redis.srem(key, socketId);
  const count = await redis.scard(key);
  if (count === 0) {
    await redis.del(key); // tidy up rather than leave an empty set behind
    return true;
  }
  return false;
};

export const getContactIds = async (userId) => {
  const conversations = await Conversation.find({ participants: userId }).select('participants');
  const ids = new Set();
  for (const conversation of conversations) {
    for (const participant of conversation.participants) {
      if (participant.toString() !== userId.toString()) ids.add(participant.toString());
    }
  }
  return [...ids];
};

// Shared by the normal disconnect handler and the reconciliation sweep
// below — "this user has no connections left" means the same thing,
// and should do the same thing, regardless of how it was noticed.
export const handleUserWentOffline = async (io, userId) => {
  const lastSeenAt = new Date();
  await User.findByIdAndUpdate(userId, { lastSeenAt });
  const contactIds = await getContactIds(userId);
  contactIds.forEach((id) =>
    io.to(`user:${id}`).emit('presence:update', { userId, isOnline: false, lastSeenAt })
  );
};

// A crashed instance never runs its sockets' disconnect handlers, which
// would otherwise leave their entries in Redis forever — those users
// would show "online" permanently. This sweep cross-references every
// presence set against which socket ids are ACTUALLY still connected
// ANYWHERE in the cluster right now (fetchSockets() is itself made
// cluster-aware by the Redis adapter, so this reaches every instance,
// not just this one) and removes whatever's left over.
//
// SCAN, not KEYS — KEYS blocks the whole server while it walks the
// entire keyspace; at this project's scale that difference doesn't
// matter yet, but the habit is worth having before it does.
export const reconcilePresence = async (io) => {
  const liveSocketIds = new Set((await io.fetchSockets()).map((s) => s.id));

  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'presence:user:*', 'COUNT', 100);
    cursor = nextCursor;

    for (const key of keys) {
      const userId = key.replace('presence:user:', '');
      const socketIds = await redis.smembers(key);
      const stale = socketIds.filter((id) => !liveSocketIds.has(id));
      if (stale.length === 0) continue;

      await redis.srem(key, ...stale);
      const remaining = await redis.scard(key);
      if (remaining === 0) {
        await redis.del(key);
        await handleUserWentOffline(io, userId);
      }
    }
  } while (cursor !== '0');
};
