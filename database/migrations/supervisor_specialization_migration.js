/**
 * SUPERVISOR AREA OF SPECIALIZATION MIGRATION
 * Safe — checks column existence before altering.
 * Run once: node database/migrations/supervisor_specialization_migration.js
 */

const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

// Manually parse .env file
function loadEnv() {
    const envPath = path.join(__dirname, '../../.env');
    if (!fs.existsSync(envPath)) {
        console.warn('.env file not found at', envPath);
        return;
    }
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const parts = trimmed.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                let value = parts.slice(1).join('=').trim();
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.substring(1, value.length - 1);
                }
                process.env[key] = value;
            }
        }
    });
}

loadEnv();

async function columnExists(conn, table, column) {
    const [rows] = await conn.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
         [table, column]
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
        console.log('\n=== SUPERVISOR AREA OF SPECIALIZATION MIGRATION ===\n');

        console.log('[1] Adding area_of_specialization column to supervisors table...');
        await addColumnIfMissing(conn, 'supervisors', 'area_of_specialization',
            'VARCHAR(300) DEFAULT NULL', 'department_id');

        console.log('\n=== MIGRATION COMPLETE ===\n');
    } finally {
        await conn.end();
    }
}

run().catch(err => {
    console.error('MIGRATION FAILED:', err.message);
    process.exit(1);
});
