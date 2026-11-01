#!/usr/bin/env bash
set -euo pipefail

echo "Starting rolling zero-downtime deployment for Zena..."

# 1. Database backup before deployment
bash scripts/backup.sh

# 2. Pull new container images
docker compose -f docker/compose.prod.yaml pull

# 3. Rolling deploy of gateway replicas one by one
for gw in gateway-1 gateway-2 gateway-3; do
  echo "Rolling deployment for ${gw}..."
  docker compose -f docker/compose.prod.yaml up -d --no-deps "${gw}"
  sleep 5
done

# 4. Deploy worker and web
docker compose -f docker/compose.prod.yaml up -d --no-deps worker nginx

# 5. Run smoke verification
bash scripts/smoke-test.sh http://localhost:80

echo "Deployment finished successfully."
