import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redis } from '../config/redis.js';
import { verifyTokenAndGetUser } from '../middleware/auth.js';
import Conversation from '../models/Conversation.js';
import { assertParticipant } from '../services/conversation.service.js';
import {
  sendMessageIdempotent,
  editMessage,
  deleteMessage,
  markReceipt,
  syncConversationEvents,
} from '../services/messaging.service.js';
import {
  registerConnection,
  registerDisconnection,
  isUserOnline,
  getContactIds,
  handleUserWentOffline,
} from '../services/presence.service.js';
import {
  MessageSendEventSchema,
  MessageEditEventSchema,
  MessageDeleteEventSchema,
  ReceiptDeliveredEventSchema,
  ReceiptReadEventSchema,
  SyncRequestEventSchema,
  TypingStartEventSchema,
  TypingStopEventSchema,
} from '@zena/shared';

const httpError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL || '*' },
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 64 * 1024, // 64 KB limit
  });

  // Cross-node Redis Adapter
  const subClient = redis.duplicate();
  subClient.on('error', (err) => console.error('Redis (sub) error:', err.message));
  io.adapter(createAdapter(redis, subClient));
  io.redisSubClient = subClient;

  // Cross-Node Auth Control Channel: handles instant suspension across all gateway replicas
  const controlSub = redis.duplicate();
  controlSub.subscribe('auth:control', (err) => {
    if (err) console.error('Failed to subscribe to auth:control:', err.message);
  });
  controlSub.on('message', async (channel, message) => {
    if (channel === 'auth:control') {
      try {
        const { action, userId } = JSON.parse(message);
        if (action === 'disconnect' && userId) {
          const sockets = await io.in(`user:${userId}`).fetchSockets();
          for (const s of sockets) {
            s.emit('auth:revoked', { reason: 'Session terminated or account suspended' });
            s.disconnect(true);
          }
        }
      } catch (err) {
        console.error('Error handling auth:control message:', err);
      }
    }
  });
  io.controlSub = controlSub;

  // Socket Handshake Authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Not authorized: Token missing'));

      const user = await verifyTokenAndGetUser(token);
      if (!user) return next(new Error('Not authorized: Invalid token'));
      if (user.isSuspended) return next(new Error('Account suspended'));

      socket.user = user;
      socket.deviceId = socket.handshake.auth?.deviceId || 'default';
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    const deviceId = socket.deviceId;

    // Join personal user room for targeted notifications
    socket.join(`user:${userId}`);

    try {
      const justCameOnline = await registerConnection(userId, `${socket.id}:${deviceId}`);
      const contactIds = await getContactIds(userId);

      // Initial presence snapshot
      const snapshot = await Promise.all(
        contactIds.map(async (id) => ({
          userId: id,
          isOnline: await isUserOnline(id),
        }))
      );
      socket.emit('presence:snapshot', snapshot);

      if (justCameOnline) {
        contactIds.forEach((id) =>
          io.to(`user:${id}`).emit('presence:update', { userId, isOnline: true })
        );
      }
    } catch (err) {
      console.error('Presence connect error:', err);
    }

    socket.on('disconnect', async () => {
      try {
        const justWentOffline = await registerDisconnection(userId, `${socket.id}:${deviceId}`);
        if (justWentOffline) await handleUserWentOffline(io, userId);
      } catch (err) {
        console.error('Presence disconnect error:', err);
      }
    });

    // Room join
    socket.on('conversation:join', async (conversationId, callback) => {
      try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) throw httpError('Conversation not found', 404);
        assertParticipant(conversation, socket.user._id);

        socket.join(conversationId);
        callback?.({ ok: true });
      } catch (err) {
        callback?.({ ok: false, message: err.message });
      }
    });

    // Idempotent message send
    socket.on('message:send', async (payload = {}, callback) => {
      try {
        const parsed = MessageSendEventSchema.safeParse(payload);
        if (!parsed.success) {
          throw httpError(parsed.error.errors[0]?.message || 'Invalid payload', 400);
        }

        const { conversationId, clientMsgId, text, attachmentId, replyToId } = parsed.data;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) throw httpError('Conversation not found', 404);
        assertParticipant(conversation, socket.user._id);

        const { message, isDuplicate } = await sendMessageIdempotent({
          conversationId,
          senderId: socket.user._id,
          clientMsgId,
          text,
          attachmentId,
          replyToId,
        });

        const populated = await message.populate('senderId', 'username displayName avatarUrl');

        if (!isDuplicate) {
          // Broadcast to conversation room across all replicas via Redis adapter
          io.to(conversationId).emit('message:new', {
            _id: populated._id,
            conversationId: populated.conversationId,
            seq: populated.seq,
            eventSeq: populated.eventSeq,
            senderId: populated.senderId?._id || populated.senderId,
            senderUsername: populated.senderId?.username || socket.user.username,
            senderDisplayName: populated.senderId?.displayName || socket.user.displayName,
            clientMsgId: populated.clientMsgId,
            type: populated.type,
            text: populated.text,
            attachmentId: populated.attachmentId,
            replyToId: populated.replyToId,
            createdAt: populated.createdAt.toISOString(),
          });
        }

        callback?.({
          ok: true,
          serverMsgId: populated._id,
          seq: populated.seq,
          createdAt: populated.createdAt.toISOString(),
          isDuplicate,
        });
      } catch (err) {
        callback?.({ ok: false, message: err.message });
      }
    });

    // Delivery and read receipts
    socket.on('receipt:delivered', async (payload = {}, callback) => {
      try {
        const { conversationId, upToSeq } = ReceiptDeliveredEventSchema.parse(payload);
        await markReceipt({ conversationId, userId: socket.user._id, deliveredUpToSeq: upToSeq });

        io.to(conversationId).emit('receipt:update', {
          conversationId,
          userId,
          deliveredSeq: upToSeq,
          updatedAt: new Date().toISOString(),
        });
        callback?.({ ok: true });
      } catch (err) {
        callback?.({ ok: false, message: err.message });
      }
    });

    socket.on('receipt:read', async (payload = {}, callback) => {
      try {
        const { conversationId, upToSeq } = ReceiptReadEventSchema.parse(payload);
        await markReceipt({ conversationId, userId: socket.user._id, readUpToSeq: upToSeq });

        io.to(conversationId).emit('receipt:update', {
          conversationId,
          userId,
          readSeq: upToSeq,
          updatedAt: new Date().toISOString(),
        });
        callback?.({ ok: true });
      } catch (err) {
        callback?.({ ok: false, message: err.message });
      }
    });

    // Sync by cursor protocol
    socket.on('sync:request', async (payload = {}, callback) => {
      try {
        const { cursors } = SyncRequestEventSchema.parse(payload);
        const { events, hasMore } = await syncConversationEvents({ cursors });
        callback?.({ ok: true, events, hasMore });
      } catch (err) {
        callback?.({ ok: false, message: err.message });
      }
    });

    // Ephemeral typing events
    socket.on('typing:start', async (payload = {}) => {
      try {
        const { conversationId } = TypingStartEventSchema.parse(payload);
        socket.to(conversationId).emit('typing:update', {
          conversationId,
          userId,
          username: socket.user.username,
          isTyping: true,
        });
      } catch (err) {}
    });

    socket.on('typing:stop', async (payload = {}) => {
      try {
        const { conversationId } = TypingStopEventSchema.parse(payload);
        socket.to(conversationId).emit('typing:update', {
          conversationId,
          userId,
          username: socket.user.username,
          isTyping: false,
        });
      } catch (err) {}
    });
  });

  return io;
};
