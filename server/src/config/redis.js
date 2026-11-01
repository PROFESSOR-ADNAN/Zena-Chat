import { Redis } from 'ioredis';

// One client, reused for presence commands (SADD/SREM/SCARD) and as the
// base for the Socket.IO adapter's pub/sub pair (socket/index.js
// duplicates it for the subscriber side — PUBLISH doesn't require a
// dedicated connection the way SUBSCRIBE does, so this same client can
// serve as the adapter's "pub" client too).
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('error', (err) => console.error('Redis error:', err.message));
