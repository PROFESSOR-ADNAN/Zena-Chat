# ADR 0002: MongoDB Single-Node Replica Set for ACID Transactions

## Context
Guaranteed message delivery, atomic sequence generation (`seq`/`eventSeq`), and multi-document consistency (e.g. updating a conversation's `lastSeq`, inserting a `Message`, and updating sender's `Membership` cursor) require atomic guarantees. Standalone MongoDB instances do not support ACID multi-document transactions or Change Streams.

## Decision
Configure MongoDB as a single-node replica set (`--replSet rs0`). Initialize `rs0` on startup.

## Alternatives Considered
- **Standalone MongoDB without replica set**: Prevents using `session.withTransaction()`; requires relying solely on individual atomic operations, complicating rollback in case of partial writes.
- **Multi-node MongoDB cluster**: High memory and CPU consumption that would exceed the 4 GB VPS RAM limit.

## Consequences
- **Positive**: Enables full MongoDB ACID transactions, oplog support for point-in-time recovery with `mongodump --oplog`, and clean transactional boundaries for complex state changes.
- **Negative**: Requires replica set initialization script (`rs.initiate()`) on first boot. Managed transparently via Docker entrypoint or healthcheck script.
