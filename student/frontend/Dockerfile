# ─────────────────────────────────────────────────────────────────────────────
# Student Portal — Production Dockerfile (multi-stage)
# Stage 1: Vite build   Stage 2: nginx:alpine static server
# Build context: student/frontend/
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_API_URL=/api
ARG VITE_STUDENT_URL=https://student.university.com

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_STUDENT_URL=$VITE_STUDENT_URL

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:1.25-alpine AS production

# Security: run nginx as non-root (port 8080 inside container)
RUN addgroup -g 1001 -S nginx-app \
 && adduser  -S nginx-app -u 1001 -G nginx-app \
 && touch /var/run/nginx.pid \
 && chown nginx-app:nginx-app /var/run/nginx.pid

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA routing: serve index.html for all non-file paths
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml application/xml+rss text/javascript
               image/svg+xml;
    gzip_min_length 1024;
    gzip_vary on;

    # Cache static assets aggressively
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
        add_header X-Frame-Options "SAMEORIGIN";
        add_header X-Content-Type-Options "nosniff";
    }

    # Health probe (used by Docker healthcheck and nginx proxy)
    location /health {
        access_log off;
        return 200 "ok\n";
        add_header Content-Type text/plain;
    }
}
EOF

EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8080/health | grep -q ok || exit 1
CMD ["nginx", "-g", "daemon off;"]
