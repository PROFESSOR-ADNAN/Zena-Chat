import { io as ioClient } from 'socket.io-client';

const URL = process.env.TEST_URL || 'http://localhost:5061';

const test = (label, token) =>
  new Promise((resolve) => {
    const socket = ioClient(URL, { auth: { token }, reconnection: false, timeout: 3000 });
    const done = (result) => {
      socket.close();
      resolve(result);
    };
    socket.on('connect', () => done({ label, outcome: 'connected' }));
    socket.on('connect_error', (err) => done({ label, outcome: 'rejected', message: err.message }));
    setTimeout(() => done({ label, outcome: 'timeout' }), 4000);
  });

const run = async () => {
  const results = await Promise.all([
    test('no token', undefined),
    test('garbage token', 'not-a-real-jwt'),
  ]);

  for (const r of results) {
    console.log(`${r.label}: ${r.outcome}${r.message ? ` (${r.message})` : ''}`);
  }

  const allRejected = results.every((r) => r.outcome === 'rejected');
  console.log(allRejected ? '\n✅ Both unauthenticated connections were correctly rejected' : '\n❌ Unexpected: something connected without valid auth');
  process.exit(allRejected ? 0 : 1);
};

run();
