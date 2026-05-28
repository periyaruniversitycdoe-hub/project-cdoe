# ─────────────────────────────────────────────────────────────────────────────
# Student Backend — Production Dockerfile
# Build context: project root (required for shared/ and cross-module code)
# Usage: docker build -f student/backend/Dockerfile -t phd-student-backend .
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine AS base
# Install dumb-init for proper signal handling and tini for zombie reaping
RUN apk add --no-cache dumb-init

# ── Dependency install stage ──────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app/student/backend
# Copy only package files first for layer caching
COPY student/backend/package*.json ./
RUN npm ci --only=production --ignore-scripts

# ── Production stage ──────────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodeapp -u 1001 -G nodejs

WORKDIR /app

# Copy shared utilities that all backends depend on
COPY --chown=nodeapp:nodejs shared/ ./shared/

# Copy the payment services (referenced by student backend)
COPY --chown=nodeapp:nodejs student/backend/services/ ./student/backend/services/
COPY --chown=nodeapp:nodejs student/backend/middleware/ ./student/backend/middleware/
COPY --chown=nodeapp:nodejs student/backend/config/ ./student/backend/config/
COPY --chown=nodeapp:nodejs student/backend/utils/ ./student/backend/utils/
COPY --chown=nodeapp:nodejs student/backend/templates/ ./student/backend/templates/
COPY --chown=nodeapp:nodejs student/backend/server.js ./student/backend/server.js

# Copy installed dependencies from deps stage
COPY --from=deps --chown=nodeapp:nodejs /app/student/backend/node_modules ./student/backend/node_modules
COPY --from=deps --chown=nodeapp:nodejs /app/student/backend/package.json ./student/backend/package.json

# Ensure uploads directory exists with correct permissions
RUN mkdir -p /app/shared/uploads/students \
             /app/student/backend/uploads \
             /app/student/backend/logs \
    && chown -R nodeapp:nodejs /app/shared /app/student/backend/logs

WORKDIR /app/student/backend
USER nodeapp

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -qO- http://localhost:5000/api/health 2>/dev/null | grep -q '"ok"' || \
        wget -qO- http://localhost:5000/ 2>&1 | grep -qv "ECONNREFUSED" || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
