const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Manually parse .env file to avoid external library dependencies
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
                // Strip quotes if present
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

async function addColumnIfMissing(conn, table, column, definition) {
    if (await columnExists(conn, table, column)) {
        console.log(`  [SKIP] ${table}.${column} already exists`);
        return;
    }
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`  [OK]   ${table}.${column} added`);
}

async function run() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'rsm_db',
    });
    
    try {
        console.log('\n=== CENTRAL UPLOAD SETTINGS UNIFICATION MIGRATION ===\n');

        // 1. Add is_active column to file_upload_settings if missing
        console.log('[1] Adding is_active column to file_upload_settings...');
        await addColumnIfMissing(conn, 'file_upload_settings', 'is_active', 'TINYINT(1) DEFAULT 1');

        // 2. Seed configurations for new academic uploads
        console.log('\n[2] Seeding central configurations...');
        const seedRows = [
            {
                file_type: '10th Standard Marksheet',
                max_size: 2,
                size_unit: 'MB',
                allowed_extensions: 'jpg,jpeg,png,pdf',
                is_integrated_course: 0,
                consolidated_enabled: 1,
                semester_wise_enabled: 0,
                max_semesters: 1,
                allowed_semester_doc_types: 'jpg,jpeg,png,pdf',
                per_file_size_limit: 500,
                total_size_limit: 5000,
                is_active: 1
            },
            {
                file_type: '12th Standard Marksheet',
                max_size: 2,
                size_unit: 'MB',
                allowed_extensions: 'jpg,jpeg,png,pdf',
                is_integrated_course: 0,
                consolidated_enabled: 1,
                semester_wise_enabled: 0,
                max_semesters: 1,
                allowed_semester_doc_types: 'jpg,jpeg,png,pdf',
                per_file_size_limit: 500,
                total_size_limit: 5000,
                is_active: 1
            },
            {
                file_type: 'UG Degree Documents',
                max_size: 2,
                size_unit: 'MB',
                allowed_extensions: 'jpg,jpeg,png,pdf',
                is_integrated_course: 0,
                consolidated_enabled: 1,
                semester_wise_enabled: 1,
                max_semesters: 8,
                allowed_semester_doc_types: 'jpg,jpeg,png,pdf',
                per_file_size_limit: 500,
                total_size_limit: 5000,
                is_active: 1
            },
            {
                file_type: 'PG Degree Documents',
                max_size: 2,
                size_unit: 'MB',
                allowed_extensions: 'jpg,jpeg,png,pdf',
                is_integrated_course: 0,
                consolidated_enabled: 1,
                semester_wise_enabled: 1,
                max_semesters: 4,
                allowed_semester_doc_types: 'jpg,jpeg,png,pdf',
                per_file_size_limit: 500,
                total_size_limit: 5000,
                is_active: 1
            }
        ];

        for (const row of seedRows) {
            // Check if exists
            const [ex] = await conn.query('SELECT id FROM file_upload_settings WHERE file_type = ?', [row.file_type]);
            if (ex.length > 0) {
                console.log(`  [SKIP] "${row.file_type}" config already exists, skipping overwrite`);
            } else {
                await conn.query(`
                    INSERT INTO file_upload_settings (
                        file_type, max_size, size_unit, allowed_extensions, 
                        is_integrated_course, consolidated_enabled, semester_wise_enabled, 
                        max_semesters, allowed_semester_doc_types, per_file_size_limit, total_size_limit, is_active
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    row.file_type, row.max_size, row.size_unit, row.allowed_extensions,
                    row.is_integrated_course, row.consolidated_enabled, row.semester_wise_enabled,
                    row.max_semesters, row.allowed_semester_doc_types, row.per_file_size_limit, row.total_size_limit, row.is_active
                ]);
                console.log(`  [OK]   "${row.file_type}" seeded`);
            }
        }

        console.log('\n=== MIGRATION COMPLETE ===\n');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await conn.end();
    }
}

run();
