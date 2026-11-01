import http from 'http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../src/app.js';
import { initSocket } from '../../../src/socket/index.js';
import { redis } from '../../../src/config/redis.js';

// No replica set needed here, unlike the marketplace project's test
// setup — nothing in this codebase uses a multi-document transaction.
// The idempotent-send and DM-dedup patterns both rely on a single
// unique index instead, which works on a plain standalone MongoDB. A
// bare MongoMemoryServer starts faster and is simpler.
export const startTestEnvironment = async () => {
  process.env.JWT_SECRET ||= 'test-secret';
  process.env.JWT_EXPIRES_IN ||= '1h';

  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // http.createServer + initSocket, same as server.js — app.listen()
  // alone wouldn't attach Socket.IO, and the socket layer (join, send,
  // read receipts) is most of what actually needs testing in this
  // project.
  const httpServer = http.createServer(app);
  const io = initSocket(httpServer);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address();

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    io,
    stop: async () => {
      io.redisSubClient?.disconnect();
      io.close();
      await new Promise((resolve) => httpServer.close(resolve));
      await mongoose.disconnect();
      await mongod.stop();
      redis.disconnect();
    },
  };
};

export const jsonRequest = (baseUrl, path, { method = 'GET', body, token } = {}) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => ({ status: res.status, body: await res.json().catch(() => null) }));

// Redis is real here, not in-memory-simulated the way Mongo is above —
// this project already requires a real Redis to run at all (the
// adapter and presence both depend on it), so tests lean on the same
// thing rather than adding a second, fake-Redis-just-for-tests
// dependency. Flushed between test files so leftover presence keys
// don't leak across runs — never point REDIS_URL at anything you care
// about when running these.
export const flushRedis = () => redis.flushdb();
