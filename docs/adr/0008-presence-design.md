# ADR 0008: Presence Tracking via Redis TTL Keys per Device

## Context
Users connect with multiple devices (laptop, phone) simultaneously. A user is online if at least one device is connected. On unstable networks, connections flap rapidly; presence state must not flap or cause thundering-herd broadcasts.

## Decision
1. Presence is tracked in Redis with keys: `presence:{userId}:{deviceId}` with a 45-second TTL.
2. Gateway refreshes the key on WebSocket heartbeat.
3. On disconnect, the gateway removes the specific device key. If no other device keys exist for `userId`, user transitions to offline.
4. Fanout: Updates are sent only to active contacts (users sharing a mutual conversation).
5. Debounce: Rapid connect/disconnect within 3 seconds is debounced to avoid broadcast storms on flaky 3G connections.
6. A periodic sweeper checks for stale entries left by crashed gateway processes.

## Alternatives Considered
- **In-memory Maps in Node.js**: Works only on a single process. Fails with multiple gateway replicas.
- **MongoDB writes on every connect/disconnect**: High write load on MongoDB (thousands of writes per minute during connection churn).

## Consequences
- **Positive**: Multi-device accuracy, resilient across all gateway replicas, negligible memory footprint, preserves MongoDB write throughput.
- **Negative**: Requires Redis to be available. If Redis is flushed, users briefly re-register presence upon their next socket heartbeat.
