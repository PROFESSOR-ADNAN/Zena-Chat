# Runbook: Bad Deployment & Immediate Rollback

## Symptoms
- Elevated 5xx rate on `/api/*` or `/socket.io/` immediately following a release.
- Healthcheck endpoint `/health` failing on one or more gateway replicas.
- Synthetic Chat Probe reporting delivery timeouts.

## Immediate Mitigation Steps
1. **Trigger Automated Rollback**:
   ```bash
   bash scripts/rollback.sh
   ```
2. **Verify Container Health**:
   ```bash
   docker compose -f docker/compose.prod.yaml ps
   ```
3. **Inspect Application Logs**:
   ```bash
   docker compose -f docker/compose.prod.yaml logs -n 100 gateway-1 gateway-2 gateway-3
   ```
4. **Run Smoke Verification**:
   ```bash
   bash scripts/smoke-test.sh
   ```
