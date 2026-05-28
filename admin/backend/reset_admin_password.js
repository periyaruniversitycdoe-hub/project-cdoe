const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function resetAdminPassword() {
    console.log('Connecting with DB_HOST:', process.env.DB_HOST, 'port:', process.env.DB_PORT);
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const email = 'admin@periyar.edu';
        const plainPassword = 'admin@123';
        const hashed = await bcrypt.hash(plainPassword, 10);

        // Check if admin user exists in 'users' table
        const [rows] = await connection.execute(
            "SELECT id, email, role FROM users WHERE role = 'admin' OR email = ?",
            [email]
        );

        if (rows.length === 0) {
            // Create admin user
            const [result] = await connection.execute(
                "INSERT INTO users (application_id, full_name, email, password, role) VALUES (?, ?, ?, ?, 'admin')",
                ['ADMIN001', 'University Administrator', email, hashed]
            );
            console.log(`✅ Admin user created with id: ${result.insertId}`);
        } else {
            // Update existing admin password and email
            await connection.execute(
                "UPDATE users SET email = ?, password = ? WHERE role = 'admin' OR email = ?",
                [email, hashed, email]
            );
            console.log(`✅ Admin password reset for: ${rows.map(r => r.email).join(', ')}`);
        }

        console.log(`🔑 Password: ${plainPassword}`);
        console.log(`📧 Email:    ${email}`);
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await connection.end();
    }
}

resetAdminPassword();

