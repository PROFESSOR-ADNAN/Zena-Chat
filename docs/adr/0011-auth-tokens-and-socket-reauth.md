# ADR 0011: Authentication Tokens, Refresh Rotation, and Instant Cross-Node Revocation

## Context
Socket connections are long-lived. If a user's password changes, account is suspended, or a session is revoked, the user's active sockets across all 3 gateway replicas must be disconnected within 5 seconds.

## Decision
1. **Access Tokens**: Short-lived JWTs (15 minutes expiry) passed in the Socket.IO handshake auth `{ token: '...' }`.
2. **Refresh Tokens**: Long-lived (7 days), stored hashed in MongoDB (`refreshTokens` collection), delivered in an `httpOnly`, `Secure`, `SameSite=Strict` cookie with automatic rotation on each use. Reuse of an old refresh token invalidates the entire family.
3. **Socket Re-Authentication**: Client refreshes token via REST and emits `auth:refresh` over the socket before token expiry.
4. **Cross-Node Revocation Control Channel**: When an admin suspends a user or the user logs out all sessions, the server publishes a message to Redis channel `auth:control` `{ action: 'disconnect', userId }`. All gateway replicas listen on this channel and terminate matching sockets immediately.

## Alternatives Considered
- **Stateless JWT without control channel**: Sockets remain open indefinitely until handshake token expires or connection drops.
- **Validating every socket event against MongoDB**: Degrades database throughput to unacceptable levels (100 events/s = 100 DB queries).

## Consequences
- **Positive**: Sub-second termination of revoked/suspended sessions across all replicas; minimal database overhead.
- **Negative**: Requires Redis pub/sub channel for cross-node control messages.
