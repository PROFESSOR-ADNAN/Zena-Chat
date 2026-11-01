import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    seq: {
      type: Number,
      required: true,
    },
    eventSeq: {
      type: Number,
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    clientMsgId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['text', 'image'],
      default: 'text',
    },
    text: {
      type: String,
      default: '',
    },
    attachmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attachment',
      default: null,
    },
    replyToId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound unique index for strict idempotency per sender within conversation
messageSchema.index(
  { conversationId: 1, senderId: 1, clientMsgId: 1 },
  { unique: true }
);

// Sequence and sync cursor ordering indexes
messageSchema.index({ conversationId: 1, seq: 1 });
messageSchema.index({ conversationId: 1, eventSeq: 1 });

export default mongoose.model('Message', messageSchema);
