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

async function tableExists(conn, table) {
    const [rows] = await conn.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = ?`,
         [table]
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
        console.log('\n=== SUPERVISOR DESIGNATION CONSOLIDATION MIGRATION ===\n');

        // 1. Check and add max_capacity column to master_designations
        const capColExists = await columnExists(conn, 'master_designations', 'max_capacity');
        if (capColExists) {
            console.log('  [SKIP] master_designations.max_capacity column already exists');
        } else {
            console.log('  Adding max_capacity column to master_designations table...');
            await conn.query('ALTER TABLE `master_designations` ADD COLUMN `max_capacity` INT NOT NULL DEFAULT 0');
            console.log('  [OK]   master_designations.max_capacity column added');
        }

        // 2. Set default standard capacities for Professor (8), Associate Professor (6), Assistant Professor (4)
        console.log('  Seeding default capacities for core designations...');
        await conn.query(`
            UPDATE master_designations SET max_capacity = 8 WHERE name = 'Professor' AND max_capacity = 0;
        `);
        await conn.query(`
            UPDATE master_designations SET max_capacity = 6 WHERE name = 'Associate Professor' AND max_capacity = 0;
        `);
        await conn.query(`
            UPDATE master_designations SET max_capacity = 4 WHERE name = 'Assistant Professor' AND max_capacity = 0;
        `);
        console.log('  [OK]   default core capacities seeded/verified');

        // 3. Map/Copy existing capacities from supervisor_capacity_master
        const scmExists = await tableExists(conn, 'supervisor_capacity_master');
        if (scmExists) {
            console.log('  Migrating existing values from supervisor_capacity_master to master_designations...');
            await conn.query(`
                UPDATE master_designations md 
                JOIN supervisor_capacity_master scm ON md.id = scm.designation_id 
                SET md.max_capacity = scm.max_capacity;
            `);
            console.log('  [OK]   existing capacities migrated successfully');
        } else {
            console.log('  [INFO] supervisor_capacity_master table does not exist. Skipping data migration.');
        }

        // 4. Create supervisor_designation_audit_logs table
        console.log('  Creating supervisor_designation_audit_logs table if not exists...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS supervisor_designation_audit_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                designation_id INT NULL,
                designation_name VARCHAR(200) NOT NULL,
                action ENUM('CREATE', 'UPDATE', 'DELETE') NOT NULL,
                field_changed VARCHAR(100) DEFAULT NULL,
                old_value VARCHAR(500) DEFAULT NULL,
                new_value VARCHAR(500) DEFAULT NULL,
                admin_user VARCHAR(200) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('  [OK]   supervisor_designation_audit_logs table created/verified');

        console.log('\n=== MIGRATION COMPLETE ===\n');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        await conn.end();
    }
}

run();
