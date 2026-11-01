# ADR 0016: Observability Stack Sized for a 4 GB VPS

## Context
Production monitoring requires metrics, logs, and alerting for 3 gateway replicas, MongoDB, Redis, and workers. Heavy stacks like the full Elastic Stack (ELK) or Grafana Tempo consume several gigabytes of RAM by themselves, exceeding the 4 GB VPS ceiling.

## Decision
1. **Metrics**: Prometheus scraping Node.js application metrics (`prom-client`), Nginx exporter, MongoDB exporter, and Redis exporter.
2. **Logs**: Grafana Loki with Grafana Alloy (lightweight log shipper; Promtail is retired). Application logs emitted in structured JSON with trace/request IDs. No message content is ever logged.
3. **Dashboards**: Grafana with pre-configured dashboard JSON files.
4. **Synthetic Chat Probe**: An automated probe bot container sending a periodic round-trip probe across nodes every 60s, verifying end-to-end delivery latency.
5. **Memory Cap**: Total observability stack memory is hard-limited in Compose to < 850 MB RAM total.

## Alternatives Considered
- **Promtail**: Deprecated / retired in favor of Grafana Alloy.
- **Elasticsearch + Kibana**: Minimum 2–4 GB RAM footprint; not viable on budget VPS.
- **Grafana Tempo (Tracing)**: Tracing overhead exceeds memory limits for this stage. Request and event correlation is preserved via structured log correlation IDs.

## Consequences
- **Positive**: Complete observability with minimal resource footprint; alerts on SLO burn rate, reconnect storms, and synthetic probe failures.
- **Negative**: Distributed span tracing is omitted; log correlation IDs serve as the trace mechanism.
