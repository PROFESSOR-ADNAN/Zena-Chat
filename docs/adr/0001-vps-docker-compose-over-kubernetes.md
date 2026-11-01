# ADR 0001: Docker Compose on VPS (3 Gateway Replicas) over Kubernetes

## Context
Zena is targeted at providing a robust, highly reliable chat infrastructure suitable for patchy mobile networks within an economical budget (≤ $25/month). The system requires proving horizontal scaling and cross-node communication for up to 3,000 concurrent sockets and 100 msg/s.

## Decision
Run Docker Compose on a single production VPS (2 vCPU / 4 GB RAM) deploying 3 gateway replicas behind an Nginx reverse proxy, backed by local/managed Redis and a MongoDB replica set. Kubernetes is explicitly rejected.

## Alternatives Considered
- **Kubernetes (k3s / EKS / GKE)**: Control plane overhead consumes 1–2 GB RAM alone; adds massive operational complexity, ingress controller configuration, and exceeds the $25/month cost ceiling without providing distributed resilience on a single node.
- **Single monolithic gateway process**: Does not prove cross-node broadcast, horizontal scaling, or distributed presence synchronization.

## Consequences
- **Positive**: Complete deployment fits comfortably within a $15–$24/month VPS (e.g. Hetzner CPX21 or DigitalOcean). Proves horizontal scaling with 3 containerized gateway processes communicating via Redis.
- **Negative**: Node-level hardware redundancy is absent without a multi-node swarm or external failover. Mitigated by automated off-site restic backups and fast disaster recovery runbooks.
