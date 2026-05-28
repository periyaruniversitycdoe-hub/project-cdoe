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

async function run() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'rsm_db',
        multipleStatements: true
    });
    
    try {
        console.log('Reading migration SQL 005_part_time_enhancements.sql...');
        const sql = fs.readFileSync(path.join(__dirname, '005_part_time_enhancements.sql'), 'utf8');
        console.log('Applying migration to database...');
        await pool.query(sql);
        console.log('✅ Migration successfully applied!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
