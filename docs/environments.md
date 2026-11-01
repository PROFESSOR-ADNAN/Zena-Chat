# Environment Configuration Matrix

| Variable | Local Dev (`compose.yaml`) | Staging | Production (`compose.prod.yaml`) |
|----------|----------------------------|---------|----------------------------------|
| `NODE_ENV` | `development` | `staging` | `production` |
| `PORT` | `5000` | `5000` | `5000` |
| `MONGO_URI` | `mongodb://mongo:27017/chat?replicaSet=rs0` | Atlas M0 Free Cluster | Atlas M10 or VPS Replica Set |
| `REDIS_URL` | `redis://redis:6379` | Upstash Free Tier (`rediss://...`) | Upstash or Managed Redis |
| `GATEWAY_REPLICAS`| 3 replicas (local Nginx) | 3 replicas | 3 replicas |
| `CORS_ORIGIN` | `http://localhost:8080` | `https://staging.example.com` | `https://chat.example.com` |
| `LOG_LEVEL` | `debug` / `dev` | `info` (JSON) | `info` (JSON) |
