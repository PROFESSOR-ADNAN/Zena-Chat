# Zena Technology Stack & Component Justifications

All dependencies and container images verified active and maintained as of late 2026.

## 1. Backend & Real-Time Gateway
- **Node.js 22 LTS**: Active LTS runtime, native `fetch`, native `node:test` runner, high performance V8 engine.
- **Express 4.19+**: Minimal, battle-tested HTTP framework.
- **Socket.IO 4.7+**: Reliable WebSocket transport with automated reconnection, ping/pong heartbeats, and room abstraction.
- **@socket.io/redis-adapter 8.3+**: Official Redis adapter for multi-instance Socket.IO clustering.
- **ioredis 5.4+**: Robust Redis client with TLS (`rediss://`) support and verified reconnection handling.
- **Mongoose 8.5+**: ODM for MongoDB schema enforcement, index definitions, and connection pooling.
- **Zod 3.23+**: Schema definition and runtime validation for all socket events and REST payloads.
- **Pino 9.4+**: Ultra-fast, low-overhead structured JSON logger.
- **bcryptjs 2.4+**: Secure password hashing without native binary compilation issues in Alpine containers.

## 2. Asynchronous Queue & Workers
- **BullMQ 5.8+**: Modern Redis-based background job queue supporting retries, exponential backoff, dead-letter queues, and rate limits.
- **web-push 3.6+**: Standard W3C Web Push notifications using VAPID keys.
- **sharp 0.33+**: High-performance image processing (resizing, WebP conversion, EXIF stripping).

## 3. Frontend & PWA
- **React 18 / 19**: Component UI rendering.
- **Vite 5+**: Fast bundler producing hashed, tree-shaken static assets.
- **TypeScript 5.5+**: Strict compile-time type verification.
- **Dexie.js 4+**: Ergonomic, robust IndexedDB wrapper for durable outbox and offline message storage.
- **TanStack Query 5+**: Server state caching and optimistic local cache updates.
- **Tailwind CSS 3.4+**: Utility-first CSS styling with minimal generated bundle footprint.
- **react-i18next 14+**: Full localization supporting English and Amharic.
- **Lucide React**: Lightweight SVG iconography.

## 4. Infrastructure, Databases & Proxy
- **MongoDB 7.0**: Document database configured as a single-node replica set for multi-document ACID transactions.
- **Redis 7.2**: In-memory data store for Socket.IO pub/sub, presence TTL keys, and BullMQ queues.
- **Nginx 1.26+**: Reverse proxy, SSL termination, WebSocket reverse proxying, rate limiting.
- **Docker & Docker Compose v2**: Container orchestration and isolated networking.
