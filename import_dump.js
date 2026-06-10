const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Load environment variables using dotenv from student/backend node_modules
let dotenvPath = path.join(__dirname, 'student/backend/node_modules/dotenv');
if (!fs.existsSync(dotenvPath)) {
  dotenvPath = 'dotenv'; // Fallback if installed in root or other places
}
try {
  require(dotenvPath).config({ path: path.join(__dirname, '.env') });
  console.log('✅ Loaded environment configuration from .env');
} catch (e) {
  console.log('⚠️ Warning: Failed to load dotenv. Operating in default/process env context.');
}

const dumpFilePath = 'c:/Users/majeed/Downloads/Dump20260528.sql';

async function runImport() {
  console.log(`\n========================================`);
  console.log(`🚀 STARTING DATABASE IMPORT PROCESS`);
  console.log(`========================================`);
  
  if (!fs.existsSync(dumpFilePath)) {
    console.error(`❌ Error: Dump file not found at path: ${dumpFilePath}`);
    process.exit(1);
  }
  
  console.log(`📂 Found SQL dump file: ${dumpFilePath} (${(fs.statSync(dumpFilePath).size / 1024).toFixed(2)} KB)`);

  const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true, // Crucial for running the entire dump in one go
    connectionLimit: 1,
  };

  console.log(`📡 Connecting to database:`);
  console.log(`   Host: ${dbConfig.host}`);
  console.log(`   Port: ${dbConfig.port}`);
  console.log(`   User: ${dbConfig.user}`);
  console.log(`   Database: ${dbConfig.database}`);

  if (!dbConfig.host || !dbConfig.user || !dbConfig.password || !dbConfig.database) {
    console.error('❌ Error: Missing database environment variables in .env file!');
    process.exit(1);
  }

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Successfully connected to MySQL database instance!');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }

  try {
    console.log('📖 Reading and parsing SQL dump file...');
    let sqlContent = fs.readFileSync(dumpFilePath, 'utf8');

    // Clean up SQL content:
    // Remove "CREATE DATABASE ..." and "USE ..." statements so everything goes into the active target DB
    console.log('🧹 Cleaning SQL queries (stripping CREATE DATABASE / USE statements)...');
    
    // Replace: CREATE DATABASE IF NOT EXISTS `rsm_db` ...;
    sqlContent = sqlContent.replace(/CREATE DATABASE\s+IF\s+NOT\s+EXISTS\s+`?\w+`?[^;]*;/gi, '-- STRIPPED: CREATE DATABASE STATEMENT');
    // Replace: USE `rsm_db`; or USE rsm_db;
    sqlContent = sqlContent.replace(/USE\s+`?\w+`?\s*;/gi, '-- STRIPPED: USE DATABASE STATEMENT');

    // Dynamically inject UNIQUE KEY (`application_id`) to the `applications` table to satisfy foreign keys
    console.log('🩹 Patching applications table to add UNIQUE KEY on application_id...');
    sqlContent = sqlContent.replace(
      /CREATE TABLE `applications` \([\s\S]+?PRIMARY KEY \(`id`\),/i,
      (match) => match + '\n  UNIQUE KEY `uniq_application_id` (`application_id`),'
    );

    console.log('⚡ Executing SQL statements onto database...');
    console.log('⏳ This may take a moment. Please wait...');
    
    const startTime = Date.now();
    await connection.query(sqlContent);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`🎉 SUCCESS! Database imported successfully in ${duration} seconds.`);
    
    // Let's verify by listing tables in the database
    console.log('\n📊 Verifying imported tables:');
    const [rows] = await connection.query(`SHOW TABLES`);
    console.log(`🔍 Total tables found in database: ${rows.length}`);
    if (rows.length > 0) {
      console.log('📋 First 10 tables:');
      rows.slice(0, 10).forEach((row, index) => {
        const tableName = Object.values(row)[0];
        console.log(`   ${index + 1}. ${tableName}`);
      });
    }

  } catch (err) {
    console.error('❌ Error during import execution:', err.message);
    if (err.sqlState) console.error('   SQL State:', err.sqlState);
    if (err.code) console.error('   Error Code:', err.code);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Connection closed.');
    }
    console.log(`========================================\n`);
  }
}

runImport();
