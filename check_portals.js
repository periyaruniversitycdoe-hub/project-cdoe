const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Load env
let dotenvPath = path.join(__dirname, 'admin/backend/node_modules/dotenv');
if (!fs.existsSync(dotenvPath)) dotenvPath = 'dotenv';
try {
  require(dotenvPath).config({ path: path.join(__dirname, '.env') });
} catch (e) {}

async function run() {
  const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to DB.');
    
    // Check if table exists
    const [tables] = await connection.query(`SHOW TABLES LIKE 'portal_management'`);
    if (tables.length === 0) {
      console.log('❌ portal_management table does NOT exist!');
      return;
    }

    const [rows] = await connection.query('SELECT * FROM portal_management');
    console.log(`🔍 Total portals in portal_management table: ${rows.length}`);
    console.log(rows);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    if (connection) await connection.end();
  }
}

run();
