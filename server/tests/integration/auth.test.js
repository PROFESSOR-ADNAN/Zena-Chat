import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestEnvironment, jsonRequest } from './helpers/testApp.js';

describe('auth flow (integration)', () => {
  let env;

  before(async () => {
    env = await startTestEnvironment();
  });

  after(async () => {
    await env.stop();
  });

  test('register creates a user and returns a token', async () => {
    const { status, body } = await jsonRequest(env.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { name: 'Test User', email: 'user@test.com', password: 'password123' },
    });
    assert.equal(status, 201);
    assert.ok(body.token);
    assert.equal(body.email, 'user@test.com');
    // No role in the response, unlike the marketplace project's auth —
    // this project's User model doesn't have one.
    assert.equal(body.role, undefined);
  });

  test('registering the same email twice is rejected', async () => {
    await jsonRequest(env.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { name: 'Dup', email: 'dup@test.com', password: 'password123' },
    });
    const { status } = await jsonRequest(env.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { name: 'Dup Again', email: 'dup@test.com', password: 'password123' },
    });
    assert.equal(status, 409);
  });

  test('login succeeds with correct credentials, fails with the wrong password', async () => {
    await jsonRequest(env.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { name: 'Login Test', email: 'login@test.com', password: 'password123' },
    });

    const good = await jsonRequest(env.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'login@test.com', password: 'password123' },
    });
    assert.equal(good.status, 200);
    assert.ok(good.body.token);

    const bad = await jsonRequest(env.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'login@test.com', password: 'wrong-password' },
    });
    assert.equal(bad.status, 401);
  });

  test('/api/auth/me requires a valid token', async () => {
    const noToken = await jsonRequest(env.baseUrl, '/api/auth/me');
    assert.equal(noToken.status, 401);

    const { body: registered } = await jsonRequest(env.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { name: 'Me Test', email: 'me@test.com', password: 'password123' },
    });

    const withToken = await jsonRequest(env.baseUrl, '/api/auth/me', { token: registered.token });
    assert.equal(withToken.status, 200);
    assert.equal(withToken.body.email, 'me@test.com');
  });
});
