# Zena Architecture & System Design

## 1. System Components Overview

Zena is organized into decoupled layers communicating through well-defined protocols:

```mermaid
graph TD
  Client[Web PWA / Mobile Browser] -->|HTTPS / WSS| CF[Cloudflare CDN & WAF]
  CF -->|TLS Port 443| NGINX[Nginx Reverse Proxy]
  
  subgraph Docker Compose Host (VPS 2 vCPU / 4GB RAM)
    NGINX -->|HTTP Round-Robin| API[API Service / Node 22]
    NGINX -->|WSS Least-Conn| GW1[Gateway Node 1]
    NGINX -->|WSS Least-Conn| GW2[Gateway Node 2]
    NGINX -->|WSS Least-Conn| GW3[Gateway Node 3]
    
    GW1 <-->|Pub/Sub & Presence| REDIS[(Redis 7)]
    GW2 <-->|Pub/Sub & Presence| REDIS
    GW3 <-->|Pub/Sub & Presence| REDIS
    
    API -->|Read / Write| MONGO[(MongoDB Replica Set rs0)]
    GW1 -->|Read / Write| MONGO
    GW2 -->|Read / Write| MONGO
    GW3 -->|Read / Write| MONGO
    
    API -->|Enqueue Jobs| BULLMQ[BullMQ Queues in Redis]
    WORKER[Worker Service] -->|Dequeue Jobs| BULLMQ
    WORKER -->|Send Push| PUSH[Web Push Service / VAPID]
    WORKER -->|Process Images| STORAGE[(S3 / MinIO Object Storage)]
    
    ALLOY[Grafana Alloy] -->|Logs| LOKI[(Grafana Loki)]
    PROM[Prometheus] -->|Scrape /metrics| GW1 & GW2 & GW3 & API & NGINX
    GRAFANA[Grafana UI] --> PROM & LOKI
  end
```

---

## 2. Memory Budget Table (VPS Target: 2 vCPU / 4 GB RAM)

| Service / Component | Replicas | Base Memory | Peak Memory (3k sockets) | Justification |
|---------------------|----------|-------------|--------------------------|---------------|
| **Nginx** | 1 | 25 MB | 45 MB | Reverse proxy, static file cache, SSL termination |
| **Gateway Nodes** | 3 | 3 x 65 MB = 195 MB | 3 x 140 MB = 420 MB | ~1,000 sockets/node; permessage-deflate off (~15KB/socket) |
| **API Service** | 1 | 75 MB | 150 MB | REST auth, uploads, sync endpoints |
| **Worker Service** | 1 | 70 MB | 160 MB | BullMQ push dispatch, Sharp thumbnailing (capped concurrency) |
| **MongoDB (rs0)** | 1 | 450 MB | 850 MB | WiredTiger cache target 512 MB + index buffers |
| **Redis 7** | 1 | 50 MB | 120 MB | Pub/Sub buffers, presence TTL keys, rate-limit counters |
| **Monitoring (Prom + Loki + Alloy + Grafana)** | 4 | 220 MB | 450 MB | Alloy log collector, compact TSDB retention |
| **OS & Buffer Cache** | — | 350 MB | 500 MB | Linux kernel, TCP socket buffers, sysctl tuned buffers |
| **TOTAL** | — | **~1,435 MB** | **~2,695 MB** | **67.4% of 4 GB RAM (Safe under 85% ceiling)** |

---

## 3. Scaling & Failover Characteristics

1. **Stateless Gateway Replicas**:
   - Gateway instances store zero conversational state in local process memory.
   - Sockets connect across Gateway 1, 2, or 3 arbitrarily.
   - Cross-node broadcast is powered by `@socket.io/redis-adapter`.
   - Node crash resilience: If Gateway 2 dies, its ~1,000 clients reconnect with randomized jitter (1s–10s) to Gateway 1 and Gateway 3, immediately re-syncing via `sync:request`.
2. **MongoDB Replica Set**:
   - Standalone single-node replica set provides ACID transaction boundaries (`session.withTransaction()`) for sequence increments and idempotency enforcement.
   - In production, can be seamlessly migrated to an Atlas M10+ replica set by switching the `MONGO_URI` environment variable without code changes.
3. **Database Write Rate**:
   - 100 messages/second requires ~100 document writes/second, well within MongoDB WiredTiger's single-node capability (~2,000+ writes/second).
