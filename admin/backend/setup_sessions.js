const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Majeed2004@',
    database: 'rsm_db'
  });

  // Create sessions table without session_types dependency
  await conn.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      year INT NOT NULL,
      month VARCHAR(20) NOT NULL,
      is_active TINYINT(1) DEFAULT 0,
      registration_open TINYINT(1) DEFAULT 0,
      application_open TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('sessions table created/verified OK');

  // Add session_id to users if missing
  const [cols] = await conn.query("SHOW COLUMNS FROM users LIKE 'session_id'");
  if (cols.length === 0) {
    await conn.query('ALTER TABLE users ADD COLUMN session_id INT NULL');
    console.log('Added session_id to users table');
  } else {
    console.log('session_id column already exists in users');
  }

  await conn.end();
  console.log('Done!');
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
