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
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'rsm_db',
        multipleStatements: true
    });
    
    try {
        console.log('Connecting to database and verifying schema...');
        
        // 1. Create table if not exists using the new structure
        await pool.query(`
            CREATE TABLE IF NOT EXISTS community_fees (
                id INT AUTO_INCREMENT PRIMARY KEY,
                community_name VARCHAR(100) NOT NULL UNIQUE,
                pg_min_mark DECIMAL(5,2) DEFAULT NULL,
                general_fee DECIMAL(10,2) DEFAULT NULL,
                differently_abled_fee DECIMAL(10,2) DEFAULT NULL,
                roster_percentage DECIMAL(5,2) DEFAULT 0.00,
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('Table community_fees is verified.');

        // 2. Read existing columns to do safe, incremental modifications
        const [columns] = await pool.query('SHOW COLUMNS FROM community_fees');
        const existingFields = columns.map(c => c.Field);
        console.log('Existing columns in community_fees:', existingFields);

        // Rename community -> community_name if it exists
        if (existingFields.includes('community') && !existingFields.includes('community_name')) {
            console.log('Renaming column: community -> community_name');
            await pool.query('ALTER TABLE community_fees CHANGE COLUMN community community_name VARCHAR(100) NOT NULL UNIQUE');
        }

        // Rename fee_general -> general_fee if it exists
        if (existingFields.includes('fee_general') && !existingFields.includes('general_fee')) {
            console.log('Renaming column: fee_general -> general_fee');
            await pool.query('ALTER TABLE community_fees CHANGE COLUMN fee_general general_fee DECIMAL(10,2)');
        }

        // Rename fee_diff_abled -> differently_abled_fee if it exists
        if (existingFields.includes('fee_diff_abled') && !existingFields.includes('differently_abled_fee')) {
            console.log('Renaming column: fee_diff_abled -> differently_abled_fee');
            await pool.query('ALTER TABLE community_fees CHANGE COLUMN fee_diff_abled differently_abled_fee DECIMAL(10,2)');
        }

        // Add roster_percentage if it doesn't exist
        if (!existingFields.includes('roster_percentage')) {
            console.log('Adding column: roster_percentage');
            await pool.query('ALTER TABLE community_fees ADD COLUMN roster_percentage DECIMAL(5,2) DEFAULT 0.00 AFTER differently_abled_fee');
        }

        // Add status if it doesn't exist
        if (!existingFields.includes('status')) {
            console.log('Adding column: status');
            await pool.query('ALTER TABLE community_fees ADD COLUMN status VARCHAR(20) DEFAULT "active" AFTER roster_percentage');
        }

        // 3. Drop/Truncate the duplicate dropdown_communities table
        console.log('Cleaning up dropdown_communities table...');
        await pool.query('DROP TABLE IF EXISTS dropdown_communities');
        console.log('Duplicate dropdown_communities table dropped successfully.');

        // 4. Print final state
        const [finalColumns] = await pool.query('SHOW COLUMNS FROM community_fees');
        console.log('Final community_fees schema:', finalColumns.map(c => `${c.Field} (${c.Type})`));

        console.log('✅ Migration successfully applied!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
