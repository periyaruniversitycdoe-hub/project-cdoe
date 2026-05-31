const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

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
        console.log('\n=== SUPERVISOR HOME ADDRESS MIGRATION ===\n');

        const alreadyExists = await columnExists(conn, 'supervisors', 'home_address_1');
        if (alreadyExists) {
            console.log('  [SKIP] supervisors.home_address_1 already exists. Database is in sync.');
        } else {
            console.log('Reading migration SQL 010_supervisor_home_address.sql...');
            let sql = fs.readFileSync(path.join(__dirname, '010_supervisor_home_address.sql'), 'utf8');
            const dbName = process.env.DB_NAME || 'rsm_db';
            sql = sql.replace(/USE\s+rsm_db\s*;/gi, `USE \`${dbName}\`;`);
            console.log('Applying home address migration to database...');
            await conn.query(sql);
            console.log('✅ Home address migration successfully applied!');
        }
        console.log('\n=== MIGRATION COMPLETE ===\n');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        await conn.end();
    }
}

run();
