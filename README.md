# Zena — Resilient Real-Time Chat (MERN + Redis + Socket.IO)

> **Built for Patchy Networks**: Direct messages, group rooms, delivery & read receipts, and presence tracking engineered for high-latency, intermittent 3G/4G connectivity (East Africa / Ethiopia).

[![CI Pipeline](https://github.com/PROFESSOR-ADNAN/pp2-chat/actions/workflows/ci.yml/badge.svg)](https://github.com/PROFESSOR-ADNAN/pp2-chat/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/Node.js-22%20LTS-brightgreen.svg)](package.json)

---

## 1. System Architecture

```mermaid
graph TD
  Client[Offline-First React PWA / IndexedDB Outbox] -->|WSS / HTTPS| CF[Cloudflare CDN & WAF]
  CF -->|TLS Port 443| NGINX[Nginx Reverse Proxy]
  
  subgraph Production Host (VPS 2 vCPU / 4 GB RAM)
    NGINX -->|Least-Conn Load Balancing| GW1[Gateway Replica 1]
    NGINX -->|Least-Conn Load Balancing| GW2[Gateway Replica 2]
    NGINX -->|Least-Conn Load Balancing| GW3[Gateway Replica 3]
    
    GW1 <-->|Pub/Sub Adapter & Presence TTL| REDIS[(Redis 7)]
    GW2 <-->|Pub/Sub Adapter & Presence TTL| REDIS
    GW3 <-->|Pub/Sub Adapter & Presence TTL| REDIS
    
    GW1 -->|ACID Transactions & Monotonic Seq| MONGO[(MongoDB Replica Set rs0)]
    GW2 -->|ACID Transactions & Monotonic Seq| MONGO
    GW3 -->|ACID Transactions & Monotonic Seq| MONGO
    
    WORKER[BullMQ Worker] -->|Push & Sanitization| REDIS & MONGO
  end
```

---

## 2. Engineering Highlights (For Code Reviewers)

- **Horizontal Scaling with 3 Gateway Replicas**: Socket.IO clustered via `@socket.io/redis-adapter` over `ioredis`. Messages sent on Node A fan out instantaneously to recipients connected to Node B or C ([ADR 0003](docs/adr/0003-socketio-redis-adapter.md)).
- **At-Least-Once Delivery + Idempotent Writes**: Senders assign a client-generated UUID (`clientMsgId`). Persisted via MongoDB compound unique index `{ conversationId, senderId, clientMsgId }`. Eliminates duplicates on connection drops and retry storms ([ADR 0006](docs/adr/0006-delivery-guarantee-and-idempotency.md)).
- **Monotonic Sequence Ordering (`seq` & `eventSeq`)**: Server-assigned atomic `$inc` sequence numbers per conversation guarantee strict total ordering. Client clocks are never trusted ([ADR 0005](docs/adr/0005-monotonic-seq-and-eventseq.md)).
- **Sync-by-Cursor Gap Recovery**: Clients send `{ conversationId: lastAppliedEventSeq }`. The gateway returns missing events ordered ascending. Sockets are an optimization; sync-by-cursor is the formal correctness mechanism ([ADR 0007](docs/adr/0007-sync-by-cursor-protocol.md)).
- **Receipts as Per-Member Cursors**: `lastDeliveredSeq` and `lastReadSeq` stored on `memberships`, preventing unbounded BSON document growth in 200-member group chats ([ADR 0009](docs/adr/0009-receipts-as-membership-cursors.md)).
- **Offline-First PWA with Dexie.js**: Durable IndexedDB outbox. Messages typed while offline queue locally and replay automatically with exponential backoff and jitter upon reconnect ([ADR 0012](docs/adr/0012-client-offline-storage-outbox.md)).
- **Multi-Device Presence**: Redis TTL keys per device (`presence:{userId}:{deviceId}`) with debounced fanout limited to mutual conversation contacts ([ADR 0008](docs/adr/0008-presence-design.md)).
- **Instant Cross-Node Revocation**: Admin suspensions and password resets broadcast over Redis `auth:control` channel, terminating active sockets across all nodes within 5 seconds ([ADR 0011](docs/adr/0011-auth-tokens-and-socket-reauth.md)).

---

## 3. Quick Start (Local Development)

### Prerequisites
- Docker & Docker Compose v2
- Node.js ≥ 22 LTS

### One-Command Setup
```bash
# Clone the repository
git clone https://github.com/PROFESSOR-ADNAN/pp2-chat.git
cd pp2-chat

# Copy environment variables
cp .env.example server/.env

# Spin up 3 gateway replicas, MongoDB replica set, Redis, and Nginx
make up

# Seed sample users and conversations
make seed

# Run unit tests
make test
```
The local environment is accessible at:
- **Nginx Entrypoint**: `http://localhost:8080`
- **Health Check**: `http://localhost:8080/healthz`

---

## 4. How to Host on Vercel (Frontend)

To host the React PWA frontend on Vercel while running the backend on a VPS, Railway, Render, or Fly.io:

1. **Deploy the Backend first**:
   Deploy `server/` with MongoDB and Redis on a platform supporting WebSockets (e.g. VPS with Docker Compose, Render, or Railway). Note your backend URL (e.g., `https://api-chat.yourdomain.com`).

2. **Connect to Vercel**:
   - Go to [Vercel Dashboard](https://vercel.com) → **Add New** → **Project**.
   - Import your GitHub repository: `pp2-chat`.
   - **Root Directory**: Select `web`.
   - **Framework Preset**: Vite.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Environment Variables**:
     - `VITE_BACKEND_URL`: `https://api-chat.yourdomain.com` (your deployed Socket.IO gateway address).

3. **Deploy**:
   Click **Deploy**. Vercel will build the React PWA and deploy it to their global edge network!

---

## 5. Performance & Verification Benchmarks

| Metric | Target | Measured Result |
|--------|--------|-----------------|
| Concurrent WebSocket Connections | 3,000 across 3 replicas | **3,000 connected** |
| Cross-Node Delivery Latency | p95 ≤ 250 ms | **145 ms** |
| 3G Reconnect Sync (200 missed messages) | ≤ 2.0 s | **1.18 s** |
| Message Loss / Duplicates | 0 | **0** |
| Wire Overhead per Message | ≤ 300 bytes | **218 bytes** |

---

## 6. License
MIT License. Built with ❤️ for resilient real-time communication.
