import { Router } from 'express';
import mongoose from 'mongoose';
import { redis } from '../config/redis.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

const router = Router();

router.get('/system', async (req, res) => {
  try {
    const start = Date.now();
    let redisLatency = -1;
    let redisConnected = false;

    try {
      await redis.ping();
      redisLatency = Date.now() - start;
      redisConnected = true;
    } catch {}

    const mongoState = mongoose.connection.readyState;
    const mongoStatusMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

    const io = req.app.get('io');
    const socketCount = io ? io.engine?.clientsCount || 0 : 0;

    const [userCount, convCount, messageCount] = await Promise.all([
      User.countDocuments().catch(() => 0),
      Conversation.countDocuments().catch(() => 0),
      Message.countDocuments().catch(() => 0),
    ]);

    const memUsage = process.memoryUsage();

    res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      gateway: {
        replicasConfigured: 3,
        activeSocketConnections: socketCount,
        corsOrigin: process.env.CLIENT_URL || '*',
        nodeVersion: process.version,
      },
      redis: {
        status: redisConnected ? 'connected' : 'disconnected',
        pingLatencyMs: redisLatency,
        adapter: '@socket.io/redis-adapter (ioredis)',
      },
      database: {
        status: mongoStatusMap[mongoState] || 'unknown',
        totalUsers: userCount,
        totalConversations: convCount,
        totalMessages: messageCount,
      },
      memory: {
        rssMb: Math.round((memUsage.rss / 1024 / 1024) * 100) / 100,
        heapUsedMb: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100,
      },
      protocols: {
        offlineFirstOutbox: 'Dexie.js IndexedDB',
        monotonicOrdering: 'Atomic seq & eventSeq',
        idempotency: 'Client-generated UUIDs (clientMsgId)',
        presence: 'Redis TTL keys with mutual contact fanout',
      },
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;
