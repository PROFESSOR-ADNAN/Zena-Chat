# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0 (2026-11-14)


### Features

* add full auth flow, dynamic backend URL, conversation management and multi-origin CORS ([51ebbf1](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/51ebbf1db8052f71f3e530d2eb7f535a0a14c958))
* complete Zena production-grade real-time chat architecture (MERN + Redis + Socket.IO) ([7096d4b](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/7096d4bdb5ac9967e1cde0573b4e98dd702db4db))
* dedicated modern landing page for Zena Chat with interactive preview, feature showcase, and auth modal ([c8ea3c3](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/c8ea3c37ab795f5afcd77ed5fcd842615e0dbc9c))
* lock viewport on unread separator bar for new messages, save and restore exact scroll position per conversation ([3c5b3f7](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/3c5b3f7df1aea94f49ab1f236ddccdeb1832b071))
* per-user conversation deletion with last-user purge and participant count header display ([0cab593](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/0cab5930e69b668a3076740957c4b9b87622b9fb))
* public group room discovery, broadcast to all members, message edit & delete, conversation delete ([969163c](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/969163ca0589f10a6d71bf9ddccba753162625d4))
* real-time Telegram-style unread message counter that decrements on viewport scroll and retains exact read position on return ([f9ff857](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/f9ff85719341882a3658a76e508ed831c96d08ac))
* Telegram-style unread separator bar, first-unread positioning, and floating scroll-to-bottom button ([4a0a00b](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/4a0a00bc1181460383237b3cf1dff6e84ef3845e))


### Bug Fixes

* allow solo room creation, add auto-general chat, direct messages and message history sync ([450d3d2](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/450d3d23c97964ef6b4427e3f31ea3a0cb17bb5e))
* consolidate duplicate rooms, fix getMessages 500 crash, ensure history loads for all users ([2d99037](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/2d99037b22692c36375b782cd7f15d2a72df9ac1))
* display chat history when joining or opening rooms and general chat ([8919c63](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/8919c63f4586972d540224465a8020a83f3f18fd))
* eliminate auto-scroll on incoming messages and ensure unread separator positioning with fallback ([38578b9](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/38578b9962f00d6d62926e19ea019ded8c6f832e))
* join-by-name separate rooms without global broadcast, general chat for all, targeted messaging ([9befcb5](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/9befcb524bb5ed68424d3f873c8885c9f77ba139))
* load full message history for joined rooms & add Telegram-style unread notification badge ([6d13729](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/6d137290baba08a2ef21d836db66d1c69ef143c4))
* prevent premature read receipts and auto-scroll to bottom, ensure viewport locks directly on unread separator ([d6ee2bb](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/d6ee2bb3662d772054406bace3b6cf105d0debc6))
* real-time cross-user message delivery, conversation auto-join and message deduplication ([1b5ca82](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/1b5ca82b11d5cf2d931620e7a7d829f61139ae44))
* remove duplicate block causing syntax error on deploy ([73b831b](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/73b831b7184a5a16bc4db4c42a077c768542a1b0))
* **server:** support both REDIS_URL/REDIS_URI and MONGO_URI/MONGODB_URI ([ff1debc](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/ff1debc5f0790a9f9cfb0c580b858d5d59825bb1))
* Telegram-style real-time notifications with audio chime, floating toast banner, and sidebar preview ([1c74165](https://github.com/PROFESSOR-ADNAN/Zena-Chat/commit/1c741658b96d306be2bf46211439d7afe4b388d1))
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
