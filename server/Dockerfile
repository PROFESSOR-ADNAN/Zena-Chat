# --- deps: install production dependencies only ------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- runtime: minimal final image ---------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Official Node images ship a non-root 'node' user — nothing here needs
# root, so there's no reason to run as it.
USER node

EXPOSE 5000

# Uses Node's own fetch instead of installing curl/wget just for this.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Exec form (not shell form) so Node receives SIGTERM directly — a shell
# wrapping the process would swallow it, breaking graceful shutdown.
CMD ["node", "src/server.js"]
