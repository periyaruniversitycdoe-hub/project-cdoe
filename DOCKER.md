# PhD Admission Management System — Docker Architecture Guide

## Architecture Overview

```
Internet (port 80/443)
        │
  ┌─────▼──────────────────────────────────────────────────┐
  │  nginx  (reverse proxy + SSL termination)              │
  │  phd_nginx  ·  app_net only                            │
  └─────┬──────────────────────────────────────────────────┘
        │
  ┌─────▼────────────────────────────────────────────────────────────────────┐
  │  app_net  (172.20.0.0/24)                                                │
  │                                                                           │
  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
  │  │ student-ui  │  │  admin-ui   │  │supervisor-ui │  │  center-ui   │  │
  │  │  :8080      │  │   :8080     │  │   :8080      │  │   :8080      │  │
  │  └─────────────┘  └─────────────┘  └──────────────┘  └──────────────┘  │
  │                                                                           │
  │  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────────┐  │
  │  │ student-backend  │  │  admin-backend   │  │ notification-service  │  │
  │  │     :5000        │  │     :5001        │  │       :3000           │  │
  │  └────────┬─────────┘  └────────┬─────────┘  └──────────┬────────────┘  │
  │           │                     │                         │               │
  │  ┌────────▼──────┐   ┌──────────▼──────┐                 │               │
  │  │supervisor-be  │   │  center-backend  │                 │               │
  │  │    :5002      │   │     :5003        │                 │               │
  │  └────────┬──────┘   └──────────┬───────┘                │               │
  └───────────┼─────────────────────┼────────────────────────┼───────────────┘
              │                     │                         │
  ┌───────────▼─────────────────────▼─────────────────────────▼───────────────┐
  │  db_net  (172.21.0.0/24)  ← internal: true (NO internet egress)           │
  │                                                                             │
  │  ┌──────────────────────┐        ┌──────────────────┐                     │
  │  │       mysql          │        │      redis        │                     │
  │  │  NO external port    │        │  NO external port │                     │
  │  └──────────────────────┘        └──────────────────┘                     │
  │                                                                             │
  │  ┌──────────────────────┐                                                  │
  │  │       backup         │  (mysqldump → /backups volume, daily 02:00)     │
  │  └──────────────────────┘                                                  │
  └─────────────────────────────────────────────────────────────────────────────┘
```

## Services Reference

| Container | Image | Internal Port | Network | Purpose |
|---|---|---|---|---|
| phd_nginx | nginx:1.25-alpine | 80, 443 | app_net | Reverse proxy + SSL |
| phd_student_ui | phd/student-ui | 8080 | app_net | Student React SPA |
| phd_admin_ui | phd/admin-ui | 8080 | app_net | Admin React SPA |
| phd_supervisor_ui | phd/supervisor-ui | 8080 | app_net | Supervisor React SPA |
| phd_center_ui | phd/center-ui | 8080 | app_net | Center React SPA |
| phd_student_backend | phd/student-backend | 5000 | app_net + db_net | Student API |
| phd_admin_backend | phd/admin-backend | 5001 | app_net + db_net | Admin API |
| phd_supervisor_backend | phd/supervisor-backend | 5002 | app_net + db_net | Supervisor API |
| phd_center_backend | phd/center-backend | 5003 | app_net + db_net | Center API |
| phd_notification_service | phd/notification-service | 3000 | app_net + db_net | Email queue (NestJS) |
| phd_mysql | mysql:8.0 | — | db_net | Primary database |
| phd_redis | redis:7-alpine | — | db_net | Sessions, OTP, cache |
| phd_backup | mysql:8.0 | — | db_net | Daily DB backups |

## Quick Start

### 1. Copy and configure environment

```bash
cp .env.example .env
```

Edit `.env` and set **all** values. Critical ones:
- `DB_ROOT_PASSWORD` — MySQL root (init only)
- `DB_USER` / `DB_PASSWORD` — App DB user
- `REDIS_PASSWORD` — Redis auth
- `STUDENT_JWT_SECRET` / `ADMIN_JWT_SECRET` / `SUPERVISOR_JWT_SECRET` / `CENTER_JWT_SECRET`
- `SMTP_*` — Email credentials
- `PAYTM_MID` / `PAYTM_KEY` — Payment gateway

Generate JWT secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2. Set up SSL certificates

**For production** (requires domain DNS pointing to server):
```bash
bash scripts/ssl-setup.sh
```

**For local development** (self-signed):
```bash
bash scripts/ssl-setup.sh --self-signed
```

### 3. Build and start

```bash
# Full build and start
docker compose up -d --build

# Or use the deploy script
bash scripts/deploy.sh
```

### 4. Check health

```bash
bash scripts/health-check.sh

# Watch mode (refreshes every 10s)
bash scripts/health-check.sh --watch

# Docker native
docker compose ps
```

## Development Mode

Development mode exposes all ports to the host and enables debug logging:

```bash
# docker-compose.override.yml is auto-loaded in dev
docker compose up -d --build

# Direct access (no nginx):
# Student Frontend:    http://localhost:5173
# Admin Frontend:      http://localhost:5174
# Supervisor Frontend: http://localhost:5175
# Center Frontend:     http://localhost:5176
# Student API:         http://localhost:5000
# Admin API:           http://localhost:5001
# Supervisor API:      http://localhost:5002
# Center API:          http://localhost:5003
# Redis:               localhost:6379
# MySQL:               localhost:3306
```

For **production-only** (no override):
```bash
docker compose -f docker-compose.yml up -d
```

## Domain Routing (Production)

| Domain | Container | Backend |
|---|---|---|
| `student.university.com` | student-ui | student-backend |
| `admin.university.com` | admin-ui | admin-backend |
| `supervisor.university.com` | supervisor-ui | supervisor-backend |
| `center.university.com` | center-ui | center-backend |

### URL routing per portal:
```
https://student.university.com/          → student-ui (React SPA)
https://student.university.com/api/*     → student-backend:5000
https://student.university.com/uploads/* → shared uploads volume (read-only)
```

## Building Individual Services

```bash
# Rebuild a single service
docker compose build student-backend
docker compose up -d --no-deps student-backend

# Force no-cache rebuild
docker compose build --no-cache admin-ui
```

## Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f student-backend
docker compose logs -f nginx

# Last 100 lines
docker compose logs --tail=100 mysql
```

## Database Operations

### Access MySQL shell
```bash
docker compose exec mysql mysql -u "${DB_USER}" -p"${DB_PASSWORD}" rsm_db
```

### Run a migration manually
```bash
docker compose exec mysql mysql -u "${DB_USER}" -p"${DB_PASSWORD}" rsm_db \
    < database/migrations/some_migration.sql
```

### Backup now (manual)
```bash
docker compose exec backup bash /usr/local/bin/backup-cron.sh
```

### List backups
```bash
bash scripts/restore.sh --list
```

### Restore from backup
```bash
bash scripts/restore.sh ./backups/rsm_db_2025-01-01_020000.sql.gz
```

## Redis Operations

```bash
# Redis CLI
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}"

# Check memory
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" info memory

# Flush all OTPs (emergency only)
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" KEYS "otp:*"
```

## Scaling

Scale stateless backend services horizontally:
```bash
# Scale student backend to 3 replicas
docker compose up -d --scale student-backend=3
```

Note: nginx upstream is already configured with `keepalive` and `max_fails` for load balancing.

## Volumes

All data is stored in Docker-managed named volumes:

| Volume | Contents |
|---|---|
| `phd_mysql_data` | MySQL data directory |
| `phd_redis_data` | Redis RDB + AOF persistence |
| `phd_uploads_data` | Student/admin uploaded files |
| `phd_ssl_certs` | SSL certificate files |
| `phd_backup_data` | Database backup files (.sql.gz) |
| `phd_nginx_logs` | Nginx access/error logs |

### Inspect a volume
```bash
docker run --rm -v phd_uploads_data:/data alpine ls -la /data
```

## Monitoring (Optional)

Start the monitoring stack alongside the main stack:
```bash
docker compose -f docker-compose.yml \
               -f monitoring/docker-compose.monitoring.yml \
               up -d
```

- Grafana: http://localhost:3001 (admin / `$GRAFANA_ADMIN_PASSWORD`)
- Prometheus: http://localhost:9090

## Security Implementation

| Layer | Mechanism |
|---|---|
| Network isolation | `db_net` is `internal: true` — no internet egress |
| DB access | Only backend containers are in `db_net` |
| Secrets | All via `.env` file, never in Dockerfiles or images |
| Non-root containers | `nodeapp:1001` user in all Node containers |
| HTTPS | TLS 1.2/1.3 only, HSTS, OCSP stapling |
| Rate limiting | Per-endpoint zones: auth (20/min), payment (5/min), API (300/min) |
| Security headers | HSTS, X-Frame-Options, CSP, X-Content-Type-Options |
| Redis | `requirepass` + dangerous commands disabled (FLUSHALL, FLUSHDB, DEBUG) |
| File uploads | `client_max_body_size 50m` in nginx; X-Content-Type-Options on uploads |
| JWT | Per-portal secrets; tokens expire (configured in each backend) |

## Troubleshooting

### Container won't start
```bash
docker compose logs <service>
docker compose ps
```

### MySQL connection refused
```bash
# Wait for MySQL healthy
docker compose ps mysql
# Check init logs
docker compose logs mysql | tail -50
```

### Nginx 502 Bad Gateway
```bash
# Check backend is healthy
docker compose ps student-backend
# Check nginx can reach backend
docker compose exec nginx wget -qO- http://student-backend:5000/
```

### SSL certificate error
```bash
bash scripts/ssl-setup.sh --self-signed
docker compose restart nginx
```

### Reset everything (destructive)
```bash
docker compose down -v    # Removes ALL volumes including database!
docker compose up -d --build
```

## Update Deployment

```bash
git pull origin main
bash scripts/deploy.sh --tag $(git describe --tags --abbrev=0)
```
