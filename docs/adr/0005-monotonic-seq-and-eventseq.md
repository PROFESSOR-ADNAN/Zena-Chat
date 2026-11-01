# ADR 0005: Per-Conversation Monotonic `seq` and `eventSeq` Generation

## Context
Message ordering and synchronization on patchy networks cannot trust client clocks or arbitrary Mongo `ObjectId` sort order across concurrent writes. Messages require a gapless, strictly increasing sequence (`seq`). Additionally, edits, deletes, and cursor advancements must be queryable via a monotonic cursor (`eventSeq`).

## Decision
Generate `seq` and `eventSeq` using an atomic `$inc` operation on the `Conversation` document in MongoDB within a transactional write:
- `seq`: Incremented only when a new message is authored. Defines canonical message presentation order.
- `eventSeq`: Incremented on ANY state modification to the conversation (new message, edit, soft delete). Defines the synchronization stream cursor.

## Alternatives Considered
- **Redis INCR**: Fast, but separates sequence generation from database persistence. If Redis crashes or the DB write fails, sequence numbers develop unrecoverable gaps. Redis is not a persistent source of truth.
- **Client timestamp (`Date.now()`)**: Untrusted, subject to client clock drift, time zones, and manipulation.

## Consequences
- **Positive**: Strict, gapless monotonically increasing sequence numbers tied directly to the persistent MongoDB record. Guaranteed total ordering per conversation.
- **Negative**: Write throughput is bounded by single-document update concurrency on MongoDB (~1,000–2,000 ops/s per conversation), which is well in excess of our target of 100 msg/s total fan-out.
