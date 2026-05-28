/**
 * SUPERVISOR MODULE HOTFIX MIGRATION
 * Safe — checks column/table existence before altering.
 * Run once: node database/migrations/supervisor_hotfix_migration.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mysql = require('mysql2/promise');

async function columnExists(conn, table, column) {
    const [rows] = await conn.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        [table, column]
    );
    return rows[0].cnt > 0;
}

async function tableExists(conn, table) {
    const [rows] = await conn.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = ?`,
        [table]
    );
    return rows[0].cnt > 0;
}

async function addColumnIfMissing(conn, table, column, definition, afterCol = null) {
    if (await columnExists(conn, table, column)) {
        console.log(`  [SKIP] ${table}.${column} already exists`);
        return;
    }
    const after = afterCol ? ` AFTER \`${afterCol}\`` : '';
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}${after}`);
    console.log(`  [OK]   ${table}.${column} added`);
}

async function run() {
    const conn = await mysql.createConnection({
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '3306'),
        user:     process.env.DB_USER     || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME     || 'rsm_db',
        multipleStatements: true,
    });

    try {
        console.log('\n=== SUPERVISOR MODULE HOTFIX MIGRATION ===\n');

        // ── 1. supervisors table: add missing columns ──────────────────────────
        console.log('[1] Adding missing columns to supervisors table...');

        await addColumnIfMissing(conn, 'supervisors', 'bank_holder_name',
            'VARCHAR(300) DEFAULT NULL', 'recognition_certificate');
        await addColumnIfMissing(conn, 'supervisors', 'bank_name',
            'VARCHAR(200) DEFAULT NULL', 'bank_holder_name');
        await addColumnIfMissing(conn, 'supervisors', 'account_number',
            'VARCHAR(50) DEFAULT NULL', 'bank_name');
        await addColumnIfMissing(conn, 'supervisors', 'ifsc_code',
            'VARCHAR(20) DEFAULT NULL', 'account_number');

        await addColumnIfMissing(conn, 'supervisors', 'rejection_reason',
            'TEXT DEFAULT NULL', 'remarks');
        await addColumnIfMissing(conn, 'supervisors', 'approved_by',
            'INT DEFAULT NULL', 'rejection_reason');
        await addColumnIfMissing(conn, 'supervisors', 'approved_at',
            'TIMESTAMP NULL DEFAULT NULL', 'approved_by');

        // Scholar allocation engine — initialize to 0 (future-ready)
        await addColumnIfMissing(conn, 'supervisors', 'current_scholars_count',
            'INT NOT NULL DEFAULT 0', 'current_vacancy');
        await addColumnIfMissing(conn, 'supervisors', 'current_part_time_scholars_count',
            'INT NOT NULL DEFAULT 0', 'current_scholars_count');

        // ── 2. Extend status ENUM ───────────────────────────────────────────────
        console.log('\n[2] Extending supervisors.status ENUM...');
        await conn.query(`
            ALTER TABLE supervisors
            MODIFY COLUMN status
            ENUM('Active','Inactive','Pending','Approved','Rejected','Draft')
            NOT NULL DEFAULT 'Draft'
        `);
        console.log('  [OK]   status enum extended');

        // ── 3. supervisor_capacity_master table ────────────────────────────────
        console.log('\n[3] Creating supervisor_capacity_master table (if missing)...');
        if (await tableExists(conn, 'supervisor_capacity_master')) {
            console.log('  [SKIP] supervisor_capacity_master already exists');
        } else {
            await conn.query(`
                CREATE TABLE supervisor_capacity_master (
                    id              INT AUTO_INCREMENT PRIMARY KEY,
                    designation_id  INT NOT NULL,
                    max_capacity    INT NOT NULL DEFAULT 0,
                    status          ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
                    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    CONSTRAINT fk_scm_designation
                        FOREIGN KEY (designation_id) REFERENCES master_designations(id) ON DELETE CASCADE,
                    UNIQUE KEY uq_scm_designation (designation_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
            console.log('  [OK]   supervisor_capacity_master created');
        }

        // ── 4. Index for disciplines supervisor_id (if missing) ────────────────
        console.log('\n[4] Ensuring index on supervisor_disciplines.supervisor_id...');
        try {
            await conn.query(
                `CREATE INDEX idx_sd_supervisor ON supervisor_disciplines (supervisor_id)`
            );
            console.log('  [OK]   index created');
        } catch (e) {
            if (e.code === 'ER_DUP_KEYNAME') {
                console.log('  [SKIP] index already exists');
            } else {
                throw e;
            }
        }

        console.log('\n=== MIGRATION COMPLETE ===\n');
    } finally {
        await conn.end();
    }
}

run().catch(err => {
    console.error('MIGRATION FAILED:', err.message);
    process.exit(1);
});
