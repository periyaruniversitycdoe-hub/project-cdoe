# ─────────────────────────────────────────────────────────────────────────────
# Notification Service (NestJS + BullMQ) — Production Dockerfile
# Build context: email-service/
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine AS base
RUN apk add --no-cache dumb-init

# ── Build stage: compile TypeScript ──────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY package*.json ./
# Install ALL deps (including devDeps) for TypeScript compilation
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ── Production deps only ──────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts

# ── Production image ──────────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nestapp -u 1001 -G nodejs

WORKDIR /app

# Copy compiled output
COPY --from=builder --chown=nestapp:nodejs /app/dist ./dist
# Copy production node_modules
COPY --from=deps  --chown=nestapp:nodejs /app/node_modules ./node_modules
# Copy package.json for metadata
COPY --chown=nestapp:nodejs package.json ./
# Copy Prisma schema if present
COPY --chown=nestapp:nodejs prisma/ ./prisma/ 2>/dev/null || true

RUN mkdir -p /app/logs && chown nestapp:nodejs /app/logs

USER nestapp

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/v1/health 2>/dev/null | grep -q "ok" || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
