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
  const clientUrlEnv = process.env.CLIENT_URL;
  const corsOrigin = clientUrlEnv
    ? clientUrlEnv.includes(',')
      ? clientUrlEnv.split(',').map((s) => s.trim())
      : clientUrlEnv
    : '*';

  const io = new Server(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
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

    // Auto-join all existing conversations for this user so they receive messages instantly
    try {
      const userConvs = await Conversation.find({
        $or: [
          { participants: socket.user._id },
          { name: { $regex: '^General Chat$', $options: 'i' } },
        ],
      }).select('_id');
      for (const c of userConvs) {
        socket.join(c._id.toString());
      }
    } catch (e) {
      console.warn('Auto-join user rooms error:', e.message);
    }

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
        let conversation = await Conversation.findById(conversationId);
        if (!conversation) throw httpError('Conversation not found', 404);

        if (
          conversation.name?.toLowerCase().trim() === 'general chat' &&
          !conversation.participants.some((p) => (p?._id || p).toString() === socket.user._id.toString())
        ) {
          conversation.participants.push(socket.user._id);
          await conversation.save();
        }

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
        const {
          conversationId,
          clientMsgId,
          text,
          attachmentId,
          replyToId,
          replyTo,
          type = 'text',
          mediaUrl = null,
          fileName = null,
          fileSize = 0,
        } = payload;

        if (!conversationId || !clientMsgId) {
          throw httpError('conversationId and clientMsgId are required', 400);
        }
        if (!text && !attachmentId && !mediaUrl) {
          throw httpError('Message must have text or attachment', 400);
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) throw httpError('Conversation not found', 404);
        assertParticipant(conversation, socket.user._id);

        // Check if recipient has blocked sender in DMs
        if (conversation.type === 'dm') {
          const otherUserId = conversation.participants.find(
            (p) => p.toString() !== socket.user._id.toString()
          );
          if (otherUserId) {
            const recipient = await User.findById(otherUserId);
            if (recipient?.blockedUsers?.some((b) => b.toString() === socket.user._id.toString())) {
              throw httpError('You cannot message this user because you have been blocked.', 403);
            }
          }
        }

        const { message, isDuplicate } = await sendMessageIdempotent({
          conversationId,
          senderId: socket.user._id,
          clientMsgId,
          text,
          attachmentId,
          replyToId,
          replyTo,
          type,
          mediaUrl,
          fileName,
          fileSize,
        });

        const populated = await message.populate('senderId', 'username displayName avatarUrl');

        if (!isDuplicate) {
          const messageData = {
            _id: populated._id,
            conversationId: populated.conversationId,
            seq: populated.seq,
            eventSeq: populated.eventSeq,
            senderId: populated.senderId?._id || populated.senderId,
            senderUsername: populated.senderId?.username || socket.user.username,
            senderDisplayName: populated.senderId?.displayName || socket.user.displayName,
            clientMsgId: populated.clientMsgId,
            type: populated.type || 'text',
            text: populated.text,
            mediaUrl: populated.mediaUrl || null,
            fileName: populated.fileName || null,
            fileSize: populated.fileSize || 0,
            attachmentId: populated.attachmentId,
            replyToId: populated.replyToId,
            replyTo: populated.replyTo || null,
            reactions: populated.reactions || [],
            createdAt: populated.createdAt.toISOString(),
          };

          // If it's General Chat, broadcast to all users
          if (conversation.name?.toLowerCase().trim() === 'general chat') {
            io.emit('message:new', messageData);
          } else {
            // For separate rooms and DMs, broadcast to room & user rooms without duplicating
            let target = io.to(conversationId);
            for (const p of conversation.participants) {
              const pId = (p?._id || p).toString();
              target = target.to(`user:${pId}`);
            }
            target.emit('message:new', messageData);
          }
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
        callback?.({ ok: false, message: err.message });
      }
    });

    // Message edit event
    socket.on('message:edit', async (payload = {}, callback) => {
      try {
        const { conversationId, messageId, text } = payload;
        const updated = await editMessage({
          conversationId,
          messageId,
          userId: socket.user._id,
          newText: text,
        });

        const eventData = {
          _id: updated._id,
          conversationId,
          text: updated.text,
          editedAt: updated.editedAt?.toISOString?.() || new Date().toISOString(),
        };

        const conversation = await Conversation.findById(conversationId);
        if (conversation?.name?.toLowerCase().trim() === 'general chat') {
          io.emit('message:edited', eventData);
        } else {
          io.to(conversationId).emit('message:edited', eventData);
          if (conversation?.participants) {
            for (const p of conversation.participants) {
              const pId = p?._id ? p._id.toString() : p.toString();
              io.to(`user:${pId}`).emit('message:edited', eventData);
            }
          }
        }
        callback?.({ ok: true, message: updated });
      } catch (err) {
        callback?.({ ok: false, message: err.message });
      }
    });

    // Message delete event
    socket.on('message:delete', async (payload = {}, callback) => {
      try {
        const { conversationId, messageId } = payload;
        await deleteMessage({
          conversationId,
          messageId,
          userId: socket.user._id,
        });

        const delData = {
          _id: messageId,
          conversationId,
        };

        const conversation = await Conversation.findById(conversationId);
        if (conversation?.name?.toLowerCase().trim() === 'general chat') {
          io.emit('message:deleted', delData);
        } else {
          io.to(conversationId).emit('message:deleted', delData);
          if (conversation?.participants) {
            for (const p of conversation.participants) {
              const pId = p?._id ? p._id.toString() : p.toString();
              io.to(`user:${pId}`).emit('message:deleted', delData);
            }
          }
        }
        callback?.({ ok: true });
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

    // Message reactions (👍, ❤️, 😂, 🔥, 👏)
    socket.on('message:reaction', async (payload = {}, callback) => {
      try {
        const { conversationId, messageId, emoji } = payload;
        if (!conversationId || !messageId || !emoji) return callback?.({ ok: false });
        const conv = await Conversation.findById(conversationId);
        if (!conv) return callback?.({ ok: false, message: 'Conversation not found' });
        assertParticipant(conv, socket.user._id);

        const msg = await Message.findById(messageId);
        if (!msg) return callback?.({ ok: false, message: 'Message not found' });

        if (!msg.reactions) msg.reactions = [];
        const existingIdx = msg.reactions.findIndex(
          (r) => r.userId.toString() === socket.user._id.toString() && r.emoji === emoji
        );

        if (existingIdx >= 0) {
          msg.reactions.splice(existingIdx, 1);
        } else {
          msg.reactions.push({
            emoji,
            userId: socket.user._id,
            username: socket.user.username,
            displayName: socket.user.displayName || socket.user.username,
          });
        }

        await msg.save();

        io.to(conversationId).emit('message:reaction', {
          conversationId,
          messageId,
          reactions: msg.reactions,
        });

        callback?.({ ok: true, reactions: msg.reactions });
      } catch (err) {
        callback?.({ ok: false, message: err.message });
      }
    });

    // Pinned messages
    socket.on('conversation:pin', async (payload = {}, callback) => {
      try {
        const { conversationId, messageId } = payload;
        const conv = await Conversation.findById(conversationId);
        if (!conv) return callback?.({ ok: false, message: 'Conversation not found' });
        assertParticipant(conv, socket.user._id);

        conv.pinnedMessage = messageId || null;
        await conv.save();

        const populatedMsg = messageId
          ? await Message.findById(messageId).populate('senderId', 'username displayName')
          : null;

        io.to(conversationId).emit('conversation:pinned', {
          conversationId,
          pinnedMessage: populatedMsg,
        });

        callback?.({ ok: true, pinnedMessage: populatedMsg });
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
          displayName: socket.user.displayName || socket.user.username,
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
          displayName: socket.user.displayName || socket.user.username,
          isTyping: false,
        });
      } catch (err) {}
    });
  });

  return io;
};
