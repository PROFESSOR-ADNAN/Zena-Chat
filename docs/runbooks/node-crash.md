# Runbook: Gateway Node Crash & Reconnect Storm

## Symptoms
- Prometheus alert: `GatewayNodeDown` (e.g. `gateway-2` unreachable).
- Sudden spike in connection requests to remaining gateway replicas (`gateway-1`, `gateway-3`).

## Automatic Behavior
- Clients connected to the dead node automatically detect disconnect within 20s (`pingTimeout`).
- Clients reconnect with randomized jitter (1s–10s) across the surviving replicas.
- Surviving nodes process incoming `sync:request` queries without message duplication or loss.

## Remediation Steps
1. Restart the crashed replica:
   ```bash
   docker compose -f docker/compose.prod.yaml up -d gateway-2
   ```
2. Check memory usage:
   ```bash
   docker stats --no-stream
   ```
