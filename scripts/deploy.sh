#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════
# PhD ERP — Production Deployment Script
# Usage: ./scripts/deploy.sh [--no-build] [--tag v1.2.3]
# ═════════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE="docker compose -f $PROJECT_DIR/docker-compose.yml"

# ── Parse flags ───────────────────────────────────────────────────────────────
NO_BUILD=0
TAG="${TAG:-latest}"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-build) NO_BUILD=1 ;;
        --tag) TAG="$2"; shift ;;
        *) echo "Unknown flag: $1"; exit 1 ;;
    esac
    shift
done

export TAG

log()  { echo -e "\033[1;32m[DEPLOY]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
fail() { echo -e "\033[1;31m[FAIL]\033[0m $*" >&2; exit 1; }

# ── Pre-flight checks ─────────────────────────────────────────────────────────
log "Pre-flight checks..."

command -v docker   >/dev/null 2>&1 || fail "Docker not installed"
command -v openssl  >/dev/null 2>&1 || warn "openssl not found — SSL setup may fail"

[[ -f "$PROJECT_DIR/.env" ]] || fail ".env not found. Copy .env.example → .env and fill values."

# Validate required env vars
source "$PROJECT_DIR/.env" 2>/dev/null || true
: "${DB_PASSWORD:?DB_PASSWORD must be set in .env}"
: "${DB_ROOT_PASSWORD:?DB_ROOT_PASSWORD must be set in .env}"
: "${REDIS_PASSWORD:?REDIS_PASSWORD must be set in .env}"
: "${STUDENT_JWT_SECRET:?STUDENT_JWT_SECRET must be set in .env}"
: "${ADMIN_JWT_SECRET:?ADMIN_JWT_SECRET must be set in .env}"

log "All required secrets present ✓"

# ── SSL certificates ──────────────────────────────────────────────────────────
log "Checking SSL certificates..."
SSL_DIR="$PROJECT_DIR/nginx/ssl"
if [[ ! -d "$SSL_DIR/student.university.com" ]]; then
    warn "SSL certs not found. Running ssl-setup.sh..."
    bash "$SCRIPT_DIR/ssl-setup.sh"
fi

# ── Build images ──────────────────────────────────────────────────────────────
if [[ "$NO_BUILD" -eq 0 ]]; then
    log "Building Docker images (TAG=$TAG)..."
    cd "$PROJECT_DIR"
    $COMPOSE build --parallel --no-cache
    log "Build complete ✓"
fi

# ── Database init script must be executable ───────────────────────────────────
chmod +x "$PROJECT_DIR/database/init/01-init.sh"
chmod +x "$PROJECT_DIR/scripts/backup-cron.sh" 2>/dev/null || true

# ── Rolling deploy ────────────────────────────────────────────────────────────
log "Starting infrastructure services..."
cd "$PROJECT_DIR"
$COMPOSE up -d mysql redis

log "Waiting for MySQL to be healthy..."
TRIES=0
until $COMPOSE exec mysql mysqladmin ping -u root -p"${DB_ROOT_PASSWORD}" --silent 2>/dev/null; do
    TRIES=$((TRIES + 1))
    [[ $TRIES -gt 40 ]] && fail "MySQL failed to start after 120s"
    sleep 3
done
log "MySQL healthy ✓"

log "Starting backend services..."
$COMPOSE up -d student-backend admin-backend supervisor-backend center-backend notification-service

log "Waiting for backends to be healthy..."
sleep 10

log "Starting frontend services..."
$COMPOSE up -d student-ui admin-ui supervisor-ui center-ui

log "Waiting for frontends..."
sleep 5

log "Starting nginx proxy..."
$COMPOSE up -d nginx

log "Starting backup service..."
$COMPOSE up -d backup

# ── Health verification ───────────────────────────────────────────────────────
log "Running health checks..."
sleep 5

HEALTH_FAILED=0
for svc in student-backend admin-backend supervisor-backend center-backend student-ui admin-ui supervisor-ui center-ui nginx; do
    STATUS=$($COMPOSE ps --format json "$svc" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Health','unknown'))" 2>/dev/null || echo "unknown")
    if [[ "$STATUS" == "healthy" ]]; then
        log "  ✓ $svc — healthy"
    else
        warn "  ⚠ $svc — $STATUS (may still be starting)"
        HEALTH_FAILED=$((HEALTH_FAILED + 1))
    fi
done

if [[ $HEALTH_FAILED -gt 0 ]]; then
    warn "$HEALTH_FAILED services not yet healthy (normal on first start — check with: docker compose ps)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
log "═══════════════════════════════════════════════"
log " Deployment complete!"
log "═══════════════════════════════════════════════"
log ""
log " Student Portal:    https://student.university.com"
log " Admin Portal:      https://admin.university.com"
log " Supervisor Portal: https://supervisor.university.com"
log " Center Portal:     https://center.university.com"
log ""
log " Logs:    docker compose logs -f [service]"
log " Status:  docker compose ps"
log " Stop:    docker compose down"
log "═══════════════════════════════════════════════"
