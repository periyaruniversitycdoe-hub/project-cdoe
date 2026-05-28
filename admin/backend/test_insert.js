const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs'); // The user project might be using bcryptjs instead of bcrypt, wait let me check package.json. No I'll just use what's required in routes/applications.js
const bcrypt_pkg = require('bcrypt');
async function test() {
  const pool = mysql.createPool({ host: 'localhost', user: 'root', password: 'Majeed2004@', database: 'rsm_db' });
  const connection = await pool.getConnection();
  try {
    const hashedPassword = await bcrypt_pkg.hash('password123', 10);
    const applicationId = 'APP2026-999999';
    const [userResult] = await connection.execute('INSERT INTO users (application_id, full_name, email, password, role) VALUES (?, ?, ?, ?, "student")', [applicationId, 'Draft Applicant', 'draft_test4@periyar.edu', hashedPassword]);
    const userId = userResult.insertId;
    await connection.execute('INSERT INTO applications (application_id, user_id, subject, category) VALUES (?, ?, ?, ?)', [applicationId, userId, 'Computer Science', 'Full Time']);
    console.log('Success, User ID:', userId);
  } catch(e) {
    console.log('DB ERROR:', e.message);
  } finally {
    connection.release();
    process.exit();
  }
}
test();
