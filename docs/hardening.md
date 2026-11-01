# Linux Server Hardening & Kernel Socket Tuning

## 1. System Limits (`/etc/security/limits.d/99-zena.conf`)
High concurrent socket connections require raising file descriptor and thread limits:

```ini
* soft nofile 65535
* hard nofile 65535
* soft nproc 32768
* hard nproc 32768
```

## 2. Kernel Socket Tuning (`/etc/sysctl.d/99-zena.conf`)
Optimized for 3,000+ persistent WebSocket connections and quick reclamation:

```ini
# Maximum socket receive/send buffer sizes
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216

# Connection queue backlog size
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 4096

# Ephemeral port range for outbound connections to Redis/Mongo
net.ipv4.ip_local_port_range = 1024 65535

# TCP Keepalive tuning for mobile connection drops
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_intvl = 15
net.ipv4.tcp_keepalive_probes = 5

# TCP FIN timeout to quickly recycle closed sockets
net.ipv4.tcp_fin_timeout = 15
```

## 3. Firewall (UFW)
- Public: Port 80, 443 (HTTP/HTTPS) locked to Cloudflare IP ranges.
- Private: SSH (Port 22) accessible strictly through Tailscale / WireGuard admin VPN.
