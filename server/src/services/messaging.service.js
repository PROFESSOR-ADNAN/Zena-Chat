import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Membership from '../models/Membership.js';

export async function sendMessageIdempotent({
  conversationId,
  senderId,
  clientMsgId,
  text,
  attachmentId = null,
  replyToId = null,
  type = 'text',
}) {
  // 1. Check if message already exists with this clientMsgId
  const existing = await Message.findOne({
    conversationId,
    senderId,
    clientMsgId,
  });

  if (existing) {
    return {
      message: existing,
      isDuplicate: true,
    };
  }

  // 2. Atomically increment sequence counters on conversation
  const conv = await Conversation.findByIdAndUpdate(
    conversationId,
    {
      $inc: { lastSeq: 1, lastEventSeq: 1 },
      $set: {
        lastMessageAt: new Date(),
        lastMessage: {
          text: text ? text.substring(0, 100) : '[Attachment]',
          sender: senderId,
          sentAt: new Date(),
        },
      },
    },
    { new: true }
  );

  if (!conv) {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    throw err;
  }

  const assignedSeq = conv.lastSeq;
  const assignedEventSeq = conv.lastEventSeq;

  // 3. Persist the message with unique catch fallback
  try {
    const message = await Message.create({
      conversationId,
      seq: assignedSeq,
      eventSeq: assignedEventSeq,
      senderId,
      clientMsgId,
      type,
      text: text || '',
      attachmentId,
      replyToId,
    });

    // Advance sender's own read and delivery cursors
    await Membership.findOneAndUpdate(
      { conversationId, userId: senderId },
      {
        $max: {
          lastDeliveredSeq: assignedSeq,
          lastReadSeq: assignedSeq,
        },
      }
    );

    return {
      message,
      isDuplicate: false,
    };
  } catch (err) {
    // MongoDB duplicate key error code 11000
    if (err.code === 11000) {
      const racedMessage = await Message.findOne({
        conversationId,
        senderId,
        clientMsgId,
      });
      return {
        message: racedMessage,
        isDuplicate: true,
      };
    }
    throw err;
  }
}

export async function editMessage({ conversationId, messageId, userId, newText }) {
  const message = await Message.findOne({ _id: messageId, conversationId });
  if (!message) {
    const err = new Error('Message not found');
    err.statusCode = 404;
    throw err;
  }

  if (message.senderId.toString() !== userId.toString()) {
    const err = new Error('Cannot edit messages sent by another user');
    err.statusCode = 403;
    throw err;
  }

  const ageMs = Date.now() - new Date(message.createdAt).getTime();
  if (ageMs > 24 * 60 * 60 * 1000) {
    const err = new Error('Edit window (24 hours) has expired');
    err.statusCode = 400;
    throw err;
  }

  // Atomically increment eventSeq for synchronization stream
  const conv = await Conversation.findByIdAndUpdate(
    conversationId,
    { $inc: { lastEventSeq: 1 } },
    { new: true }
  );

  message.text = newText;
  message.editedAt = new Date();
  message.eventSeq = conv.lastEventSeq;
  await message.save();

  return message;
}

export async function deleteMessage({ conversationId, messageId, userId }) {
  const message = await Message.findOne({ _id: messageId, conversationId });
  if (!message) {
    const err = new Error('Message not found');
    err.statusCode = 404;
    throw err;
  }

  if (message.senderId.toString() !== userId.toString()) {
    const err = new Error('Cannot delete messages sent by another user');
    err.statusCode = 403;
    throw err;
  }

  const ageMs = Date.now() - new Date(message.createdAt).getTime();
  if (ageMs > 24 * 60 * 60 * 1000) {
    const err = new Error('Delete window (24 hours) has expired');
    err.statusCode = 400;
    throw err;
  }

  const conv = await Conversation.findByIdAndUpdate(
    conversationId,
    { $inc: { lastEventSeq: 1 } },
    { new: true }
  );

  // Soft delete tombstone
  message.text = '';
  message.deletedAt = new Date();
  message.eventSeq = conv.lastEventSeq;
  await message.save();

  return message;
}

export async function markReceipt({ conversationId, userId, deliveredUpToSeq, readUpToSeq }) {
  const updates = {};
  if (deliveredUpToSeq) updates.lastDeliveredSeq = deliveredUpToSeq;
  if (readUpToSeq) updates.lastReadSeq = readUpToSeq;

  const membership = await Membership.findOneAndUpdate(
    { conversationId, userId },
    { $max: updates },
    { new: true }
  );

  return membership;
}

export async function syncConversationEvents({ cursors, limit = 100 }) {
  const events = [];
  let hasMore = false;

  for (const [convId, clientCursor] of Object.entries(cursors)) {
    const messages = await Message.find({
      conversationId: convId,
      eventSeq: { $gt: clientCursor },
    })
      .sort({ eventSeq: 1 })
      .limit(limit + 1)
      .populate('senderId', 'username displayName avatarUrl');

    if (messages.length > limit) {
      hasMore = true;
      messages.pop();
    }

    for (const msg of messages) {
      events.push({
        type: msg.deletedAt ? 'delete' : msg.editedAt ? 'edit' : 'message',
        conversationId: convId,
        eventSeq: msg.eventSeq,
        data: msg,
      });
    }
  }

  return { events, hasMore };
}
