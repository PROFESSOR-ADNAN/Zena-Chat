# ADR 0004: WebSocket-Only Transport and Sticky-Session Architecture

## Context
Socket.IO supports both HTTP long-polling and native WebSockets. Long-polling requires sticky sessions (session affinity) across multiple upstream gateway replicas so consecutive HTTP requests land on the same process holding the socket state. Sticky sessions behind Cloudflare CDN or CGNAT are brittle and prone to routing failure.

## Decision
Enforce `transports: ['websocket']` on the client and server. Nginx routes WebSocket connections without requiring session stickiness.

## Alternatives Considered
- **HTTP Long-Polling with sticky cookie (`ip_hash` or cookie hash)**: Fails or introduces uneven distribution behind Cloudflare proxy IPs; adds complexity to Nginx load balancing; long polling incurs higher latency and header overhead on mobile networks.

## Consequences
- **Positive**: Eliminates sticky-session requirement in Nginx upstream block. Round-robin or least-conn routing works cleanly. Sockets upgrade immediately on connection, reducing initial connection latency and bandwidth.
- **Negative**: Very restrictive corporate proxies blocking port 443 WebSocket upgrades will fail to connect. For the Ethiopian target demographic (mobile carrier networks 3G/4G), WebSocket over TLS port 443 is universally supported.
