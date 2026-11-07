# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0 (2026-11-07)


### Features

* add full auth flow, dynamic backend URL, conversation management and multi-origin CORS ([51ebbf1](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/51ebbf1db8052f71f3e530d2eb7f535a0a14c958))
* complete Zena production-grade real-time chat architecture (MERN + Redis + Socket.IO) ([7096d4b](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/7096d4bdb5ac9967e1cde0573b4e98dd702db4db))


### Bug Fixes

* allow solo room creation, add auto-general chat, direct messages and message history sync ([450d3d2](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/450d3d23c97964ef6b4427e3f31ea3a0cb17bb5e))
* real-time cross-user message delivery, conversation auto-join and message deduplication ([1b5ca82](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/1b5ca82b11d5cf2d931620e7a7d829f61139ae44))
* **server:** support both REDIS_URL/REDIS_URI and MONGO_URI/MONGODB_URI ([ff1debc](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/ff1debc5f0790a9f9cfb0c580b858d5d59825bb1))
* **web:** resolve TypeScript compilation errors and add vercel.json for deployment ([11f8c5b](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/11f8c5bca8a77173bd42968522e3ee89231a2425))

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
