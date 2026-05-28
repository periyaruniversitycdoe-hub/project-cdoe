const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Resolve path to bcrypt and dotenv from admin/backend node_modules
let dotenvPath = path.join(__dirname, 'admin/backend/node_modules/dotenv');
if (!fs.existsSync(dotenvPath)) dotenvPath = 'dotenv';
try {
  require(dotenvPath).config({ path: path.join(__dirname, '.env') });
  console.log('✅ Loaded environment configuration from .env');
} catch (e) {
  console.log('⚠️ Warning: Failed to load dotenv.');
}

let bcryptPath = path.join(__dirname, 'admin/backend/node_modules/bcrypt');
if (!fs.existsSync(bcryptPath)) bcryptPath = 'bcrypt';
const bcrypt = require(bcryptPath);

async function run() {
  console.log(`\n========================================`);
  console.log(`👤 CONFIGURING ADMIN USER`);
  console.log(`========================================`);

  const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  if (!dbConfig.host || !dbConfig.user || !dbConfig.password || !dbConfig.database) {
    console.error('❌ Error: Missing database environment variables in .env file!');
    process.exit(1);
  }

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Successfully connected to Railway database!');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }

  try {
    const adminEmail = 'admin@periyar.edu';
    const plainPassword = 'admin@123';
    
    console.log(`🔍 Checking columns in "users" table...`);
    const [columns] = await connection.query('DESCRIBE users');
    const columnNames = columns.map(c => c.Field);
    console.log('📋 Columns in users table:', columnNames.join(', '));
    
    console.log(`🔍 Checking if user with email "${adminEmail}" exists...`);
    const [users] = await connection.query('SELECT * FROM users WHERE email = ?', [adminEmail]);
    
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    
    if (users.length > 0) {
      console.log(`Found existing user record for ${adminEmail}. Updating password and role to admin...`);
      const user = users[0];
      
      let updateQuery = 'UPDATE users SET password = ?, role = "admin"';
      const params = [hashedPassword];
      
      if (columnNames.includes('status')) {
        updateQuery += ', status = "approved"';
      }
      if (columnNames.includes('is_active')) {
        updateQuery += ', is_active = 1';
      }
      
      updateQuery += ' WHERE id = ?';
      params.push(user.id);
      
      await connection.query(updateQuery, params);
      console.log(`✅ Admin credentials successfully updated!`);
    } else {
      console.log(`Admin user ${adminEmail} does not exist. Creating a new admin record...`);
      
      const insertCols = ['email', 'password', 'role'];
      const insertVals = [adminEmail, hashedPassword, 'admin'];
      
      if (columnNames.includes('full_name')) {
        insertCols.push('full_name');
        insertVals.push('System Administrator');
      }
      if (columnNames.includes('status')) {
        insertCols.push('status');
        insertVals.push('approved');
      }
      if (columnNames.includes('is_active')) {
        insertCols.push('is_active');
        insertVals.push(1);
      }
      
      const placeholders = insertVals.map(() => '?').join(', ');
      const insertQuery = `INSERT INTO users (${insertCols.join(', ')}) VALUES (${placeholders})`;
      
      await connection.query(insertQuery, insertVals);
      console.log(`✅ Admin credentials successfully created!`);
    }

    // Verify
    const [verifyUsers] = await connection.query('SELECT id, email, role FROM users WHERE email = ?', [adminEmail]);
    console.log('\n📊 Verified admin user record in database:');
    console.log(verifyUsers[0]);

  } catch (err) {
    console.error('❌ Error updating/creating admin user:', err.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Connection closed.');
    }
    console.log(`========================================\n`);
  }
}

run();
