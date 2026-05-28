#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════
# PhD ERP — Automated MySQL Backup Script
# Runs inside the backup container via cron at 02:00 daily.
# Backups stored in /backups (mounted volume: phd_backup_data)
# ═════════════════════════════════════════════════════════════════════════════
set -euo pipefail

BACKUP_DIR="/backups"
DATE=$(date +%Y-%m-%d_%H%M%S)
FILENAME="${MYSQL_DATABASE}_${DATE}.sql.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# ── Take backup ───────────────────────────────────────────────────────────────
log "Starting backup: $FILENAME"

mkdir -p "$BACKUP_DIR"

mysqldump \
    --host="$MYSQL_HOST" \
    --user="$MYSQL_USER" \
    --password="$MYSQL_PASSWORD" \
    --single-transaction \
    --routines \
    --triggers \
    --add-drop-table \
    --hex-blob \
    --default-character-set=utf8mb4 \
    "$MYSQL_DATABASE" \
  | gzip -9 > "$BACKUP_DIR/$FILENAME"

BACKUP_SIZE=$(du -sh "$BACKUP_DIR/$FILENAME" | cut -f1)
log "Backup complete: $FILENAME ($BACKUP_SIZE)"

# ── Verify backup ─────────────────────────────────────────────────────────────
if gunzip -t "$BACKUP_DIR/$FILENAME" 2>/dev/null; then
    log "Backup integrity verified ✓"
else
    log "ERROR: Backup integrity check FAILED — $FILENAME may be corrupt"
    exit 1
fi

# ── Prune old backups ─────────────────────────────────────────────────────────
log "Pruning backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
REMAINING=$(find "$BACKUP_DIR" -name "*.sql.gz" | wc -l)
log "Retained $REMAINING backup(s)"

# ── Listing ───────────────────────────────────────────────────────────────────
log "Current backups:"
ls -lh "$BACKUP_DIR/"*.sql.gz 2>/dev/null | awk '{print "  " $5 " " $9}'
