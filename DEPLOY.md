# Deploying the chat backend

Three pieces this time, not two: MongoDB (Atlas), Redis (Upstash), and
somewhere to run the container (Render). All three have permanent free
tiers with no credit card required. Free-tier terms change — this was
accurate as of late 2026; double-check current terms before relying on
it.

## 1. Database — MongoDB Atlas (free M0 cluster)

Same as the marketplace project's guide, minus one thing worth noting:
nothing in this codebase uses a multi-document transaction, so there's
no replica-set requirement to think about here. (Atlas M0 is a
replica set by default regardless — it just isn't something this
project depends on.)

1. Sign up at [cloud.mongodb.com](https://cloud.mongodb.com), build a
   database, select **M0 (Free)**, pick a region near where Render
   deploys you.
2. Create a database user (autogenerate a password, save it somewhere
   real — not in git).
3. **Network Access** → add `0.0.0.0/0` (M0 can't restrict to a dynamic
   host like Render; access control here is really the
   username/password).
4. **Connect** → **Drivers** → copy the connection string. It looks like
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/chat?retryWrites=true&w=majority`
   — this is your `MONGO_URI`.

## 2. Redis — Upstash (free tier)

New for this project: the Socket.IO adapter and presence tracking both
need a real Redis, and it needs to be reachable by every server
instance.

1. Sign up at [console.upstash.com](https://console.upstash.com), create
   a **Redis** database. The free tier is permanent: 256 MB and 500,000
   commands per month.
2. On the database page, find the **TCP** connection string — it starts
   with `rediss://` (two s's — that's TLS, which Upstash requires on
   every database and doesn't let you turn off). This is your
   `REDIS_URL`.

**No code changes needed** — `ioredis` picks up TLS from the `rediss://`
scheme automatically, and that includes the duplicated subscriber
connection the Socket.IO adapter uses (verified directly: a client built
from a `rediss://` URL has TLS enabled, and so does its `.duplicate()`).
`redis://localhost:6379` for local dev, `rediss://...` for Upstash — same
code either way, just a different env var.

Use the **TCP** connection string, not the REST URL/token Upstash also
shows. Upstash serves the same database over both, but the REST API is
for serverless environments (Vercel, Cloudflare Workers) via their own
`@upstash/redis` SDK — this app uses a standard Redis client over TCP,
which is what the TCP string is for.

**A budget worth knowing about**: 500,000 commands a month sounds like a
lot until you count what presence costs — every connect/disconnect does
several Redis commands, and `reconcilePresence` sweeps the keyspace once
a minute by default (43,200 sweeps a month by itself, each doing at
least a couple of commands even with nobody online). That alone can eat
a noticeable slice of the free tier. Set
`PRESENCE_RECONCILE_INTERVAL_MS` (e.g. `300000` for every 5 minutes) to
stretch it — the tradeoff is that a crashed instance's stale entries
take correspondingly longer to clear. Fine for a portfolio demo either
way; not something to leave running at real scale on the free tier.

## 3. App — Render (free web service, Docker)

1. Push this repo to GitHub if you haven't already.
2. On [render.com](https://render.com), **New** → **Blueprint**, point it
   at the repo — it reads `render.yaml` at the root. (No Blueprint
   support? **New** → **Web Service** → connect the repo → runtime
   **Docker** → root directory `backend` — same result, configured by
   hand.)
3. Fill in the env vars the blueprint left blank (`sync: false` in
   `render.yaml` means "ask in the dashboard," not "leave empty"):
   - `MONGO_URI` — from step 1
   - `REDIS_URL` — from step 2
   - `CLIENT_URL` — wherever the frontend ends up living (used for
     Socket.IO's CORS)
4. Deploy. Render builds `backend/Dockerfile` and gives you a live URL.

### About WebSockets on Render's free tier — read this before you demo

This is worth being precise about, because there's old information out
there that no longer applies, and newer information that does:

- **What used to be broken**: Render's own community forum has multiple
  threads from before 2026 where free-tier WebSocket connections got
  closed after exactly 5 minutes regardless of activity, and Render staff
  confirmed it was a free-tier limitation with no ETA on a fix. If you
  search this problem yourself, that's what you'll find.
- **What changed**: Render's own changelog (February 24, 2026) says free
  web services now stay active while receiving WebSocket messages —
  before, only incoming HTTP requests delayed the 15-minute idle
  spin-down, so a service could spin down even while a WebSocket
  connection was actively passing traffic. That's the fix for the old
  behavior.
- **What still applies**: after 15 minutes with *no* HTTP request and
  *no* incoming WebSocket message, the service still spins down —
  standard free-tier behavior — and every open socket goes with it. The
  next request wakes it back up, taking roughly a minute. That's
  expected, and it's worth knowing before a live demo.
- **Honest limit**: I couldn't test a deployment of my own, so this is
  researched from Render's official sources but not verified end to end
  against this specific app. Worth a real test — leave a chat open for
  longer than 5 minutes and confirm it doesn't drop.

This is where phase 5 quietly pays for itself: the reconnect-and-sync
design (`GET /api/conversations/sync`, idempotent `clientMessageId`
sends) is exactly what makes a spin-down survivable for this app
specifically. A client that reconnects after a cold start catches up on
what it missed and retries anything unacknowledged, instead of
silently losing messages — which is the actual reason it was built that
way, rather than assuming a connection that never drops.

### Update `CLIENT_URL` once your frontend has a URL

Same chicken-and-egg as the marketplace project's `API_BASE_URL`:
`CLIENT_URL` needs a real value for CORS to work, but you may not have a
frontend deployed yet. Set a placeholder, deploy, then update it in the
Render dashboard (env var changes trigger a redeploy automatically).

## Alternative: self-hosted with Docker Compose

`docker-compose.yml` at the repo root runs Mongo, Redis, and the backend
together — simpler than the marketplace project's version, since Mongo
here is a plain standalone instance with no replica-set setup step:

```bash
cp backend/.env.example backend/.env   # fill in real values
docker compose up --build
```

Useful for a VPS, or for running the whole stack locally exactly as
it'd run in production. Not something I could build or run myself in this
environment — no Docker available here — so this is written correctly
against Compose's documented behavior but not build-tested. Worth a
real `docker compose up` before trusting it.
