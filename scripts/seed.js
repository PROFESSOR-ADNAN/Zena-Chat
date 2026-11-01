import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../server/src/models/User.js';
import Conversation from '../server/src/models/Conversation.js';
import Membership from '../server/src/models/Membership.js';
import Message from '../server/src/models/Message.js';

dotenv.config({ path: 'server/.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chat';

async function seed() {
  console.log('Connecting to MongoDB at:', MONGO_URI);
  await mongoose.connect(MONGO_URI);

  console.log('Clearing existing data...');
  await User.deleteMany({});
  await Conversation.deleteMany({});
  await Membership.deleteMany({});
  await Message.deleteMany({});

  console.log('Creating 20 users...');
  const users = [];
  for (let i = 1; i <= 20; i++) {
    const user = await User.create({
      username: `user_${i}`,
      displayName: `User ${i}`,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      password: 'Password123!',
      role: i === 1 ? 'admin' : 'user',
    });
    users.push(user);
  }

  console.log('Creating group conversations...');
  const group1 = await Conversation.create({
    type: 'group',
    name: 'Addis Ababa Tech Hub',
    participants: users.slice(0, 10).map((u) => u._id),
    createdBy: users[0]._id,
    lastSeq: 0,
    lastEventSeq: 0,
  });

  for (const user of users.slice(0, 10)) {
    await Membership.create({
      conversationId: group1._id,
      userId: user._id,
      role: user._id.equals(users[0]._id) ? 'owner' : 'member',
    });
  }

  console.log('Database successfully seeded with 20 users and sample group conversations.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
