# ─────────────────────────────────────────────────────────────────────────────
# Supervisor Backend — Production Dockerfile
# Build context: project root (needs shared/)
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine AS base
RUN apk add --no-cache dumb-init

FROM base AS deps
WORKDIR /app/supervisor/backend
COPY supervisor/backend/package*.json ./
RUN npm ci --only=production --ignore-scripts

FROM base AS production
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nodeapp -u 1001 -G nodejs

WORKDIR /app

COPY --chown=nodeapp:nodejs shared/ ./shared/
COPY --chown=nodeapp:nodejs supervisor/backend/ ./supervisor/backend/

COPY --from=deps --chown=nodeapp:nodejs /app/supervisor/backend/node_modules ./supervisor/backend/node_modules
COPY --from=deps --chown=nodeapp:nodejs /app/supervisor/backend/package.json ./supervisor/backend/package.json

RUN mkdir -p /app/shared/uploads/supervisors \
             /app/supervisor/backend/logs \
    && chown -R nodeapp:nodejs /app/shared /app/supervisor/backend/logs

WORKDIR /app/supervisor/backend
USER nodeapp

EXPOSE 5002

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -qO- http://localhost:5002/ 2>&1 | grep -qv "ECONNREFUSED" || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
