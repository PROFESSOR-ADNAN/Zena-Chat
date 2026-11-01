#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "Zena Real-Time Chat System Smoke Test Verification"
echo "=========================================================="

BASE_URL="${1:-http://localhost:8080}"
echo "Verifying Gateway Health at: ${BASE_URL}/health"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health" || echo "000")

if [ "$HTTP_STATUS" -eq 200 ] || [ "$HTTP_STATUS" -eq 204 ]; then
  echo "✔ Health check passed with HTTP ${HTTP_STATUS}"
else
  echo "✖ Health check failed with HTTP ${HTTP_STATUS}"
  exit 1
fi

echo "✔ Smoke test verification complete."
