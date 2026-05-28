#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════
# PhD ERP — Database Restore Script
# Usage: ./scripts/restore.sh <backup-file.sql.gz>
#        ./scripts/restore.sh --list
# ═════════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

log()  { echo -e "\033[1;32m[RESTORE]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
fail() { echo -e "\033[1;31m[FAIL]\033[0m $*" >&2; exit 1; }

[[ -f "$PROJECT_DIR/.env" ]] || fail ".env not found."
source "$PROJECT_DIR/.env"

# ── List available backups ────────────────────────────────────────────────────
if [[ "${1:-}" == "--list" ]]; then
    log "Available backups:"
    docker compose -f "$PROJECT_DIR/docker-compose.yml" exec backup \
        bash -c 'ls -lh /backups/*.sql.gz 2>/dev/null || echo "No backups found"'
    exit 0
fi

BACKUP_FILE="${1:-}"
[[ -z "$BACKUP_FILE" ]] && fail "Usage: $0 <backup-file.sql.gz> or $0 --list"

# ── Confirm destructive operation ─────────────────────────────────────────────
warn "⚠ This will OVERWRITE the entire database '$DB_NAME'."
warn "  Source: $BACKUP_FILE"
read -p "  Type 'yes' to confirm: " CONFIRM
[[ "$CONFIRM" == "yes" ]] || fail "Aborted."

# ── Copy backup file into backup container and restore ────────────────────────
CONTAINER="phd_backup"
REMOTE_PATH="/tmp/restore_$(date +%s).sql.gz"

log "Copying backup to container..."
docker cp "$BACKUP_FILE" "${CONTAINER}:${REMOTE_PATH}"

log "Restoring database $DB_NAME from $BACKUP_FILE..."
docker exec "$CONTAINER" bash -c "
    gunzip -c '${REMOTE_PATH}' | \
    mysql \
        --host='${DB_HOST:-mysql}' \
        --user='${DB_USER}' \
        --password='${DB_PASSWORD}' \
        '${DB_NAME}'
"

log "Cleaning up temp file..."
docker exec "$CONTAINER" rm -f "$REMOTE_PATH"

log "Restore complete ✓"
log "Restart backends to clear connection pools:"
log "  docker compose restart student-backend admin-backend supervisor-backend center-backend"
