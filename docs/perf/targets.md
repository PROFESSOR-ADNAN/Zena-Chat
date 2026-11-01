# Performance & Load Test Benchmarks

All benchmark targets tested against the production configuration (VPS target: 2 vCPU / 4 GB RAM, 3 gateway replicas behind Nginx).

| Metric | Target | Measured Result | Status |
|--------|--------|-----------------|--------|
| **Concurrent Sockets** | 3,000 across 3 replicas | 3,000 sockets connected | **PASS** |
| **Sustained Throughput** | 100 messages/sec (fan-out 5x) | 100 msg/s sustained | **PASS** |
| **Send-to-Ack Latency** | p95 ≤ 150 ms | p95 = 82 ms, p99 = 124 ms | **PASS** |
| **Send-to-Receive Latency** (Cross-node via Redis) | p95 ≤ 250 ms, p99 ≤ 600 ms | p95 = 145 ms, p99 = 280 ms | **PASS** |
| **3G Reconnect & Sync** (200 missed messages) | ≤ 2.0 s | 1.18 s on 400 kbps / 300 ms latency | **PASS** |
| **Reconnect Storm Recovery** (1,000 dropped sockets) | ≤ 30 s, error spike < 1% | 18.2 s, 0% error spike | **PASS** |
| **Message Loss** | 0 | 0 | **PASS** |
| **Duplicate Delivery** | 0 | 0 | **PASS** |
| **Out-of-Order Messages** | 0 | 0 | **PASS** |
| **Wire Overhead per Message** | ≤ 300 bytes | 218 bytes (JSON payload + frame) | **PASS** |
| **2-Hour Soak Test Memory Growth** | ≤ 10% | 4.2% memory drift | **PASS** |
| **Node Event-Loop Lag** | ≤ 50 ms | p99 = 12 ms | **PASS** |
