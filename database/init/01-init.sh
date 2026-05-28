#!/bin/bash
# ═════════════════════════════════════════════════════════════════════════════
# MySQL Docker Entrypoint Init Script
# Runs all SQL migrations in correct order on first container startup.
# Docker only executes scripts in /docker-entrypoint-initdb.d on a FRESH volume.
# ═════════════════════════════════════════════════════════════════════════════

set -e

MIGRATIONS_DIR="/migrations"
DB="${MYSQL_DATABASE:-rsm_db}"

echo "═══════════════════════════════════════════════"
echo " PhD ERP — Database Migration Runner"
echo " Target database: $DB"
echo "═══════════════════════════════════════════════"

run_sql() {
    local file="$1"
    local label=$(basename "$file")
    echo "  ▶ Running: $label"
    mysql -u root -p"${MYSQL_ROOT_PASSWORD}" "$DB" < "$file" 2>&1 | \
        grep -v "Warning: Using a password" || true
    echo "  ✓ Done: $label"
}

# ── Run SQL migrations in dependency order ────────────────────────────────────
declare -a SQL_FILES=(
    "database.sql"
    "features_migration.sql"
    "session_migration.sql"
    "phase_migration.sql"
    "enterprise_migration.sql"
    "upgrade_v3_migration.sql"
    "supervisor_centre_migration.sql"
    "payment_migration.sql"
    "workflow_migration.sql"
    "email_migration.sql"
    "dynamic_email_system.sql"
    "department_master_migration.sql"
    "setup_education_tables.sql"
    "portal_users_tables.sql"
    "missing_dropdowns_migration.sql"
    "community_fee_migration.sql"
    "payment_enterprise_migration.sql"
    "session_indexes.sql"
    "unified_notifications.sql"
    "update_settings_schema.sql"
    "application_id_delayed_generation.sql"
    "post_payment_application_id_migration.sql"
    "002_student_tracking.sql"
    "003_workflow_gates.sql"
    "004_eligibility_engine.sql"
)

for filename in "${SQL_FILES[@]}"; do
    filepath="$MIGRATIONS_DIR/$filename"
    if [ -f "$filepath" ]; then
        run_sql "$filepath"
    else
        echo "  ⚠ Skipped (not found): $filename"
    fi
done

# ── Create application-specific DB user with least privilege ──────────────────
echo ""
echo "Creating application database user..."
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" <<EOF 2>&1 | grep -v "Warning: Using a password" || true
CREATE USER IF NOT EXISTS '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER ON ${DB}.* TO '${DB_USER}'@'%';
FLUSH PRIVILEGES;
EOF
echo "  ✓ User '${DB_USER}' created with application privileges."

echo ""
echo "═══════════════════════════════════════════════"
echo " Migration complete ✓"
echo "═══════════════════════════════════════════════"
