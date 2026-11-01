import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['dm', 'group'],
      required: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 64,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    dmKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    lastSeq: {
      type: Number,
      default: 0,
      index: true,
    },
    lastEventSeq: {
      type: Number,
      default: 0,
      index: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastMessage: {
      text: String,
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      sentAt: Date,
      seq: Number,
    },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });

export default mongoose.model('Conversation', conversationSchema);
