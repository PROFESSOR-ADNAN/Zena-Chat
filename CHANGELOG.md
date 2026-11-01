# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-01
### Added
- Complete architecture for Zena Real-Time Chat.
- 3-replica horizontal scaling with `@socket.io/redis-adapter` and `ioredis`.
- Strict monotonic `seq` and `eventSeq` generation per conversation via atomic MongoDB operations.
- Client-generated UUID `clientMsgId` with compound unique index for idempotent writes.
- Forward-only delivery and read receipts tracked as membership cursors.
- Cursor-based synchronization protocol (`sync:request`) for gap recovery and reconnect resilience.
- Distributed presence tracking backed by Redis TTL keys (`presence:{userId}:{deviceId}`) with debounce.
- Full English and Amharic UI support with Ethiopic font integration.
- Offline-first React PWA with Dexie IndexedDB durable outbox.
