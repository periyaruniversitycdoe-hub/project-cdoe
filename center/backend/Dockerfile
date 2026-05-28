# ──���───────────────────────────────────��──────────────────────────────────────
# Center Backend — Production Dockerfile
# Build context: project root (needs shared/)
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine AS base
RUN apk add --no-cache dumb-init

FROM base AS deps
WORKDIR /app/center/backend
COPY center/backend/package*.json ./
RUN npm ci --only=production --ignore-scripts

FROM base AS production
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nodeapp -u 1001 -G nodejs

WORKDIR /app

COPY --chown=nodeapp:nodejs shared/ ./shared/
COPY --chown=nodeapp:nodejs center/backend/ ./center/backend/

COPY --from=deps --chown=nodeapp:nodejs /app/center/backend/node_modules ./center/backend/node_modules
COPY --from=deps --chown=nodeapp:nodejs /app/center/backend/package.json ./center/backend/package.json

RUN mkdir -p /app/shared/uploads/centres \
             /app/center/backend/logs \
    && chown -R nodeapp:nodejs /app/shared /app/center/backend/logs

WORKDIR /app/center/backend
USER nodeapp

EXPOSE 5003

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -qO- http://localhost:5003/ 2>&1 | grep -qv "ECONNREFUSED" || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
