# ADR 0012: Client Offline Storage and Durable Outbox Design

## Context
When a user composes a message while driving through an area with no 3G coverage or during a cell tower handover, closing the browser or refreshing must not lose the message. The message must queue locally and transmit automatically on reconnect.

## Decision
Use **Dexie.js (IndexedDB)** for local client persistence:
1. Tables: `conversations`, `messages`, `outbox`, and `syncState`.
2. When the user sends a message, it is written immediately to `messages` (status `sending`) and `outbox` with a generated UUID `clientMsgId`.
3. An isolated `SyncEngine` module continuously monitors connection state:
   - When online, it processes the outbox in FIFO order per conversation with exponential backoff and jitter.
   - On ack, the outbox entry is deleted, and message status updates to `sent`.
   - On unrecoverable error, message status updates to `failed` with manual retry option.
4. UI queries Dexie via TanStack Query local-first hooks.

## Alternatives Considered
- **In-memory queue**: Lost on page refresh or browser close.
- **LocalStorage**: Synchronous, blocks main thread, limited to 5 MB, unsuitable for thousands of stored messages.

## Consequences
- **Positive**: Durable offline experience; instant UI responsiveness; survives browser crashes and reboots.
- **Negative**: IndexedDB requires schema migrations on client upgrades; handled cleanly via Dexie versions.
