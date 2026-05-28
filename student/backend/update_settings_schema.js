
const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateSchema() {
    const pool = await mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        charset: 'utf8mb4'
    });

    try {
        console.log('Checking university_settings schema...');
        const [columns] = await pool.execute('SHOW COLUMNS FROM university_settings');
        const columnNames = columns.map(c => c.Field);

        const missingColumns = [
            { name: 'email', type: 'VARCHAR(255)' },
            { name: 'phone', type: 'VARCHAR(20)' },
            { name: 'website', type: 'VARCHAR(255)' },
            { name: 'footer_text', type: 'VARCHAR(255)' },
            { name: 'copyright_text', type: 'VARCHAR(255)' }
        ];

        for (const col of missingColumns) {
            if (!columnNames.includes(col.name)) {
                console.log(`Adding column: ${col.name}`);
                await pool.execute(`ALTER TABLE university_settings ADD COLUMN ${col.name} ${col.type}`);
            }
        }

        console.log('Ensuring audit log table exists...');
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS settings_audit_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                admin_id INT,
                action VARCHAR(255),
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ Schema updated successfully!');
    } catch (err) {
        console.error('❌ Schema update failed:', err.message);
    } finally {
        await pool.end();
    }
}

updateSchema();
