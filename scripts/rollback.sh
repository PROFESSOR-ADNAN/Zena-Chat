#!/usr/bin/env bash
set -euo pipefail

PREV_IMAGE="${1:-latest}"
echo "Rolling back to image tag: ${PREV_IMAGE}..."

docker compose -f docker/compose.prod.yaml down
docker compose -f docker/compose.prod.yaml up -d

echo "Rollback completed. Running smoke verification..."
bash scripts/smoke-test.sh http://localhost:80
