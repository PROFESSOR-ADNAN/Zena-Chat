import mongoose from 'mongoose';

const membershipSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member'],
      default: 'member',
    },
    lastDeliveredSeq: {
      type: Number,
      default: 0,
    },
    lastReadSeq: {
      type: Number,
      default: 0,
    },
    mutedUntil: {
      type: Date,
      default: null,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    leftAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

membershipSchema.index({ conversationId: 1, userId: 1 }, { unique: true });

export default mongoose.model('Membership', membershipSchema);
