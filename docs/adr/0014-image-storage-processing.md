# ADR 0014: Image Storage, Client Pre-Compression, and Server Re-Encoding

## Context
High-resolution photos captured on modern phones (10–50 MB) can choke 3G upload bandwidth and consume excessive server disk space.

## Decision
1. **Client-side compression**: Before upload, the browser scales images to max 1,280 px on the longest side using canvas and encodes to WebP/JPEG (targeting ≤ 500 KB).
2. **Presigned Uploads**: Client requests an upload token; file is uploaded directly to S3-compatible storage (MinIO in local dev; Cloudflare R2 / AWS S3 in production).
3. **Worker Processing**: A BullMQ worker downloads the raw file, verifies magic bytes, strips all EXIF GPS metadata, generates a 320 px thumbnail using `sharp`, and saves the sanitized WebP files.
4. **Access Control**: Attachments are served only via short-lived signed URLs (or authenticated proxy route) validated against conversation membership.

## Alternatives Considered
- **Direct upload through Socket.IO frames**: Saturates WebSocket event loop and inflates memory buffers; blocks live chat traffic.
- **Serving raw user-uploaded files without sanitization**: Security hazard (EXIF location leaks, malicious SVG/polyglot files).

## Consequences
- **Positive**: Blazing fast uploads on 3G; eliminates EXIF privacy leaks; protects WebSocket event loop from heavy binary traffic.
- **Negative**: Requires background worker (`worker/`) running `sharp` and an S3-compatible bucket.
