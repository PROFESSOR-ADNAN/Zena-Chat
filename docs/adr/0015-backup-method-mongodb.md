# ADR 0015: Backup Strategy for MongoDB and Off-Site Storage

## Context
A production database requires reliable disaster recovery. Data loss must be bounded by an RPO ≤ 24 hours (target RPO ≤ 6 hours) and an RTO ≤ 2 hours.

## Decision
1. **MongoDB**: Nightly `mongodump --oplog --gzip` scheduled via automated cron / container task.
2. **Encrypted Off-Site Storage**: Encrypt and deduplicate backup archives using `restic` to an off-site S3 cold storage bucket (e.g. Backblaze B2 / Cloudflare R2).
3. **Retention**: 7 daily snapshots, 4 weekly snapshots, and 3 monthly snapshots.
4. **Disaster Recovery Testing**: Monthly automated restore drill into a temporary scratch container verifying sequence gaplessness and attachment references.

## Alternatives Considered
- **Filesystem-level snapshot (LVM / EBS)**: Requires cloud-specific block storage, exceeding budget and tying architecture to specific VPS providers.
- **Unencrypted tarballs via scp**: Insecure and lacks deduplication, encryption, and pruning automation.

## Consequences
- **Positive**: Meets 3-2-1 backup standard; encrypted at rest with restic; low storage cost; proven point-in-time recovery using the oplog.
- **Negative**: Full cluster restore requires running `mongorestore --oplogReplay`, documented in `docs/runbooks/database-restore.md`.
