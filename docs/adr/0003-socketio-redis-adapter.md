# ADR 0003: Socket.IO with Classic Redis Pub/Sub Adapter via ioredis

## Context
When running 3 gateway replicas, an event emitted to a room (`io.to('conv:123').emit('message:new')`) on Node A must reach clients connected to Node B and Node C.

## Decision
Use `@socket.io/redis-adapter` backed by `ioredis`. Two Redis connections are created: a pub client and a sub client (via `.duplicate()`).

## Alternatives Considered
- **Redis Streams Adapter**: Provides stream history, but streams require message pruning policies (`MAXLEN`), incur more Redis RAM, and Socket.IO connection state recovery over Redis Streams is an optimization, not a guarantee for offline clients.
- **Classic `redis` package (node-redis)**: Socket.IO documentation explicitly notes edge cases with auto-reconnection recovery in the node-redis client; `ioredis` is recommended by Socket.IO maintainers for stability.

## Consequences
- **Positive**: Sub-millisecond fan-out latency between gateway replicas; clean memory usage; transparent reconnection handling with TLS support (compatible with Upstash).
- **Negative**: Redis Pub/Sub is fire-and-forget; if a gateway is briefly disconnected from Redis, live messages during the split are dropped on that node. This is safely mitigated by Zena's cursor-based sync protocol (`sync:request`), which is the true source of truth.
