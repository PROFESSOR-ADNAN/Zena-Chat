# Zena Engineering Progress Tracker

## Status Overview
- **System**: Zena Real-Time Chat (MERN + Redis + Socket.IO)
- **Target Audience**: Low-bandwidth & patchy mobile connectivity (3G/4G, Ethiopia / East Africa)
- **Architecture**: Horizontal scaling across 3 Gateway replicas, MongoDB single-node replica set, Redis Pub/Sub adapter, BullMQ workers, Offline-First React PWA.

---

## Phases Tracker

| Phase | Description | Status | Evidence / Notes |
|-------|-------------|--------|------------------|
| **Phase 0** | Repo scaffold, assumptions, ADRs (0001-0017), protocol draft | **IN PROGRESS** | Scaffolding directories, shared schemas, ADRs |
| **Phase 1** | Local dev environment, Makefile, 3-gateway compose, Nginx | PENDING | Docker Compose with 3 gateway replicas behind Nginx |
| **Phase 2** | Data model, auth, JWT rotation, session revocation control channel | PENDING | User, Membership, Conversation models with RBAC |
| **Phase 3A** | Messaging core (monotonic `seq`/`eventSeq`, idempotent send) | PENDING | Atomic counter increment + unique `clientMsgId` index |
| **Phase 3B** | Real-time gateway, receipts, sync-by-cursor, presence | PENDING | Socket.IO handlers, Redis presence TTL, cursors |
| **Phase 3C** | Offline-first React PWA, Dexie, durable outbox, i18n | PENDING | React + Vite + Dexie IndexedDB + Amharic/English |
| **Phase 4** | Comprehensive test suite (unit, integration, multi-node, property) | PENDING | Node test runner, testcontainers |
| **Phase 5** | CI/CD Pipelines (GitHub Actions) | PENDING | `.github/workflows/ci.yml` |
| **Phase 6** | Nginx reverse proxy, TLS, security headers, system hardening | PENDING | `nginx.conf`, sysctl tuning |
| **Phase 7** | Infrastructure as Code (Terraform/OpenTofu, Ansible) | PENDING | `infra/terraform`, `infra/ansible` |
| **Phase 8** | CD Pipeline, rolling deploy with drain, rollback | PENDING | `scripts/deploy.sh`, zero-downtime drain |
| **Phase 9** | Observability (Prometheus, Grafana, Loki, Synthetic Chat Probe) | PENDING | Metrics, alerts, synthetic bot |
| **Phase 10** | Backups, disaster recovery, load tests, chaos tests | PENDING | `mongodump` oplog, chaos scripts |
| **Phase 11** | Security audit (ASVS, ZAP, Semgrep, threat model) | PENDING | `docs/security/asvs.md` |
| **Phase 12** | Documentation, runbooks, go-live checklist verification | PENDING | Production readiness evidence |

---

## Decisions Log
- **ADR-0001**: Docker Compose on VPS (3 gateway replicas) over Kubernetes.
- **ADR-0002**: MongoDB single-node replica set for atomic multi-document transactions and change stream support.
- **ADR-0003**: Socket.IO with `@socket.io/redis-adapter` (classic pub/sub over `ioredis`) for cross-node broadcast.
- **ADR-0004**: WebSocket-only transport to eliminate sticky session requirements across Cloudflare CDN.
- **ADR-0005**: Per-conversation monotonic `seq` (message ordering) and `eventSeq` (sync cursor) generated via atomic `$inc` on the Conversation document.
- **ADR-0006**: At-least-once on wire + unique `(conversationId, senderId, clientMsgId)` index = exactly-once visible effect.
- **ADR-0007**: Sync-by-cursor (`eventSeq > cursor`) as the primary correctness mechanism for network reconnects.
- **ADR-0008**: Presence via Redis TTL keys per device (`presence:{userId}:{deviceId}`), debounced fanout to mutual contacts.
- **ADR-0009**: Receipts as per-member cursors (`lastDeliveredSeq`, `lastReadSeq`) on `memberships` collection.
- **ADR-0010**: Wire format: standard JSON over WebSocket with permessage-deflate disabled to preserve VPS memory.
- **ADR-0011**: 15-minute JWT access tokens + rotated refresh cookies + Redis control channel for immediate session revocation.
- **ADR-0012**: Client-side Dexie IndexedDB + persistent outbox with exponential backoff and jitter.
- **ADR-0013**: Minimal Web Push payloads with VAPID keys, delivered only when zero active sockets exist for a user.
- **ADR-0014**: Presigned upload URLs with client-side downscale and Sharp server-side EXIF stripping/thumbnailing.
- **ADR-0015**: Backup strategy: Nightly `mongodump --oplog` + encrypted restic snapshots to S3-compatible cold storage.
- **ADR-0016**: Observability sizing: Prometheus + Alloy + Loki + Grafana targeting < 800MB RAM footprint on a 4GB VPS.
- **ADR-0017**: TypeScript for frontend and shared schema package; modern Node.js ESM with strict Zod validation on backend.

---

## Open Risks & Mitigations
1. **Patchy 3G/4G Network Drops**: Mitigated by durable outbox on IndexedDB and cursor-based synchronization upon reconnect.
2. **Carrier-Grade NAT (CGNAT) in Ethiopia**: Many users sharing single public IP. Mitigated by generous IP rate limits combined with strict authenticated per-user rate limits in Redis.
3. **Reconnect Storms after Node Crash**: Mitigated by client-side jittered exponential backoff and cursor pagination.
