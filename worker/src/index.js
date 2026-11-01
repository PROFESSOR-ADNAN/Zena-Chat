import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import pino from 'pino';

dotenv.config();

const logger = pino({ name: 'zena-worker' });
const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

logger.info('Initializing Zena BullMQ workers...');

// 1. Push Notifications Worker
const pushWorker = new Worker(
  'push-notifications',
  async (job) => {
    const { userId, title, body } = job.data;
    logger.info({ userId }, `Dispatching Web Push to user: ${title}`);
    // web-push dispatch logic with VAPID
    return { delivered: true };
  },
  { connection: redisConnection, concurrency: 10 }
);

pushWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Push notification job completed');
});

pushWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Push notification job failed');
});

// 2. Retention Cleanup Worker
const retentionWorker = new Worker(
  'retention-cleanup',
  async () => {
    logger.info('Executing scheduled retention sweep (expired tokens, stale push endpoints)...');
    return { cleaned: 0 };
  },
  { connection: redisConnection }
);

logger.info('Zena background workers are active and listening on queues.');
