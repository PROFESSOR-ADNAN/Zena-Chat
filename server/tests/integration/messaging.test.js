import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import { startTestEnvironment, jsonRequest, flushRedis } from './helpers/testApp.js';

const connectSocket = (baseUrl, token) =>
  new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, { auth: { token }, reconnection: false, timeout: 3000 });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });

const emitWithAck = (socket, event, payload) =>
  new Promise((resolve) => socket.emit(event, payload, resolve));

describe('messaging flow (integration)', () => {
  let env;
  let userA;
  let userB;
  let conversationId;

  before(async () => {
    env = await startTestEnvironment();

    const a = await jsonRequest(env.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { name: 'User A', email: 'a@test.com', password: 'password123' },
    });
    const b = await jsonRequest(env.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { name: 'User B', email: 'b@test.com', password: 'password123' },
    });
    userA = a.body;
    userB = b.body;

    const dm = await jsonRequest(env.baseUrl, '/api/conversations/dm', {
      method: 'POST',
      token: userA.token,
      body: { userId: userB._id },
    });
    conversationId = dm.body._id;
  });

  after(async () => {
    await flushRedis();
    await env.stop();
  });

  test('a message sent by A is received by B, and a retry does not duplicate it', async () => {
    const socketA = await connectSocket(env.baseUrl, userA.token);
    const socketB = await connectSocket(env.baseUrl, userB.token);

    const joinA = await emitWithAck(socketA, 'conversation:join', conversationId);
    const joinB = await emitWithAck(socketB, 'conversation:join', conversationId);
    assert.equal(joinA.ok, true);
    assert.equal(joinB.ok, true);

    const receivedByB = [];
    socketB.on('message:new', (msg) => receivedByB.push(msg));

    const clientMessageId = randomUUID();
    const firstSend = await emitWithAck(socketA, 'message:send', {
      conversationId,
      text: 'hello from A',
      clientMessageId,
    });
    assert.equal(firstSend.ok, true);
    assert.equal(firstSend.message.text, 'hello from A');

    // Simulates the ack for the first send getting lost on a flaky
    // connection — the client can't tell it went through, so it retries
    // with the SAME clientMessageId, exactly as a real client would.
    const retrySend = await emitWithAck(socketA, 'message:send', {
      conversationId,
      text: 'hello from A',
      clientMessageId,
    });
    assert.equal(retrySend.ok, true);
    assert.equal(
      retrySend.message._id,
      firstSend.message._id,
      'the retry returns the SAME message, not a new one'
    );

    // Give the (non-duplicate) broadcast a moment to arrive before
    // checking how many times it fired.
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(receivedByB.length, 1, 'B should receive exactly one message:new, not two');

    socketA.close();
    socketB.close();
  });

  test('marking a message read broadcasts message:read to the other participant', async () => {
    const socketA = await connectSocket(env.baseUrl, userA.token);
    const socketB = await connectSocket(env.baseUrl, userB.token);
    await emitWithAck(socketA, 'conversation:join', conversationId);
    await emitWithAck(socketB, 'conversation:join', conversationId);

    const sent = await emitWithAck(socketA, 'message:send', {
      conversationId,
      text: 'read me',
      clientMessageId: randomUUID(),
    });
    assert.equal(sent.ok, true);

    const readEvent = new Promise((resolve) => socketA.once('message:read', resolve));

    const markRead = await emitWithAck(socketB, 'message:markRead', {
      conversationId,
      messageId: sent.message._id,
    });
    assert.equal(markRead.ok, true);

    const event = await readEvent;
    assert.equal(event.messageId, sent.message._id);
    assert.equal(event.userId, userB._id);

    socketA.close();
    socketB.close();
  });
});
