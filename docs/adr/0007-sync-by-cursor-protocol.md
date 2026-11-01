# ADR 0007: Sync-by-Cursor Protocol as the Correctness Mechanism

## Context
When a client reconnects after minutes or hours of offline time, or when a network packet drops, relying on live socket broadcasts alone leads to missing messages.

## Decision
Design a cursor-based synchronization protocol (`sync:request`) where the client sends a dictionary of `{ conversationId: lastAppliedEventSeq }`. The gateway responds with paginated events where `eventSeq > cursor` ordered ascending.
Live socket events are merely an optimization for zero-latency delivery. The sync-by-cursor protocol is the formal correctness mechanism.

## Alternatives Considered
- **Timestamp-based synchronization (`since=ISOString`)**: Clock drift between client and server or concurrent writes within the same millisecond cause skipped or duplicate messages.
- **Full conversation re-fetch**: Highly wasteful of mobile bandwidth (3G) and causes slow time-to-interactive.

## Consequences
- **Positive**: Resilient to server restarts, Redis pub/sub drops, and long mobile offline periods. Low bandwidth consumption: only delivers actual diffs.
- **Negative**: Client must maintain `lastAppliedEventSeq` per conversation in local storage (Dexie IndexedDB) and buffer incoming live events during an in-flight sync.
