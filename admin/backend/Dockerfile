# ─────────────────────────────────────────────────────────────────────────────
# Admin Backend — Production Dockerfile
# Build context: project root
# Admin backend imports supervisor/backend/routes and center/backend/routes,
# plus shared/ — so the full project root must be the build context.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine AS base
RUN apk add --no-cache dumb-init

# ── Dependency install ────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app/admin/backend
COPY admin/backend/package*.json ./
RUN npm ci --only=production --ignore-scripts

# ── Production stage ──────────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nodeapp -u 1001 -G nodejs

WORKDIR /app

# shared utilities
COPY --chown=nodeapp:nodejs shared/ ./shared/

# admin backend source
COPY --chown=nodeapp:nodejs admin/backend/ ./admin/backend/

# supervisor & center routes imported directly by admin-backend
COPY --chown=nodeapp:nodejs supervisor/backend/routes/ ./supervisor/backend/routes/
COPY --chown=nodeapp:nodejs supervisor/backend/services/ ./supervisor/backend/services/
COPY --chown=nodeapp:nodejs center/backend/routes/ ./center/backend/routes/

# Copy installed production dependencies
COPY --from=deps --chown=nodeapp:nodejs /app/admin/backend/node_modules ./admin/backend/node_modules
COPY --from=deps --chown=nodeapp:nodejs /app/admin/backend/package.json ./admin/backend/package.json

RUN mkdir -p /app/shared/uploads/supervisors \
             /app/shared/uploads/centres \
             /app/shared/uploads/settings \
             /app/admin/backend/uploads \
             /app/admin/backend/logs \
    && chown -R nodeapp:nodejs /app/shared /app/admin/backend/logs

WORKDIR /app/admin/backend
USER nodeapp

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -qO- http://localhost:5001/ 2>&1 | grep -qv "ECONNREFUSED" || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
