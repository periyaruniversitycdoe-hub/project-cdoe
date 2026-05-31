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
        console.log('\n=== INTEGRATED COURSE & ACADEMIC VALIDATION REFACTOR MIGRATION ===\n');

        // 1. Alter higher_education to support Integrated details
        console.log('[1] Updating higher_education table...');
        await conn.query(`ALTER TABLE higher_education MODIFY COLUMN level VARCHAR(50) NOT NULL`);
        await addColumnIfMissing(conn, 'higher_education', 'registration_number', 'VARCHAR(100) NULL');
        await addColumnIfMissing(conn, 'higher_education', 'upload_mode', 'VARCHAR(50) NULL');

        // 2. Alter applications to track checkbox choices
        console.log('\n[2] Updating applications table...');
        await addColumnIfMissing(conn, 'applications', 'has_sslc', 'TINYINT(1) DEFAULT 1');
        await addColumnIfMissing(conn, 'applications', 'has_hsc', 'TINYINT(1) DEFAULT 1');
        await addColumnIfMissing(conn, 'applications', 'has_diploma', 'TINYINT(1) DEFAULT 0');
        await addColumnIfMissing(conn, 'applications', 'has_ug', 'TINYINT(1) DEFAULT 1');
        await addColumnIfMissing(conn, 'applications', 'has_pg', 'TINYINT(1) DEFAULT 1');
        await addColumnIfMissing(conn, 'applications', 'has_mphil', 'TINYINT(1) DEFAULT 0');
        await addColumnIfMissing(conn, 'applications', 'has_integrated', 'TINYINT(1) DEFAULT 0');

        // 3. Alter file_upload_settings to support Extended Integrated upload configurations
        console.log('\n[3] Updating file_upload_settings table...');
        await addColumnIfMissing(conn, 'file_upload_settings', 'is_integrated_course', 'TINYINT(1) DEFAULT 0');
        await addColumnIfMissing(conn, 'file_upload_settings', 'consolidated_enabled', 'TINYINT(1) DEFAULT 1');
        await addColumnIfMissing(conn, 'file_upload_settings', 'semester_wise_enabled', 'TINYINT(1) DEFAULT 1');
        await addColumnIfMissing(conn, 'file_upload_settings', 'max_semesters', 'INT DEFAULT 10');
        await addColumnIfMissing(conn, 'file_upload_settings', 'allowed_semester_doc_types', "VARCHAR(255) DEFAULT 'jpg,jpeg,png,pdf'");
        await addColumnIfMissing(conn, 'file_upload_settings', 'per_file_size_limit', 'INT DEFAULT 500');
        await addColumnIfMissing(conn, 'file_upload_settings', 'total_size_limit', 'INT DEFAULT 5000');

        // 4. Seed the default configuration for 5-Year Integrated Course
        console.log('\n[4] Seeding file_upload_settings for 5-Year Integrated Course...');
        await conn.query(`
            INSERT INTO file_upload_settings (
                file_type, max_size, size_unit, allowed_extensions, 
                is_integrated_course, consolidated_enabled, semester_wise_enabled, 
                max_semesters, allowed_semester_doc_types, per_file_size_limit, total_size_limit
            ) VALUES (
                '5-Year Integrated Course', 2, 'MB', 'jpg,jpeg,png,pdf', 
                1, 1, 1, 
                10, 'jpg,jpeg,png,pdf', 500, 5000
            ) ON DUPLICATE KEY UPDATE 
                is_integrated_course = 1, 
                consolidated_enabled = 1, 
                semester_wise_enabled = 1,
                max_semesters = 10,
                allowed_semester_doc_types = 'jpg,jpeg,png,pdf',
                per_file_size_limit = 500,
                total_size_limit = 5000
        `);
        console.log('  [OK]   5-Year Integrated Course configuration seeded');

        console.log('\n=== MIGRATION COMPLETE ===\n');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await conn.end();
    }
}

run();
