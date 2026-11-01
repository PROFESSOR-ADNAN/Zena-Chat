import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { isUserOnline, registerConnection, registerDisconnection } from '../../src/services/presence.service.js';
import { redis } from '../../src/config/redis.js';

// Unlike the rest of tests/integration/, this file needs only Redis, not
// Mongo — isUserOnline/registerConnection/registerDisconnection never
// touch the database. Kept separate from messaging.test.js so this one
// can run (and be trusted) on its own even somewhere Mongo isn't set up.
describe('presence (real Redis)', () => {
  const testUser = `test-presence-user-${Date.now()}`;

  after(async () => {
    await redis.del(`presence:user:${testUser}`);
    // Without this, the process never exits on its own — an open ioredis
    // connection keeps the event loop alive indefinitely. Found this by
    // actually running the suite, not by inspection.
    redis.disconnect();
  });

  test('multi-connection first-in/last-out semantics', async () => {
    assert.equal(
      await registerConnection(testUser, 'socket-a'),
      true,
      'first connection is a transition to online'
    );
    assert.equal(
      await registerConnection(testUser, 'socket-b'),
      false,
      'a second connection from the same user is not a new transition'
    );
    assert.equal(await isUserOnline(testUser), true);

    assert.equal(
      await registerDisconnection(testUser, 'socket-a'),
      false,
      'closing one of two connections does not go offline'
    );
    assert.equal(await isUserOnline(testUser), true, 'still online — socket-b is still connected');

    assert.equal(
      await registerDisconnection(testUser, 'socket-b'),
      true,
      'closing the LAST connection is the transition to offline'
    );
    assert.equal(await isUserOnline(testUser), false);
  });

  test('a user who never connected is not online', async () => {
    assert.equal(await isUserOnline(`never-connected-${Date.now()}`), false);
  });
});
