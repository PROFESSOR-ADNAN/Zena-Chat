# Zena Product Requirements Document (PRD)

## 1. Summary & Value Proposition
Zena is an ultra-resilient, real-time messaging application specifically engineered for low-bandwidth and high-packet-loss environments (such as rural 3G/4G connectivity in Ethiopia and East Africa).

## 2. Target Personas
1. **The Rural Mobile User**: Traverses areas with intermittent mobile data. Requires messages typed while offline to send automatically when reconnected without duplicate transmission or lost replies.
2. **The University/Community Group Member**: Participates in low-data group chats (up to 200 members) requiring clear delivery receipts and low cellular data consumption.
3. **The System Moderator**: Monitors abuse reports, blocks bad actors, and executes immediate cross-node user suspensions.

---

## 3. User Stories & Acceptance Criteria (Traceability)

| ID | Story | Acceptance Criteria | Automated Test Mapping |
|----|-------|---------------------|------------------------|
| US-01 | User registration | Unique username, valid email, password hash ≥ 12 rounds, returns JWT | `tests/unit/auth.test.js` |
| US-02 | User login | Constant-time error on invalid credentials; returns access & refresh tokens | `tests/unit/auth.test.js` |
| US-03 | Token refresh | Refresh token rotation; reuse detection revokes entire token family | `tests/unit/auth.test.js` |
| US-04 | Account lockout | 5 failed login attempts lock account for 15 minutes | `tests/unit/auth.test.js` |
| US-05 | Create 1:1 DM | Creates DM with unique sorted `dmKey`; deduplicated under race | `tests/unit/messaging.test.js` |
| US-06 | Create Group Chat | Up to 200 members; assign owner, admin, member roles | `tests/unit/messaging.test.js` |
| US-07 | Send text message | Text up to 4,000 characters; persists with monotonic `seq` | `tests/unit/messaging.test.js` |
| US-08 | Idempotent send | Retrying identical `clientMsgId` returns existing `seq` without duplicate write | `tests/unit/messaging.test.js` |
| US-09 | Delivery receipt | Recipient ack updates `lastDeliveredSeq`; broadcasts to conversation | `tests/unit/messaging.test.js` |
| US-10 | Read receipt | Recipient mark-read updates `lastReadSeq`; sender marks UI read | `tests/unit/messaging.test.js` |
| US-11 | Edit message | Allowed within 15 mins; updates text and increments `eventSeq` | `tests/unit/messaging.test.js` |
| US-12 | Delete message | Soft delete within 15 mins; tombstone broadcasts and syncs | `tests/unit/messaging.test.js` |
| US-13 | Offline outbox | Typed messages queue in IndexedDB; auto-send on reconnect | `tests/unit/syncEngine.test.js` |
| US-14 | Sync by cursor | `sync:request` returns all events with `eventSeq > cursor` | `tests/unit/syncEngine.test.js` |
| US-15 | Multi-node broadcast | Message sent on Gateway 1 reaches recipient on Gateway 2 via Redis | `tests/integration/multinode.test.js` |
| US-16 | Presence tracking | Presence stored in Redis; user online if any device connected | `tests/integration/presence.test.js` |
| US-17 | Last seen privacy | User can hide last-seen timestamp; contacts see only online/offline | `tests/unit/presence.test.js` |
| US-18 | Typing indicator | Ephemeral, throttled to 1 per 3s, not stored in DB | `tests/unit/typing.test.js` |
| US-19 | Multi-device connect | Disconnecting 1 of 2 tabs does not emit offline event | `tests/integration/presence.test.js` |
| US-20 | Web Push notification | Sent via BullMQ only if recipient has 0 active sockets | `tests/unit/worker.test.js` |
| US-21 | Block user | Blocked user cannot DM; presence is hidden from blocked user | `tests/unit/moderation.test.js` |
| US-22 | Report message | Users can report message with snapshot for moderator review | `tests/unit/moderation.test.js` |
| US-23 | Admin suspension | Suspended user is disconnected on all gateway nodes within 5s | `tests/integration/multinode.test.js` |
| US-24 | Amharic Localization | UI fully translated to Amharic with Ethiopic font support | `tests/unit/i18n.test.js` |
| US-25 | Image upload | Presigned upload, stripped EXIF, 320px thumbnail | `tests/unit/upload.test.js` |
| US-26 | Leave group | Member can leave group; sockets removed from room | `tests/unit/messaging.test.js` |
| US-27 | Invite link | Admin generates invite link with TTL; accepts members | `tests/unit/invites.test.js` |
| US-28 | Data export | User exports personal data and chat history in JSON | `tests/unit/privacy.test.js` |
| US-29 | Account deletion | Anonymizes user profile, removes credentials and tokens | `tests/unit/privacy.test.js` |
| US-30 | Node crash recovery | Killing a gateway node causes clients to reconnect with jitter and resync | `tests/chaos/crash.test.js` |

---

## 4. Out-of-Scope (Post-MVP Roadmap)
- End-to-end encryption (E2EE) with Signal protocol (planned for Phase 2).
- Voice and video calling via WebRTC.
- Arbitrary non-image file uploads (.zip, .pdf).
- Message emoji reactions.
