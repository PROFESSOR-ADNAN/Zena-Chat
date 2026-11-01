# STRIDE Threat Model

## 1. Spoofing
- **Threat**: Attacker sends messages posing as another user via socket frames.
- **Mitigation**: Sender identity is strictly derived from the verified JWT handshake session (`socket.user._id`), never from client payloads.

## 2. Tampering
- **Threat**: Interception and modification of messages in flight.
- **Mitigation**: TLS encryption enforced end-to-end; monotonic `seq` and `eventSeq` server-assigned in MongoDB.

## 3. Repudiation
- **Threat**: User claims they did not send a message or read a receipt.
- **Mitigation**: Immutable audit logs on administrative actions; timestamps and cursors persisted in MongoDB.

## 4. Information Disclosure
- **Threat**: Non-member joins a conversation room to eavesdrop on private messages.
- **Mitigation**: Server validates room membership (`assertParticipant`) before `socket.join()`; REST history rejects non-members with 403.

## 5. Denial of Service
- **Threat**: Reconnect storms or message flood crashing the gateway.
- **Mitigation**: Client reconnection uses jitter; Redis rate-limiters throttle socket events per user; 64 KB max frame buffer.

## 6. Elevation of Privilege
- **Threat**: Regular user invoking moderator/admin suspension endpoints.
- **Mitigation**: `requireAdmin` middleware checks `req.user.role === 'admin'`.
