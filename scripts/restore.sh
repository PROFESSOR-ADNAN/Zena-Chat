#!/usr/bin/env bash
set -euo pipefail

ARCHIVE_FILE="${1:-}"
if [ -z "${ARCHIVE_FILE}" ] || [ ! -f "${ARCHIVE_FILE}" ]; then
  echo "Usage: $0 /path/to/mongo_dump.archive.gz"
  exit 1
fi

echo "Restoring MongoDB from ${ARCHIVE_FILE} with oplogReplay..."
docker compose -f docker/compose.prod.yaml exec -T mongo mongorestore --oplogReplay --gzip --archive < "${ARCHIVE_FILE}"

echo "Database restore completed."
