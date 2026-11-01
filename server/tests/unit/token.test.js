import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { generateToken } from '../../src/utils/generateToken.js';

process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';

describe('generateToken', () => {
  test('produces a token that decodes back to the given id', () => {
    const token = generateToken('507f1f77bcf86cd799439011');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    assert.equal(decoded.id, '507f1f77bcf86cd799439011');
  });

  test('is rejected when verified with the wrong secret', () => {
    const token = generateToken('507f1f77bcf86cd799439011');
    assert.throws(() => jwt.verify(token, 'the-wrong-secret'));
  });
});
