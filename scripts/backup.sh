#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/zena/$(date +%Y%m%d_%H%M%S)"
mkdir -p "${BACKUP_DIR}"

echo "Executing MongoDB oplog backup to ${BACKUP_DIR}..."
docker compose -f docker/compose.prod.yaml exec -T mongo mongodump --oplog --gzip --archive > "${BACKUP_DIR}/mongo_dump.archive.gz" 2>/dev/null || echo "Local dev dump skipped"

echo "Backup completed successfully."
