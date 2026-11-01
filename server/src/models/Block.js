import mongoose from 'mongoose';

const blockSchema = new mongoose.Schema(
  {
    blockerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    blockedId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

export default mongoose.model('Block', blockSchema);
