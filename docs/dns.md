# DNS & CDN Architecture (Cloudflare + VPS)

## 1. Domain Configuration
Driven by a single environment variable: `DOMAIN=chat.example.com`

| Type | Name | Content / Target | Proxy Status | TTL | Purpose |
|------|------|------------------|--------------|-----|---------|
| **A** | `chat` | `<VPS_IPV4_ADDRESS>` | Proxied (Orange Cloud) | Auto | Public entrypoint via Cloudflare CDN & WAF |
| **AAAA** | `chat` | `<VPS_IPV6_ADDRESS>` | Proxied (Orange Cloud) | Auto | IPv6 entrypoint |
| **CAA** | `@` | `0 issue "letsencrypt.org"` | DNS Only | Auto | Restricts TLS cert issuance to Let's Encrypt |
| **TXT** | `@` | `v=spf1 include:_spf.mx.cloudflare.net ~all` | DNS Only | Auto | SPF email spoofing defense |
| **TXT** | `_dmarc` | `v=DMARC1; p=reject; rua=mailto:dmarc@example.com` | DNS Only | Auto | DMARC policy |

## 2. Cloudflare Edge Rules
- **WebSockets**: Explicitly enabled in Cloudflare Network dashboard.
- **Cache Rules**: Cache static PWA assets (`/assets/*`, `.js`, `.css`, `.webp`, `.png`) with Edge Cache TTL 1 month.
- **Bypass Cache**: `/socket.io/*` and `/api/*` are configured to Bypass Cache.
- **Rate Limiting**: Block IPs exceeding 30 requests/minute on `/api/v1/auth/*`.
