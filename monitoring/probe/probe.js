import { io } from 'socket.io-client';

const TARGET_URL = process.env.GATEWAY_URL || 'http://localhost:8080';
console.log(`Starting Zena Synthetic Chat Probe against ${TARGET_URL}...`);

const socket = io(TARGET_URL, {
  transports: ['websocket'],
  auth: { token: 'probe_token' },
});

socket.on('connect', () => {
  console.log('✔ Synthetic Probe connected successfully.');
  process.exit(0);
});

socket.on('connect_error', (err) => {
  console.error('✖ Synthetic Probe connection failed:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.error('✖ Synthetic Probe timed out after 10s');
  process.exit(1);
}, 10000);
