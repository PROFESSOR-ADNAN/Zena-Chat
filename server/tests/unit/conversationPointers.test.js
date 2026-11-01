import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { markRead, markDelivered, assertParticipant } from '../../src/services/conversation.service.js';

describe('markRead / markDelivered (forward-only pointers)', () => {
  test('the first mark creates an entry', () => {
    const conversation = { lastRead: [], lastDelivered: [] };
    assert.equal(markRead(conversation, 'user-1', 'msg-b'), true);
    assert.equal(conversation.lastRead[0].message, 'msg-b');
  });

  test('an older message does not regress an existing pointer', () => {
    const conversation = {
      lastRead: [{ user: 'user-1', message: 'msg-b', readAt: new Date() }],
      lastDelivered: [],
    };
    assert.equal(markRead(conversation, 'user-1', 'msg-a'), false);
    assert.equal(conversation.lastRead[0].message, 'msg-b'); // unchanged
  });

  test('a newer message advances an existing pointer', () => {
    const conversation = {
      lastRead: [{ user: 'user-1', message: 'msg-b', readAt: new Date() }],
      lastDelivered: [],
    };
    assert.equal(markRead(conversation, 'user-1', 'msg-d'), true);
    assert.equal(conversation.lastRead[0].message, 'msg-d');
  });

  test('read and delivered are independent pointers', () => {
    const conversation = { lastRead: [], lastDelivered: [] };
    markRead(conversation, 'user-1', 'msg-d');
    markDelivered(conversation, 'user-1', 'msg-c');
    assert.equal(conversation.lastRead[0].message, 'msg-d');
    assert.equal(conversation.lastDelivered[0].message, 'msg-c');
  });

  test('tracks each user separately', () => {
    const conversation = { lastRead: [], lastDelivered: [] };
    markRead(conversation, 'user-1', 'msg-b');
    markRead(conversation, 'user-2', 'msg-a');
    assert.equal(conversation.lastRead.length, 2);
  });
});

describe('assertParticipant', () => {
  test('does not throw for an actual participant', () => {
    const conversation = { participants: ['user-1', 'user-2'] };
    assert.doesNotThrow(() => assertParticipant(conversation, 'user-1'));
  });

  test('throws a 403 for a non-participant', () => {
    const conversation = { participants: ['user-1', 'user-2'] };
    assert.throws(
      () => assertParticipant(conversation, 'user-3'),
      (err) => err.statusCode === 403
    );
  });
});
