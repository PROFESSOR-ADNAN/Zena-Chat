# ADR 0009: Delivery and Read Receipts as Per-Member Cursors on Membership

## Context
Receipts track whether messages have been delivered to or read by participants. In group chats with up to 200 members, storing per-message delivery arrays (`message.deliveredTo = [userId1, userId2, ...]`) causes explosive document growth and write amplification.

## Decision
Store receipts as monotonic cursor fields on the `memberships` collection:
- `membership.lastDeliveredSeq`: The highest contiguous `seq` delivered to this user.
- `membership.lastReadSeq`: The highest contiguous `seq` read by this user.
Receipt advancement is forward-only (`$max`). Senders infer delivery and read status for any message with `seq <= member.lastDeliveredSeq`. In group chats, a message is "delivered" when all active members' `lastDeliveredSeq >= message.seq`.

## Alternatives Considered
- **Per-message receipt subdocuments/arrays**: Severe MongoDB BSON document bloat and write lock contention on popular messages.
- **Dedicated Receipt collection (one document per message per recipient)**: 100 messages to a 200-member group would generate 20,000 documents, overwhelming disk I/O and RAM.

## Consequences
- **Positive**: Constant O(1) storage per member per conversation regardless of message count. Fast forward-only writes with atomic `$max`.
- **Negative**: Out-of-order reading is not tracked per individual message, which aligns with modern chat UX (WhatsApp/Telegram where read markers advance continuously).
