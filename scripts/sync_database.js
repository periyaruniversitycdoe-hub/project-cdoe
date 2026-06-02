const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Load environment variables using dotenv from student/backend node_modules
let dotenvPath = path.join(__dirname, '../student/backend/node_modules/dotenv');
if (!fs.existsSync(dotenvPath)) {
  dotenvPath = 'dotenv'; // Fallback if installed in root or other places
}
try {
  require(dotenvPath).config({ path: path.join(__dirname, '../.env') });
  console.log('✅ Loaded environment configuration from .env');
} catch (e) {
  console.log('⚠️ Warning: Failed to load dotenv. Operating in default/process env context.');
}

async function runSync() {
  console.log(`\n========================================`);
  console.log(`🚀 STARTING DATABASE SYNC: RAILWAY -> LOCAL`);
  console.log(`========================================`);

  // Credentials for Railway DB
  const railwayConfig = {
    host: 'zephyr.proxy.rlwy.net',
    port: 55838,
    user: 'root',
    password: 'ZbdDJZqLecMrVGLtgyFZqowsNpYJIunh',
    database: 'railway',
    multipleStatements: true,
    connectTimeout: 60000
  };

  // Local MySQL Config from .env
  const localConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'rsm_db',
    multipleStatements: true,
    connectTimeout: 60000
  };

  console.log(`📡 Connecting to Railway database at ${railwayConfig.host}:${railwayConfig.port}...`);
  let railwayConn;
  try {
    railwayConn = await mysql.createConnection(railwayConfig);
    console.log('✅ Successfully connected to Railway database!');
  } catch (err) {
    console.error('❌ Failed to connect to Railway database:', err.message);
    process.exit(1);
  }

  console.log(`📡 Connecting to local database at ${localConfig.host}:${localConfig.port}...`);
  let localConn;
  try {
    localConn = await mysql.createConnection({
      host: localConfig.host,
      port: localConfig.port,
      user: localConfig.user,
      password: localConfig.password
    });
    
    // Check if database exists, create if not
    const [dbs] = await localConn.query(`SHOW DATABASES LIKE ?`, [localConfig.database]);
    if (dbs.length === 0) {
      console.log(`⚙️ Database "${localConfig.database}" not found. Creating it...`);
      await localConn.query(`CREATE DATABASE \`${localConfig.database}\``);
    }
    
    await localConn.query(`USE \`${localConfig.database}\``);
    console.log(`✅ Successfully connected to local database: "${localConfig.database}"`);
  } catch (err) {
    console.error('❌ Failed to connect to local database:', err.message);
    await railwayConn.end();
    process.exit(1);
  }

  try {
    // 1. Temporarily disable foreign key checks to allow dropping and recreating tables in any order
    console.log('⚡ Disabling foreign key checks on local database...');
    await localConn.query('SET FOREIGN_KEY_CHECKS = 0');

    // 2. Fetch tables from Railway
    const [railwayTablesRes] = await railwayConn.query('SHOW TABLES');
    const railwayTables = railwayTablesRes.map(row => Object.values(row)[0]);
    console.log(`📊 Found ${railwayTables.length} tables in Railway database.`);

    // 3. Fetch tables from Local
    const [localTablesRes] = await localConn.query('SHOW TABLES');
    const localTables = localTablesRes.map(row => Object.values(row)[0]);

    // 4. Drop any local tables that do not exist in Railway
    const extraInLocal = localTables.filter(t => !railwayTables.includes(t));
    if (extraInLocal.length > 0) {
      console.log(`🧹 Found ${extraInLocal.length} extra tables locally. Dropping them...`);
      for (const table of extraInLocal) {
        console.log(`   - Dropping extra local table: \`${table}\``);
        await localConn.query(`DROP TABLE IF EXISTS \`${table}\``);
      }
    }

    // 5. Clone each table structure and data
    console.log('\n🔄 Cloning tables...');
    for (const table of railwayTables) {
      const startTime = Date.now();
      
      // Get Create Table statement from Railway
      const [createTableRes] = await railwayConn.query(`SHOW CREATE TABLE \`${table}\``);
      let createTableSql = createTableRes[0]['Create Table'];

      // Replace MySQL 8.0 specific collation with general collation for compatibility
      createTableSql = createTableSql.replace(/utf8mb4_0900_ai_ci/gi, 'utf8mb4_general_ci');

      // Drop local table
      await localConn.query(`DROP TABLE IF EXISTS \`${table}\``);
      
      // Create local table
      await localConn.query(createTableSql);

      // Get columns description of local table to find insertable columns
      // (This filters out generated/computed virtual/stored columns)
      const [columnsDesc] = await localConn.query(`DESCRIBE \`${table}\``);
      const insertableColumns = columnsDesc
        .filter(col => !col.Extra.includes('GENERATED'))
        .map(col => col.Field);

      // Query data from Railway for only the insertable columns
      const selectSql = 'SELECT `' + insertableColumns.join('`, `') + '` FROM `' + table + '`';
      const [rows] = await railwayConn.query(selectSql);

      if (rows.length > 0) {
        const values = rows.map(row => insertableColumns.map(col => row[col]));
        
        // Insert rows in chunks to prevent packet size errors
        const chunkSize = 1000;
        for (let i = 0; i < values.length; i += chunkSize) {
          const chunk = values.slice(i, i + chunkSize);
          const insertSql = 'INSERT INTO `' + table + '` (`' + insertableColumns.join('`, `') + '`) VALUES ?';
          await localConn.query(insertSql, [chunk]);
        }
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`🟢 Cloned table \`${table}\`: Recreated schema and copied ${rows.length} rows (${duration}s).`);
      } else {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`⚪ Cloned table \`${table}\`: Recreated schema (0 rows) (${duration}s).`);
      }
    }

    // 6. Re-enable foreign key checks
    console.log('\n⚡ Re-enabling foreign key checks on local database...');
    await localConn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('\n========================================');
    console.log('🎉 CLONING PROCESS COMPLETED SUCCESSFULLY!');
    console.log('========================================');

    // 7. Verify migration by checking row counts
    console.log('\n📊 Performing Final Verification...');
    let mismatches = 0;
    const [finalLocalTablesRes] = await localConn.query('SHOW TABLES');
    const finalLocalTables = finalLocalTablesRes.map(row => Object.values(row)[0]);

    for (const table of railwayTables) {
      if (!finalLocalTables.includes(table)) {
        console.error(`❌ Error: Table \`${table}\` was not created locally!`);
        mismatches++;
        continue;
      }
      
      const [[{ count: rCount }]] = await railwayConn.query(`SELECT COUNT(*) as count FROM \`${table}\``);
      const [[{ count: lCount }]] = await localConn.query(`SELECT COUNT(*) as count FROM \`${table}\``);
      
      if (rCount !== lCount) {
        console.error(`❌ Row Count Mismatch on \`${table}\`! Railway: ${rCount}, Local: ${lCount}`);
        mismatches++;
      }
    }

    if (mismatches === 0) {
      console.log(`✅ All ${railwayTables.length} tables successfully cloned and verified with matching row counts!`);
    } else {
      console.warn(`⚠️ Warning: ${mismatches} mismatch(es) detected during verification.`);
    }

  } catch (err) {
    console.error('\n❌ Critical Error during migration:', err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    if (railwayConn) await railwayConn.end();
    if (localConn) await localConn.end();
    console.log('🔌 Connections closed.');
  }
}

runSync();
