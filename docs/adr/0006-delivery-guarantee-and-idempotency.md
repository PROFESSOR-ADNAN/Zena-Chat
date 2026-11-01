# ADR 0006: Delivery Guarantee and Idempotency Architecture

## Context
Mobile connections in Ethiopia drop frequently while an acknowledgment is in flight from the server. If a client sends a message, the server persists it, but the network drops before the client receives the ack, the client will retry sending the message. This can create duplicate messages unless protected.

## Decision
Implement an **at-least-once transmission** protocol with **idempotent persistence**:
1. Client generates a UUID v4 (`clientMsgId`) before placing a message in its outbox.
2. MongoDB enforces a compound unique index on `{ conversationId: 1, senderId: 1, clientMsgId: 1 }`.
3. If an identical `clientMsgId` is received again from the same sender in the same conversation, the server detects code 11000 (duplicate key) and returns the existing persisted message and its assigned `seq`.
4. Together, at-least-once wire transmission + idempotent server writes provide **exactly-once visible effect**.

## Alternatives Considered
- **Redis deduplication cache (SETNX with TTL)**: If Redis evicts the key or restarts, duplicate messages could be written to MongoDB.
- **Client deduplication by timestamp**: Inaccurate and easily defeated by rapid retries or clock skew.

## Consequences
- **Positive**: Complete protection against duplicates across all disconnect, timeout, and retry scenarios.
- **Negative**: Small storage overhead for the `clientMsgId` unique index per message.
