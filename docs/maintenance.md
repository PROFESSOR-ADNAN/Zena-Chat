# Operations & Maintenance Calendar

## 1. Routine Maintenance Schedule
- **Weekly**: Dependabot / Renovate review for minor and patch dependency bumps.
- **Bi-weekly**: Review Redis memory usage, presence keyspace count, and BullMQ failed jobs queue.
- **Monthly**: OS security patch updates via `unattended-upgrades`. Automated database restore drill into a temporary scratch container.
- **Quarterly**: Full security audit, ASVS checklist review, TLS certificate rotation verification.

## 2. Monthly Budget Table (< $25 Total)
| Resource | Provider | Spec | Cost |
|----------|----------|------|------|
| **VPS** | Hetzner Cloud / DigitalOcean | CPX21 (3 vCPU / 4 GB RAM) | $15.50 / month |
| **Redis** | Upstash | 500,000 commands/month free tier | $0.00 / month |
| **Object Storage**| Cloudflare R2 | 10 GB storage, 1M Class A operations | $0.00 / month |
| **DNS & CDN** | Cloudflare | Free Tier | $0.00 / month |
| **Total** | — | — | **$15.50 / month (Well under $25 budget)** |
