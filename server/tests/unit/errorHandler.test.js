import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { errorHandler } from '../../src/middleware/errorHandler.js';

process.env.NODE_ENV = 'test';

const mockRes = () => {
  const res = { statusCode: 200 };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

describe('errorHandler', () => {
  test('translates a Mongoose ValidationError into a 400', () => {
    const err = {
      name: 'ValidationError',
      message: 'validation failed',
      errors: { text: { message: 'text is required' } },
    };
    const res = mockRes();
    errorHandler(err, {}, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /text is required/);
  });

  test('translates a CastError (bad ObjectId in a URL) into a 400', () => {
    const err = { name: 'CastError', message: 'Cast failed', path: '_id', value: 'not-an-id' };
    const res = mockRes();
    errorHandler(err, {}, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Invalid _id/);
  });

  test('translates a duplicate-key error into a 409', () => {
    // The shape this project actually triggers it with — a duplicate
    // clientMessageId or dmKey, not email like the marketplace project.
    const err = { message: 'dup', code: 11000, keyValue: { clientMessageId: 'abc-123' } };
    const res = mockRes();
    errorHandler(err, {}, res, () => {});
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /clientMessageId/);
  });

  test('respects a custom err.statusCode, e.g. assertParticipant', () => {
    const err = { statusCode: 403, message: 'Not a participant in this conversation' };
    const res = mockRes();
    errorHandler(err, {}, res, () => {});
    assert.equal(res.statusCode, 403);
  });

  test('falls back to 500 for an unrecognized error', () => {
    const res = mockRes();
    errorHandler(new Error('something unexpected'), {}, res, () => {});
    assert.equal(res.statusCode, 500);
  });
});
