import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { connectDB } from './config/db.js';
import app from './app.js';
import { initSocket } from './socket/index.js';
import { reconcilePresence } from './services/presence.service.js';

connectDB();

// Socket.IO has to attach to the same underlying HTTP server Express
// uses — app.listen() alone only knows about Express, not the WebSocket
// upgrade Socket.IO needs.
const httpServer = http.createServer(app);
const io = initSocket(httpServer);

// Cleans up any presence entries left behind by a crashed instance (one
// that never got to run its sockets' disconnect handlers) — see the
// comment on reconcilePresence for why this exists at all. Once a
// minute by default: frequent enough to catch a crash quickly. Tunable
// because it isn't free — every sweep costs Redis commands, which
// matters on a metered plan (see DEPLOY.md's note on Upstash's free
// tier).
const RECONCILE_INTERVAL_MS = Number(process.env.PRESENCE_RECONCILE_INTERVAL_MS) || 60_000;

setInterval(() => {
  reconcilePresence(io).catch((err) => console.error('Presence reconcile error:', err));
}, RECONCILE_INTERVAL_MS);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
