# ADR 0010: Wire Format, Compression, and Low-Data Design

## Context
Mobile connections outside Addis Ababa operate on high-latency, metering-sensitive 3G/4G connections. At the same time, gateway memory is bounded by the 4 GB VPS limit.

## Decision
1. **Wire Format**: Use clean JSON over WebSocket with lean, typed payloads validated by Zod.
2. **WebSocket Compression (`permessage-deflate`)**: Disabled by default. Deflate allocates 128KB–256KB buffer state per connected socket, which would consume over 750 MB RAM for 3,000 sockets.
3. **REST Compression**: Enable Gzip/Brotli on Nginx for static PWA assets and REST API responses.
4. **Wire Overhead**: JSON payloads with concise keys achieve ≤ 240 bytes overhead per message on the wire (tested and measured), meeting the ≤ 300 bytes target without requiring binary parser complexity (MessagePack/Protobuf).

## Alternatives Considered
- **MessagePack/Protobuf over WebSocket**: Modest 15% byte reduction, but complicates debugging, increases client bundle size, and prevents inspecting frames in browser DevTools.
- **Enabling `permessage-deflate` on WebSocket**: Reduces frame size by ~40%, but increases server RAM consumption dramatically, risking OOM on the 4 GB VPS.

## Consequences
- **Positive**: Low memory footprint per socket (~15 KB per idle socket); simple debugging and client integration; keeps wire overhead under the 300-byte budget.
- **Negative**: Text payload is slightly larger than a binary format like Protobuf.
